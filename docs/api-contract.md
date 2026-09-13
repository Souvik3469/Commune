# API Contract — Commune

Reconstructed from `backend/src/v1/routes/` and the controllers behind them. Base path: `/v1`.

**Auth:** `Authorization: Bearer <jwt>` on every route marked 🔒. The token payload is the bare user
id string (not a claims object) — see `deep-dive.html` §2.

**Realtime is not documented here.** Message fan-out goes over Ably channels (`chat-{chatId}`) and
call signalling over Socket.IO — see `deep-dive.html` §5 and §6.

---

## Auth — `/v1/auth`

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/register` | — | multipart; `profilePic` file field + profile fields |
| POST | `/login` | — | `{ email, password }` → JWT |
| POST | `/logout` | 🔒 | |
| POST | `/send-otp` | — | `{ email }` — writes an `Otp` row, emails the code |
| POST | `/verify-otp` | — | `{ email, otp }` |

Google OAuth is handled separately through Passport (`controllers/auth/googleAuth.js`) rather than
these routes.

⚠️ None of these have a dedicated rate limit — only the global 1000/15min limiter applies.

## Users — `/v1/user`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/my-details` | 🔒 | current user |
| GET | `/user-info` | 🔒 | another user's public profile |
| PATCH | `/update-profile` | 🔒 | multipart; `profilePic` → Cloudinary |
| GET | `/search` | 🔒 | global user search |
| POST | `/forgot/password` | — | issues a reset code |
| POST | `/verify/code` | — | |
| POST | `/reset/password` | — | |

## Chats & Messages — `/v1/chat`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/create` | 🔒 | multipart (`logo`); 1:1 or group |
| GET | `/get-chats` | 🔒 | chat list, with last message |
| GET | `/get-rooms` | 🔒 | |
| GET | `/:chatId` | 🔒 | single chat; **registered last** so it doesn't shadow the static paths above |
| PUT | `/update/:chatId` | 🔒 | admin-only. **Duplicate of the PATCH below** |
| PATCH | `/:chatId/update` | 🔒 | admin-only, same handler |
| DELETE | `/:chatId` | 🔒 | 1:1 → `DeletedChat` watermark. Group → leave. Admin → **403, cannot delete** () |
| PATCH | `/:chatId/remove-members` | 🔒 | admin-only |
| POST | `/:chatId/invite-link` | 🔒 | creates an `InviteToken` with `expiresAt` |
| POST | `/accept-invite/:inviteToken` | 🔒 | checks expiry + existing membership |
| POST | `/send` | 🔒 | `{ content, chatId, type, fileUrl }` — 403 unless sender is a member |
| GET | `/:chatId/messages` | 🔒 | **cursor paginated**, `?cursor=<ISO timestamp>`, page size 20 |
| GET | `/:chatId/unread` | 🔒 | returns a bare number |
| PUT | `/:chatId/status` | 🔒 | marks messages read |

### `GET /:chatId/messages` — the one worth detailing

```
GET /v1/chat/:chatId/messages?cursor=2026-01-04T10:33:12.004Z
```

```jsonc
{
  "messages": [ /* ≤20, newest first, each with sender {name, profilePic} */ ],
  "nextCursor": "2026-01-04T09:58:41.220Z"   // null when exhausted
}
```

- 404 if the chat doesn't exist **or** the caller isn't a member (deliberately indistinguishable).
- Filtered by the caller's `DeletedChat.deletedAt` watermark when one exists.
- Fetches `limit + 1` to derive `hasMore` without a second count query.
- ⚠️ Cursor is a timestamp, which is not unique under concurrent sends
- ⚠️ Response embeds the full `chat` object on every message

## Error shape

No envelope. Handlers return ad-hoc JSON — `{ error }` in some places, `{ message }` in others, and
the global handler emits `{ status, message }` with the raw `err.message`. Worth standardising;
