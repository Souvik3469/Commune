# Commune — API & Realtime Contract (v2)

Current contract. [`api-contract.md`](api-contract.md) describes the original and is kept as the
historical record.

Base path `/v1`. Authenticated routes expect `Authorization: Bearer <accessToken>`.

**Breaking changes from v1 are marked ⚠.**

---

## Auth — `/v1/auth`

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/register` | — | multipart, optional `profilePic`. ⚠ Returns **201**, and the user object no longer contains `password`. |
| `POST` | `/login` | — | |
| `POST` | `/logout` | ✓ | |
| `POST` | `/send-otp?email=` | — | ⚠ The client was calling this with `GET`, which always 404'd. |
| `POST` | `/verify-otp?email=` | — | ⚠ Codes now expire after 10 minutes and allow 5 attempts. |

**Access tokens.** ⚠ Tokens now expire (`ACCESS_TOKEN_TTL`, default `7d`) and carry an object
payload `{ sub, typ: "access" }`. Tokens issued before this change — bare-string payloads with no
expiry — are still accepted, so no one is logged out by the deploy.

**Rate limits.** `login` and `register`: 10 per 15 minutes. `verify-otp`: 5 per 15 minutes.
`send-otp`: 5 per hour. Keyed on the targeted email where one is present, otherwise the IP.

---

## User — `/v1/user`

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/my-details` | ✓ | ⚠ No longer returns `password`, `resetPasswordToken`, `resetPasswordExpiry` or `googleId`. |
| `GET` | `/user-info?userId=` | ✓ | ⚠ 404s for an unknown user instead of returning `null` with a 200. ⚠ No longer exposes `email`. |
| `PATCH` | `/update-profile` | ✓ | multipart. ⚠ `email` is no longer updatable here — it is the login identifier and the reset channel, so it needs its own verified flow. `gender` now actually updates; it previously read from a key that was never set. |
| `GET` | `/search?query=` | ✓ | ⚠ Capped at 25 results and excludes the caller. Was unbounded. |
| `POST` | `/forgot/password` | — | ⚠ Returns the same 200 whether or not the account exists. Returns **502** if the email could not be sent, instead of reporting success for mail that never left. |
| `POST` | `/verify/code` | — | `{ email, resetCode }` |
| `POST` | `/reset/password` | — | ⚠ **Now requires `resetCode`.** Body is `{ email, resetCode, newPassword }`. It previously accepted `{ email, newPassword }` and only checked that *some* unexpired code existed on the account without ever comparing the caller's — anyone who knew an email that had requested a reset could set that account's password. |

Passwords must be at least 8 characters on register, update and reset.

---

## Chat — `/v1/chat`

