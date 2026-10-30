# Commune — Architecture (v2)

**Supersedes `commune-deep-dive.html` for anything that changed.** The original deep dive is still the
accurate description of the system *as it was built*, including its reasoning, and it is kept
deliberately — this document records what the system looks like after the October 2026 correctness
and design pass, and why each change was made.

Read alongside:

| Doc | What it is |
|---|---|
| [`commune-deep-dive.html`](commune-deep-dive.html) | The original HLD/LLD walkthrough. Historical. |
| [`api-contract.md`](api-contract.md) | The original REST contract. Historical. |
| [`db-schema.md`](db-schema.md) | The original schema, including its missing indexes. Historical. |
| [`api-contract-v2.md`](api-contract-v2.md) | The current REST and socket contract. |
| [`db-schema-v2.md`](db-schema-v2.md) | The current schema and its indexes. |
| [`migration-notes.md`](migration-notes.md) | What has to happen to a live database before deploying. |

---

## 1. What changed at the architecture level

Three things were structural rather than local.

### 1.1 One realtime transport instead of two

**Before.** Messages went out over **Ably**; calls, presence and signalling went over **Socket.IO**.
Both ran in production. Both were dependencies of both halves of the app.

That split cost more than a vendor bill:

- **The Ably key was a root key, read from the frontend bundle** (`VITE_ABLY_API_KEY`). Anyone who
  opened devtools had publish and subscribe rights on every `chat-*` channel in the system. They
  could read any conversation's live traffic and inject messages that the UI would render as
  genuine. This was the single worst defect in the codebase and it is not in the original flaws
  audit.
- **Connection count scaled with the UI.** `ChatRow` opened an `Ably.Realtime` *per rendered row*,
  `AllChats` opened another, `ChatArea` another, and `MessageBox` held one at module scope. A
  sidebar of twelve chats meant roughly fifteen WebSockets per tab.
- **Message ordering was split across two systems**, and reconnection logic had to exist twice.
- **The sidebar preview never updated for the recipient.** The composer published a client-side
  `new-message` event that `AllChats` listened for — so your own list moved when you sent, and the
  other person's list did not move at all until they reloaded. The server published a different
  event name (`message`) that nothing in the sidebar subscribed to.

**After.** Socket.IO carries everything. The server owns the fan-out.

```
                         ┌──────────────── one authenticated socket per tab ───────────────┐
  browser  ──handshake──►│ io.use(): verify JWT → socket.data.userId                       │
                         │ on connect: join user:<id> and chat:<id> for every chat you're in│
                         └────────────────────────────────────────────────────────────────┘
                                   ▲                                   │
       POST /v1/chat/send          │                                   │ chat:message
            │                      │                                   │ typing
            ▼                      │                                   ▼
   prisma.$transaction(...)  ──commit──►  publishMessage(chatId, msg) ──► io.to(`chat:<id>`)
```

Because the socket is joined to a room per conversation, the sidebar, the open thread and the
typing indicators are all served by the *same* connection. The per-row connection is gone, the
vendor is gone, and the key that was being handed to every visitor no longer exists.

The realtime layer also moved out of `app.js` into `src/v1/realtime/`, so `app.js` is HTTP wiring
and nothing else.

### 1.2 Socket identity is derived, never declared

**Before.** The socket layer authenticated nothing:

```js
socket.on("register", ({ userId }) => {
  socket.data.userId = userId;          // whatever the client said
  socket.join(`user-${userId}`);
});
```

Every HTTP route sat behind `authMiddleware` and verified a JWT. The socket layer verified nothing,
so a client could join another user's personal room and receive — and answer — their incoming
calls. `join` accepted any `roomId` with no membership check. `offer` forwarded a client-supplied
`from`, `callerName` and `callerAvatar`, so a caller could present as anyone. (`candidate` already
used `socket.data.userId`, so the codebase disagreed with itself about this.)

**After.** `io.use()` verifies the same JWT the HTTP routes verify, loads the user, and puts the id
on `socket.data`. There is no `register` event any more. `join` and `chat:subscribe` check chat
membership against the database before admitting the socket to a room. Every signalling payload is
stamped server-side.

The handshake fails closed: if the database is unreachable the membership check returns `false`
rather than throwing, and the handshake is refused rather than crashing the process.

### 1.3 The write path is transactional, and publishes after it commits

**Before.** `createMessage` performed four effects in sequence with no transaction, and **published
to Ably between the first and the second**:

```
create message → publish to Ably → update chat.lastModified → create read-status row
```

A crash after the publish left recipients holding a message whose conversation never reordered.
Realtime delivery preceded durable state.

**After.** The three writes that must agree — the message, the chat's ordering timestamp, the
sender's own read receipt — are one `prisma.$transaction`. The socket publish happens after it
commits. A client can no longer observe a message the database does not have.

