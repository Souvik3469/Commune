# Commune — Known Flaws

**Status: documented, not fixed.** This is a deliberate record of what's wrong with the codebase as
it stands, written after the fact. Nothing here has been changed — the point is an honest audit, not
a cleanup.

Ordered by severity. Each entry says what's wrong, why it matters, and what the fix would be.

---

## 🔴 Critical

### 1. The Socket.IO layer has no authentication at all
`backend/src/app.js`

```js
socket.on("register", ({ userId }) => {
  socket.data.userId = userId;
  socket.join(`user-${userId}`);
});
```

The client supplies its own `userId` and the server trusts it. Every HTTP route is behind
`authMiddleware` and verifies a JWT — the socket layer verifies nothing.

**What this allows:** connect a socket, emit `register` with somebody else's user id, and you join
their personal room. You then receive their incoming call offers, and can answer them. The same
applies to `join` — any `roomId` is accepted with no membership check, so you can join any chat
room you know the id of.

**Fix:** authenticate the socket handshake (`io.use()` with the JWT from `socket.handshake.auth`),
derive `userId` from the verified token, and never read it from the payload. For `join`, check chat
membership server-side before joining the room.

### 2. WebRTC signalling trusts a client-supplied `from`
`backend/src/app.js`

```js
socket.on("offer", ({ roomId, from, offer, video, to, callerName, callerAvatar }) => {
  const payload = { from, offer, video, callerName, callerAvatar };
```

Caller identity, display name, and avatar all come from the client and are forwarded unverified.
A caller can present as any user. (Note `candidate` *does* use `socket.data.userId` — so the
codebase is inconsistent with itself about this.)

**Fix:** always derive `from`, `callerName`, and `callerAvatar` server-side from the authenticated
socket identity.

### 3. Socket.IO CORS is fully open
```js
const io = new Server(httpServer, { cors: { origin: "*", credentials: true } });
```

Express CORS is carefully restricted to an allow-list; the socket server accepts every origin. Any
website can open a socket to this backend. `origin: "*"` with `credentials: true` is also a
contradictory combination.

**Fix:** reuse the same allow-list for both.

### 4. Hardcoded session secret, committed to the repo
```js
app.use(session({ resave: false, saveUninitialized: true, secret: "commune" }));
```

The signing secret is the literal string `"commune"` in source. Anyone reading the repo can forge a
session cookie. `saveUninitialized: true` also creates a session row for every anonymous visitor,
and no cookie flags (`secure`, `httpOnly`, `sameSite`) are set.

**Fix:** secret from env, `saveUninitialized: false`, explicit cookie flags. Also worth asking
whether express-session is needed at all — auth is JWT-based and the session appears to exist only
for Passport's Google flow.

---

## 🟠 High

### 5. No database indexes anywhere in the schema
`backend/prisma/schema.prisma` declares no `@@index`. The hottest query in the app is:

```js
prisma.message.findMany({ where: { chatId, timestamp: {...} }, orderBy: { timestamp: "desc" } })
```

On MongoDB with no compound index on `(chatId, timestamp)`, that's a collection scan plus an
in-memory sort on every message page load. It's fast at demo scale and degrades sharply with
message volume — which is exactly the scale a chat app is supposed to handle.

**Fix:** `@@index([chatId, timestamp(sort: Desc)])` on `Message`, plus indexes on
`DeletedChat(userId, chatId)` and `MessageReadStatus(messageId, userId)`.

### 6. Unread count fetches every unread row to call `.length` on it
`controllers/chat/chat.js` — `getUnreadMessages`

```js
const unreadMessages = await prisma.message.findMany({ where: {...}, select: { id: true } });
res.json(unreadMessages.length);
```

This transfers one row per unread message purely to count them. A chat with 10,000 unread messages
pulls 10,000 documents over the wire. It's unbounded — there's no cap.

**Fix:** `prisma.message.count({ where })`.

### 7. Two Prisma clients are instantiated
`src/prisma/index.js` exports a shared client, and `controllers/chat/chat.js` does
`const prisma = new PrismaClient()` at module scope anyway. Two clients means two connection pools
against the same database, and it's the classic source of pool exhaustion under load.

**Fix:** import the shared singleton.

### 8. Two realtime providers for one application
Messages are broadcast through **Ably** (`ably.channels.get(\`chat-${chatId}\`).publish(...)`);
calls and presence go through **Socket.IO**. Both are running in production, both are dependencies
of both frontend and backend.

This is the largest architectural smell in the project. It doubles the failure surface, doubles the
reconnection logic on the client, splits message ordering guarantees across two systems, and adds a
paid third-party dependency for something the self-hosted Socket.IO server was already doing.

**Fix:** pick one. Socket.IO is already there and already handles rooms — moving message fan-out
onto it removes an entire vendor.

### 9. Message write path has no transaction
`createMessage` does four sequential writes/effects: create message → publish to Ably → update
`chat.lastModified` → create read-status row. None are atomic, and **the Ably publish happens before
the remaining database writes**.

If the process dies mid-sequence, recipients have already seen a message whose chat ordering never
updated. Real-time delivery preceding durable state is the wrong order.

**Fix:** wrap the writes in `prisma.$transaction`, publish *after* it commits.

---

## 🟡 Medium