All routes require auth.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/create` | multipart, optional `logo`. ⚠ Rejects a self-chat, a direct chat with no counterpart, a group with no other member, and unknown user ids. |
| `GET` | `/get-chats` | Direct chats. ⚠ Now one query for all watermarks instead of one per chat. |
| `GET` | `/get-rooms` | Group chats. |
| `GET` | `/:chatId` | ⚠ A chat hidden by your deletion watermark returns **404**, not the old `204` with a body (which is not a valid response and Express dropped). |
| `PATCH` | `/:chatId/update` | multipart. ⚠ `addUserIds` / `removeUserIds` — the client was sending `addUserIds[]`, which multer does not expand, so member changes had never taken effect. Both spellings are accepted. The admin cannot be removed from their own group. |
| `PATCH` | `/:chatId/remove-members` | `{ userIds }`. ⚠ The admin cannot remove themselves. |
| `DELETE` | `/:chatId` | ⚠ An admin leaving a group now transfers it to another member, or deletes it outright if they were the last. It previously refused outright, making abandoned groups undeletable. |
| `POST` | `/send` | `{ chatId, content?, fileUrl?, type? }`. ⚠ `fileUrl` is its own field; it used to be concatenated onto `content`. ⚠ Requires text or an attachment. |
| `GET` | `/:chatId/messages?cursor=` | See pagination below. |
| `GET` | `/:chatId/unread` | ⚠ Excludes your own messages and respects your deletion watermark. Implemented as a `count`; it previously fetched every unread row to call `.length` on it. |
| `PUT` | `/:chatId/status` | Mark read. ⚠ Idempotent — it used to insert a duplicate receipt per call. |
| `POST` | `/:chatId/invite-link` | ⚠ Returns **403** for a non-admin and **400** for a non-group; both used to surface as 500. |
| `POST` | `/accept-invite/:inviteToken` | |

⚠ **`PUT /update/:chatId` has been removed.** It was a duplicate of `PATCH /:chatId/update`. The
client already used the `PATCH` form.

### Pagination

⚠ The cursor is now compound: `"<iso timestamp>_<message id>"`.

```json
{ "messages": [ ... ], "nextCursor": "2026-10-18T04:15:30.123Z_671f3a9b2c4d5e6f70819293" }
```

A bare timestamp was not unique — two messages written in the same millisecond, ordinary in a group
chat, could be skipped or duplicated at a page boundary. Legacy timestamp-only cursors are still
accepted; a malformed cursor is a 400.

⚠ Messages no longer embed the full `chat` object. The previous response serialised the same chat
onto all twenty messages. ⚠ `sender` now includes `profilePic`.

---

## Realtime (Socket.IO)

⚠ **Ably is gone.** Messages, typing and call signalling all run over one authenticated Socket.IO
connection per tab. `VITE_ABLY_API_KEY` and `ABLY_API_KEY` are no longer used and should be removed
from your environment — the frontend key was a root key readable from the bundle.

### Handshake

```js
io(BASE_URL, { auth: { token: localStorage.getItem("accessToken") } })
```

⚠ The handshake is authenticated. There is **no `register` event** — it used to set
`socket.data.userId` from the client's own payload, which let anyone join another user's room and
answer their calls. On connect the server joins the socket to `user:<id>` and to `chat:<id>` for
every chat the user belongs to.

### Client → server

| Event | Payload | Notes |
|---|---|---|
| `chat:subscribe` | `{ chatId }` | For a chat created or joined after connect. Membership is checked. Acks `{ ok }`. |
| `chat:unsubscribe` | `{ chatId }` | |
| `typing` | `{ chatId, typing }` | ⚠ No identity in the payload — the server stamps it. |
| `join` | `{ roomId }` | Call room. ⚠ Membership is checked; `userId` is no longer read from the payload. |
| `leave` | `{ roomId }` | |
| `offer` | `{ roomId?, to?, offer, video }` | ⚠ `from`, `callerName` and `callerAvatar` are no longer sent — they were forwarded unverified, so a caller could present as anyone. |
| `answer` | `{ roomId?, to?, answer }` | ⚠ `from` removed. |
| `candidate` | `{ roomId?, to?, candidate }` | |
| `end-call` | `{ roomId?, to? }` | |

### Server → client

| Event | Payload |
|---|---|
| `chat:message` | The persisted message, including `chatId` and `sender.profilePic`. Emitted **after** the write transaction commits. |
| `typing` | `{ chatId, typing, userId, userName }` — all server-derived. |
| `chat:read` | `{ chatId, userId }` |
| `chat:updated` | `{ chatId }` — membership or metadata changed; refetch. |
| `offer` / `answer` / `candidate` / `end-call` | Signalling, with a server-stamped `from`. |

⚠ The old client-published `new-message` event is gone. It was published by the *sender's* browser
for the sidebar preview, so a recipient's chat list never updated until they reloaded.

---

## Errors

⚠ Unexpected 5xx responses return a fixed message:

```json
{ "status": 500, "message": "Something went wrong. Please try again later." }
```

The handler previously returned `err.message` verbatim, which leaks driver and query internals. 4xx
messages are still specific and still pass through.

## Other

- `GET /healthz` — ⚠ new. Pings the database; `200 {"status":"ok"}` or `503 {"status":"degraded"}`.
- Uploads — ⚠ capped at 5 MB and restricted to JPEG, PNG, WebP and GIF. There was no size or type
  limit.