> **Deployment note.** Prisma's interactive transactions on MongoDB require a replica set. Atlas is
> one, so production is fine; a standalone local `mongod` is not and will reject the transaction.
> See [`migration-notes.md`](migration-notes.md).

---

## 2. Data layer

### 2.1 One Prisma client

`chat.js`, `auth.js`, `user.js`, `InviteLink.js` and all three sandbox scripts each constructed
`new PrismaClient()`. A single process therefore held six connection pools against one database —
the classic route to pool exhaustion. Everything imports the singleton in `src/prisma/index.js`,
which is additionally cached on `globalThis` in development so nodemon's reloads do not leak a pool
per restart.

### 2.2 Indexes

The schema previously declared no `@@index` at all. The hottest query in the application —

```js
prisma.message.findMany({ where: { chatId, timestamp: {...} }, orderBy: { timestamp: "desc" } })
```

— was a collection scan plus an in-memory sort on every page of every thread. Fine at demo scale,
sharply degrading at exactly the volume a chat app is supposed to reach.

`Message` now carries `@@index([chatId, timestamp(sort: Desc), id(sort: Desc)])`, which serves both
the filter and the sort, and includes the `id` tiebreaker the compound cursor needs. `Chat` carries
a multikey `@@index([userIds, isGroup, lastModified(sort: Desc)])` for the two sidebar queries.
Details in [`db-schema-v2.md`](db-schema-v2.md).

### 2.3 Uniqueness that the code was assuming but not enforcing

- `MessageReadStatus` gained `@@unique([messageId, userId])`. `updateMessageStatus` used
  `createMany` with nothing preventing duplicates, so every re-open of a chat inserted another read
  receipt and the unread count drifted. The write now uses `skipDuplicates`.
- `User.username` gained `@unique`. Usernames were minted as
  `@${name}${countOfUsersWithThatName + 1}` — a read-then-write race that collides whenever two
  accounts share a display name. Minting now retries against the constraint.
- `InviteToken.chatId` was declared `String` while pointing at `Chat.id`, which is an `ObjectId`. It
  is now `@db.ObjectId`, matching the relation it participates in.

All three need a data cleanup before they can be applied to an existing database; that is what
`npm run migrate:cleanup` is for.

### 2.4 Pagination

The cursor was a bare `timestamp`. Two messages written in the same millisecond — ordinary in a
group chat — could be skipped or duplicated across a page boundary. The cursor is now
`<iso timestamp>_<id>` and the comparison breaks the tie on `id`:

```js
{ OR: [ { timestamp: { lt: ts } },
        { timestamp: ts, id: { lt: id } } ] }
```

A legacy timestamp-only cursor is still accepted, and a malformed cursor is a 400 rather than a
silent page from epoch.

The `where` clause is also built in one place. It used to be two object spreads that both wrote the
`timestamp` key, so the second silently overwrote the first — correct only because the second
branch happened to re-add the first's condition by hand, and one edit away from breaking silently.

---

## 3. Auth

| Area | Before | After |
|---|---|---|
| Token payload | `jwt.sign(user.id, secret)` — a bare string, which cannot carry `exp`. **Every token ever issued was valid forever.** | `{ sub, typ }` with `expiresIn`. Legacy bare-string tokens still verify, so nobody is logged out by the deploy. |
| Session | `express-session` with the secret hardcoded as `"commune"`, `saveUninitialized: true`, no cookie flags. | Removed. The Passport Google strategy it existed for was never registered — `passport.js` was never imported by anything. Both files deleted. |
| Password reset | `resetPassword` checked only that *some* unexpired code existed on the account. It never compared the caller's code. **Anyone who knew an email that had requested a reset could set that account's password.** | The code is verified, in constant time, with an attempt ceiling. |
| OTP | No expiry, no attempt limit, six numeric digits. The `deleteMany` clearing the previous OTP was never awaited. | 10-minute expiry, 5-attempt ceiling, constant-time compare, awaited cleanup. |
| Rate limiting | One global `1000 / 15min` across every route — so login shared its budget with message polling. | Per-route: 10/15min on credentials, 5/15min on code verification, 5/hour on outbound email, keyed on the targeted email rather than only the IP. |
| Response bodies | `register` returned `createdUser` whole, bcrypt hash included; `myDetails` returned the full row including the live reset code. | A `publicUser` projection strips `password`, `resetPasswordToken`, `resetPasswordExpiry`, `resetPasswordTries` and `googleId`. `authMiddleware` `select`s rather than loading the row, so the hash never reaches a controller. |
| Enumeration | `forgotPassword` 404'd for unknown emails. | Identical response either way. |
| Errors | The handler returned `err.message` verbatim for unexpected 500s, leaking driver and query internals. | 5xx returns a fixed message and logs the detail server-side. 4xx messages still pass through. |

