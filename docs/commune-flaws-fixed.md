# Commune — Flaws, Fixed

**Status: fixed, October 2026.** Companion to [`commune-flaws.md`](commune-flaws.md), which recorded the
codebase as it stood and deliberately changed nothing. This document records what was actually
done about each item, what was found on the way that the original audit missed, and what is still
outstanding.

Branch: `fix/arch-and-logic-flaws`. Architecture write-up in the repo at
`docs/architecture-v2.md`; the original `docs/commune-deep-dive.html` is kept untouched.

---

## Scorecard

| | |
|---|---|
| Items in the original audit | 23 (one already fixed) |
| Fixed here | 21 |
| Deliberately not fixed | 1 (#22 was already done) |
| **New defects found while fixing** | **14** |
| Of those, more severe than anything in the original audit | 4 |

---

## 🔴 The four that were worse than anything in the audit

These were not in `commune-flaws.md`. Each is more serious than the items that were.

### A. The Ably root key was shipped in the frontend bundle

```ts
const ably = new Ably.Realtime(import.meta.env.VITE_ABLY_API_KEY!);
```

A `VITE_`-prefixed variable is inlined into the bundle by Vite. This was not a scoped token — it
was the root API key, with publish and subscribe rights on every channel in the account. Anyone who
opened devtools could read the live traffic of **every conversation in the system** and publish
messages that the UI would render as genuine, attributed to anyone.

The original audit flagged the two-transport split (#8) as an architectural smell and a cost
concern. It is not a smell. It was a full compromise of message confidentiality and integrity.

**Fixed:** Ably removed from both halves of the app. Socket.IO, which was already running and
already handled rooms, carries messages and typing now. The key no longer exists.
**Rotate it anyway** — it was public for as long as the app was deployed.

### B. Password reset never checked the reset code

```js
if (!user || !user.resetPasswordToken || user.resetPasswordExpiry < new Date()) {
  return res.status(400).json({ message: "Invalid or expired reset code" });
}
// ...then sets the new password. The caller's code is never compared.
```

`resetPassword` accepted `{ email, newPassword }` and asserted only that *some* unexpired reset code
existed on the account. It never compared it to anything the caller supplied. Anyone who could
trigger a reset for an address — which `forgotPassword` lets anyone do — could then set that
account's password without ever seeing the code.

`verifyResetCode` existed and did check the code, but it was a separate endpoint with no binding to
the reset. Checking it was advisory.

**Fixed:** `resetPassword` requires `resetCode`, compares it in constant time, enforces a 5-attempt
ceiling and clears the code on use. The endpoint is not reachable from the UI, so tightening the
contract broke nothing.

### C. Every access token was valid forever

```js
const accessToken = jwt.sign(user.id, process.env.USER_ACCESS_SECRET);
```

A bare string payload cannot carry an `exp` claim. Not "a long expiry" — no expiry. Every token
ever issued by this app is still valid. The 30-minute `maxAge` on the cookie was cosmetic, because
the frontend reads the token from the response body and stores it in `localStorage`.

**Fixed:** object payload with `expiresIn` (default 7 days). Legacy bare-string tokens still verify,
so the deploy does not log anyone out — but they should be aged out deliberately once traffic has
rolled over.

### D. The sandbox reset ran on every server boot, then killed the connection pool

```js
restore().catch(console.error);   // module scope
export default restore;           // and exported
```

`sandboxReset.cron.js` imports `restore` to schedule it. Importing the module executes its body. So
**every single server start wiped and recreated the sandbox accounts and all their chats** — not
the nightly 00:00 tick, every boot, every deploy, every nodemon reload.

It then called `prisma.$disconnect()`, tearing down the connection pool the API had just started
with.

**Fixed:** all three sandbox scripts run only when executed directly (`require.main === module`),
and resolve their backup file relative to the project root rather than the process working
directory. `$disconnect` only happens on the direct-run path.

---

## The original 23

### 🔴 Critical

| # | Item | What was done |
|---|---|---|
| 1 | Socket.IO had no authentication | `io.use()` verifies the same JWT the HTTP routes do and puts the id on `socket.data`. The `register` event is **gone** — it set identity from the client's own payload. `join` and the new `chat:subscribe` check chat membership against the database. The handshake fails closed when the database is unreachable. |
| 2 | WebRTC signalling trusted a client-supplied `from` | `from`, `callerName` and `callerAvatar` are stamped server-side for `offer`, `answer`, `candidate` and `end-call`. The client no longer sends them at all. |
| 3 | Socket.IO CORS was `origin: "*"` with `credentials: true` | The socket server reuses the HTTP allow-list. |
| 4 | Hardcoded session secret `"commune"` | **Removed entirely** rather than given a secret. `express-session` and Passport existed only for a Google strategy that was never registered — `passport.js` was imported by nothing. Both files deleted, both packages pruned. |

### 🟠 High

| # | Item | What was done |
|---|---|---|
| 5 | No indexes anywhere | `Message @@index([chatId, timestamp desc, id desc])` — covers the filter, the sort and the new cursor tiebreaker. Plus multikey `Chat([userIds, isGroup, lastModified desc])`, `MessageReadStatus`, `DeletedChat`, `InviteToken`, `Otp`, `User(name)`. |
| 6 | Unread count fetched every row to call `.length` | `prisma.message.count()`. Also now excludes your own messages — they were being counted as unread *to you* — and respects your deletion watermark. |
| 7 | Two Prisma clients | It was six: `chat.js`, `auth.js`, `user.js`, `InviteLink.js` and all three sandbox scripts. All import the singleton, which is also cached on `globalThis` in dev so nodemon does not leak a pool per reload. |
| 8 | Two realtime providers | Ably removed. See **A** — this was the security hole, not just the smell. Also: `ChatRow` opened a connection **per rendered row**, so a twelve-chat sidebar held ~15 WebSockets per tab. Now one. |
| 9 | Message write path had no transaction | The three writes that must agree are one `$transaction`, and the realtime publish happens **after** it commits. Requires a replica set — Atlas is one. |

### 🟡 Medium

| # | Item | What was done |
|---|---|---|
| 10 | Global rate limit was no rate limit | Per-route: 10/15min on credentials, 5/15min on code verification, 5/hour on outbound email, keyed on the targeted email rather than only the IP. |
| 11 | `include: { chat: true }` on every message | Dropped. `sender.profilePic` added instead — it was missing from the realtime payload, so live messages rendered the default avatar until the next refetch. |
| 12 | Cursor on a non-unique timestamp | Compound `"<iso>_<id>"`. Legacy cursors still accepted; malformed ones are a 400 rather than a silent page from epoch. |
| 13 | Fragile object-spread in the `where` clause | Built once, explicitly. The two spreads both wrote `timestamp`; the second silently overwrote the first and was correct only by accident. |
| 14 | `createMany` called with a single object | `create()`, inside the transaction. |
| 15 | A group's admin could never delete the group | An admin leaving transfers ownership to the longest-standing remaining member, or deletes the group and its messages, receipts, watermarks and invites if they were the last. |
| 16 | File uploads appended to message text | `Message.fileUrl` is its own column; `type` defaults to `"file"` when one is present. |

### 🟢 Low / hygiene

| # | Item | What was done |
|---|---|---|
| 17 | Heavy unused dependency surface | 21 packages pruned, including the **`socket-io` typosquat** sitting next to `socket.io`, deprecated `xss-clean`, and `https@1.0.0` — an npm stub shadowing a Node builtin. 16 dependencies remain, all imported. |
| 18 | Mongoose alongside Prisma | Removed. |
| 19 | Error handler leaked internals | 5xx returns a fixed message and logs the detail. 4xx still pass through. Verified: a 500 against a dead database returns 72 bytes with no driver text. |
| 20 | `console.log("Connected to MONGODB")` asserted something never checked | Replaced with a real `prisma.$runCommandRaw({ ping: 1 })` at boot, plus a `/healthz` endpoint. Verified returning `503 {"database":"down"}` against an unreachable database. |
| 21 | Duplicate routes to the same handler | `PUT /update/:chatId` removed; the client already used the `PATCH` form. The catch-all `GET /:chatId` is now registered last so it cannot shadow sibling paths. |
| 22 | README attributed to someone else | Already fixed 2026-09-13. Untouched. |
| 23 | README claimed features the code contradicts | Docs table updated to point at the v2 documents. |

---

## The other ten new defects

Found while fixing the above. Ordered by how much they mattered.

| | Defect | Consequence |
|---|---|---|
| E | **`myDetails` and `register` returned the bcrypt hash** and the live `resetPasswordToken`. `authMiddleware` loaded the whole user row, so every controller held them too. | Password hashes and a live reset credential went to the client on ordinary requests. Fixed with a `publicUser` projection and a `select` in the middleware. |
| F | **`EmailService` registered no `error` listener** on its outbound HTTPS request. | An unhandled `error` event on a Node stream is thrown — a DNS failure at the mail provider crashed the API. Now resolves a boolean, with a timeout. |
| G | **Async Socket.IO handlers crashed the process.** Socket.IO does not catch rejections from async listeners. | Found by booting the server against an unreachable database and watching it die — in code written during this very fix. All async listeners wrapped; `unhandledRejection` guard added. |
| H | **Adding and removing group members had never worked.** The client posts `addUserIds[]`; multer does not expand bracket notation, so the handler only ever saw its default `[]`. | A visible feature was silently inert. Client sends plain keys; server reads both spellings. |
| I | **`POST /auth/send-otp` was called with `GET`.** | OTP requests always 404'd. |
| J | **The sidebar preview only updated for the sender.** The composer published a client-side `new-message`; the server published `message`; `AllChats` listened for `new-message`. | Recipients' chat lists never moved until reload. The server now fans out the persisted message. |
| K | **`typing: false` was ignored in `ChatRow`** — the handler never read the flag. | Indicators only ever cleared by timeout. |
| L | **`updateUser` could never update `gender`.** It read `gender` into a local object, then assigned from `dataToUpdate.gender`, which was never set. | Dead field. Also: `email` was updatable without verification, on the login identifier. |
| M | **Membership writes doubled every id.** `createChat`, `updateGroupChat` and `acceptInviteLink` set the `userIds` scalar array *and* used `connect`; Prisma maintains `userIds` from `connect` itself. | Duplicate ids in every chat's member array. |
| N | **Uploads had no size or type limit**, and `getChats` ran one watermark query per chat (N+1). Plus: `generateInvite`'s 403 surfaced as a 500; `getChatById` returned a `204` with a body; `searchUsers` was unbounded; `forgotPassword` 404'd for unknown emails (account enumeration) and reported success for mail that silently failed; `sendOTP`'s cleanup `deleteMany` was never awaited; OTPs had no expiry or attempt ceiling. | All fixed. |

---

## Verified

| Check | Result |
|---|---|
| `tsc --noEmit`, `vite build` | clean / succeeds |
| `eslint` (backend) | clean — and the config was **missing**, so `npm run lint` had never run |
| `prisma validate`, `babel src -d build` | valid / 29 files |
| `npm test` | **17/17** — a new suite; the project had none |
| Boot against an unreachable DB | listens, `/healthz` → 503, survives every probe, shuts down cleanly on SIGTERM |
| Socket handshake probes | no token / forged / expired / unknown user — all refused |
| HTTP probes | missing, junk and malformed `Authorization` → 401; 500s leak nothing |
| Route table | duplicate gone, catch-all last |

**Not verified:** no run against a real MongoDB — none was available. The transaction, the indexes,
the compound cursor against real rows and the migration script are reasoned and compiled but not
executed. `docs/migration-notes.md` says to rehearse on a restored copy first.

---

## Still outstanding

- `InviteToken.usedAt` exists in the schema but `acceptInviteLink` does not write it — single-use
  invites are a follow-up.
- No integration tests. The 17 unit tests cover tokens, redaction and the cursor; nothing covers a
  request against a database.
- The frontend bundle is ~974 kB. Pre-existing and unrelated, but worth code-splitting.
- Legacy no-expiry JWTs are still accepted for compatibility. They should be cut off deliberately
  once traffic has rolled over.
- The `Message.logo` column remains unused. Left in place — dropping a field is a destructive
  migration for no functional gain.

---

## What was right, and stayed right

Restating from `commune-flaws.md`, because a fix list with no counterweight is as misleading as an audit
with none:

- **The `DeletedChat` watermark is genuinely well designed** and is untouched. A per-user `deletedAt`
  that hides history for you without destroying it for the other party, and keeps it hidden when the
  conversation resumes, is the correct semantic and is not the obvious implementation.
- **Cursor pagination over offset pagination** was the right call. Only the cursor's uniqueness
  needed fixing.
- **HTTP authorization was consistently enforced** in every chat controller. The gap was the socket
  layer, not the REST layer — and that distinction is why the fix was contained.
- **The sandbox system** — nightly reset, backup/restore, fixed demo accounts so strangers can try
  the app without signing up — is a thoughtful piece of product engineering. Only its module-scope
  self-invocation was wrong.
- **No UI was changed.** Every frontend edit is in the data layer: `lib/socket.ts`, a new
  `hooks/realtimeHooks.ts`, the API modules and the subscription effects inside four components. No
  JSX, no Tailwind, no layout, no copy.