### 10. Global rate limit is effectively no rate limit
`rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 })` — 1000 requests per 15 minutes, applied
globally rather than per-route. Login, OTP verification, and password reset get the same budget as
fetching messages. That's ~1000 password attempts per window.

**Fix:** strict per-route limits on the auth endpoints, keyed by email/IP.

### 11. `include: { chat: true }` inside a message list
`getMessagesByChat` includes the full chat object on each of the 20 messages returned — the same
chat, serialized twenty times. Pure payload waste on the hottest endpoint in the app.

**Fix:** drop it; the caller already knows the chat.

### 12. Cursor pagination keyed on a non-unique timestamp
The cursor is `message.timestamp`. Two messages written in the same millisecond — entirely possible
in a group chat — can be skipped or duplicated across page boundaries.

**Fix:** compound cursor `(timestamp, id)`, or cursor on `id` directly.

### 13. Fragile object-spread in the message `where` clause
```js
const whereCondition = {
  chatId,
  ...(deletedChat && { timestamp: { gt: deletedChat.deletedAt } }),
  ...(cursor && { timestamp: { ...(deletedChat?.deletedAt ? { gt: ... } : {}), lt: new Date(cursor) } }),
};
```
Both spreads write the same `timestamp` key, so the second silently overwrites the first. It is
*currently* correct only because the second branch manually re-adds the `gt` condition. Any future
edit to the first branch will be silently dropped.

**Fix:** build the `timestamp` object once, explicitly.

### 14. `createMany` called with a single object
```js
await prisma.messageReadStatus.createMany({ data: { messageId, userId, readAt } });
```
`createMany` takes an array. Passing an object is at best relying on undocumented leniency.

**Fix:** `create()`, or pass an array.

### 15. A group's admin can never delete the group
`deleteChat` rejects deletion when `chat.adminId === currentUserId`, and non-admins only
`disconnect` themselves. So the one person with authority over the group is the only one who cannot
remove it, and abandoned groups are undeletable.

**Fix:** allow admin deletion (cascade or soft-delete), or transfer ownership on leave.

### 16. File uploads are appended to message text
`createMessage` concatenates `fileUrl` onto `content` as a newline-separated string. The `Message`
model has a `type` field that could carry this properly, and a `logo` field that goes unused.
Attachments aren't queryable, can't be listed, and can't be rendered distinctly without parsing
message bodies.

**Fix:** a proper attachments relation, or at minimum a typed `fileUrl` column.

---

## 🟢 Low / hygiene

### 17. Heavy unused dependency surface
`backend/package.json` declares `openai`, `@google/generative-ai`, `twilio`, `aws-sdk` (v2) **and**
`@aws-sdk/client-s3` (v3), `multer-s3`, `mailgun-js`, `ws`, `xss-clean`. Most appear unused in
`src/`.

Two specific concerns: **`socket-io` is declared alongside `socket.io`** — a well-known typosquat
package name, and it should not be in a lockfile; and `xss-clean` is unmaintained and deprecated.

**Fix:** prune, and audit why `socket-io` was ever installed.

### 18. Both Mongoose and Prisma are dependencies
`mongoose ^7.5.3` sits alongside `@prisma/client`. Only Prisma appears to be used. Dead weight, and
misleading to anyone reading the manifest to understand the stack.

### 19. Error handler leaks internal messages
```js
app.use((err, req, res, next) => res.status(err.status || 500).send({ message: err.message }));
```
For an unexpected 500 this returns the raw error message — potentially including driver or query
internals — to the client.

### 20. `console.log("Connected to MONGODB")` is unconditional
Printed on `listen()` regardless of whether any database connection was ever attempted. The log
asserts something the code never checked.

### 21. Duplicate routes to the same handler
`PUT /update/:chatId` and `PATCH /:chatId/update` both map to `updateGroupChat`.

### 22. README attributed the project to someone else — ✅ FIXED 2026-09-13
`README.md` ended with **"👤 Author — Ron S"**. Corrected to Souvik Sen. This is the one item in
this document that *was* acted on rather than just recorded — a wrong name on a resume-linked repo
isn't a code flaw to study, it's a factual error to remove.

### 23. README claims features the code contradicts
"Future Enhancements" lists *read receipts* and *media sharing*, but `MessageReadStatus` is
implemented and file URLs are already handled. The README describes an older version of the project
than the one in the repository.

---

## What's actually good, for calibration

Not everything here is a problem, and a flaws document with no counterweight is misleading:

- **The chat-deletion model is genuinely well designed.** `DeletedChat` stores a per-user
  `deletedAt` watermark and filters messages by it, so deleting a conversation hides history for you
  without destroying it for the other party — and if the conversation resumes, the old messages stay
  hidden while new ones appear. That's the correct semantic and it's not the obvious implementation.
- **HTTP authorization is consistently enforced.** Every chat route checks membership or admin
  status inside the controller rather than trusting the route. The gap is the socket layer, not the
  REST layer.
- **Cursor pagination was chosen over offset pagination**, which is the right call for a message
  list and not what most projects at this level do.
- **The sandbox-reset system** (nightly cron, backup/restore scripts, fixed demo accounts) is a
  thoughtful piece of product engineering aimed at letting strangers try the app without signing up.