---

## 4. Resilience

Two defects could take the whole process down, and one quietly destroyed data on every deploy.

- **`sandboxRestore.js` called `restore()` at module scope *and* exported it.** The cron module
  imports it, so **every server boot wiped and recreated the sandbox accounts and their chats** —
  not just the nightly tick. It then called `prisma.$disconnect()`, tearing down the connection pool
  the API had just started with. All three sandbox scripts now run only when executed directly
  (`require.main === module`), and read and write their backup file relative to the project root
  rather than the process working directory.
- **`EmailService` registered no `error` listener** on its outbound HTTPS request. An unhandled
  `error` event on a Node stream is thrown, so a DNS failure at the mail provider crashed the API.
  It now resolves a boolean, has a timeout, and drains its response.
- **Async Socket.IO handlers.** Socket.IO does not catch rejections from async listeners, so a
  database blip inside the handshake middleware terminated the process. This was found by booting
  the server against an unreachable database and watching it die. Every async listener is now
  wrapped, and `app.js` installs an `unhandledRejection` guard.

Also added: a real `/healthz` that pings the database, and graceful shutdown on `SIGINT`/`SIGTERM`.
The old boot sequence printed `"Connected to MONGODB"` unconditionally, asserting something the code
had never checked.

---

## 5. Group lifecycle

`deleteChat` rejected deletion when `chat.adminId === currentUserId`, so the one person with
authority over a group was the only one who could not remove it, and abandoned groups were
undeletable by anyone. An admin leaving now transfers the group to the longest-standing remaining
member, and deletes the group outright (with its messages, receipts, watermarks and invite tokens)
when they were the last member.

Related fixes in the same area:

- `createChat`, `updateGroupChat` and `acceptInviteLink` each set the `userIds` scalar array *and*
  used `connect`. Prisma maintains `userIds` from `connect` itself, so every membership change wrote
  each id twice.
- `generateInvite` threw plain `Error`s for "not a group" and "not the admin", which the controller
  swallowed into a generic 500. They carry a status now.
- The group-edit form posts `addUserIds[]` / `removeUserIds[]`. multer does not expand bracket
  notation, so the handler only ever saw its default empty arrays — **adding and removing members
  from the UI had never worked.** The client sends plain keys and the server reads both spellings.
- `POST /auth/send-otp` was declared POST and called with GET, so requesting an OTP always 404'd.

---

## 6. What this does not change

- **The `DeletedChat` watermark model stays exactly as designed.** Storing a per-user `deletedAt`
  and filtering messages by it — so deleting a conversation hides history for you without destroying
  it for the other party, and a resumed conversation keeps the old messages hidden — is the correct
  semantic and is not the obvious implementation. It was right and it is untouched.
- **Cursor pagination over offset pagination** was the right call; only the cursor's uniqueness was
  fixed.
- **Per-controller authorization** was already consistently enforced on every HTTP chat route. The
  gap was the socket layer, not the REST layer.
- **The sandbox-reset system** — nightly cron, backup/restore, fixed demo accounts so strangers can
  try the app without signing up — is a genuinely thoughtful piece of product engineering. Only its
  module-scope self-invocation was wrong.
- **No UI changed.** Every edit to the frontend is in the data layer: `lib/socket.ts`, the new
  `hooks/realtimeHooks.ts`, the API modules, and the subscription effects inside four components.
  No JSX, no Tailwind, no layout, no copy.

---

## 7. Verification performed

| Check | Result |
|---|---|
| `tsc --noEmit` (frontend) | clean |
| `vite build` | succeeds |
| `eslint src --ext .js` (backend) | clean |
| `prisma validate` | schema valid |
| `babel src -d build` | 29 files compiled |
| `npm test` | 17/17 — token expiry, legacy-token acceptance, forged/expired rejection, bearer parsing, `publicUser` redaction, compound-cursor round-trip |
| Boot against an unreachable DB | listens, `/healthz` → 503 `{"database":"down"}`, serves root, shuts down cleanly on SIGTERM |
| Socket handshake probes | no token / forged token / expired token / unknown user all refused; process survives all of them |
| HTTP probes | missing, junk and malformed `Authorization` all 401; 500s return a fixed message with no driver internals |
| Route table | duplicate `PUT /update/:chatId` gone; catch-all `GET /:chatId` registered last |

**Not verified:** no end-to-end run against a real MongoDB — no Mongo or Docker was available on
this machine. Everything touching live data (the transaction, the indexes, the compound cursor
against real rows, the migration script) is reasoned and compiled but not executed. Run
[`migration-notes.md`](migration-notes.md) against a copy of the database first.
