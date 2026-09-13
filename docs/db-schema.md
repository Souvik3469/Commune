# Database Schema — Commune

MongoDB via Prisma (`backend/prisma/schema.prisma`). Seven models.

```
User ──< Message >── Chat
 │         │            │
 │         └──< MessageReadStatus
 │                      │
 ├──< DeletedChat >─────┤
 │                      │
 └── (admin) ───────────┘
                        └──< InviteToken

Otp  (standalone, keyed by email)
```

## Models

### `User`
Identity and profile. `email` unique. Optional `googleId` for the OAuth path. `resetPasswordToken`
/ `resetPasswordExpiry` back the reset flow. `active` defaults `false`.

### `Chat`
One model for both 1:1 and group, discriminated by `isGroup`.

- **Membership** is a MongoDB many-to-many: `userIds[]` on `Chat`, `chatIds[]` on `User`.
- **Admin** is a separate single relation (`adminId`, named `"GroupChats"`) — exactly one admin per
  group, enforced structurally rather than by a role table.
- `lastModified` drives chat-list ordering.
- `messagesIds[]` duplicates the `Message.chatId` back-reference — the relationship is materialised
  in both directions and both can drift.

### `Message`
`content` (string), `type` (defaults `"text"`), `timestamp`, `senderId`, `chatId`. Cascade-deletes
with both sender and chat.

⚠️ File attachments are **not** modelled — `createMessage` appends the URL onto `content` as text.
The `type` column exists and would have carried this. `flaws.md` #16.

### `MessageReadStatus`
`(messageId, userId, readAt)`. Read state is **sparse** — a row exists only once read, so absence
means unread. Efficient representation; the query built on it is not (`flaws.md` #6).

Not declared unique on `(messageId, userId)`, so duplicate rows are possible.

### `DeletedChat`
The per-user deletion watermark. `@@unique([userId, chatId])`, with `deletedAt` as the cutoff.
Reads filter to `timestamp > deletedAt`. This is the best-designed piece of the schema — see
`deep-dive.html` §3 for why.

### `InviteToken`
`token` unique, `chatId`, `expiresAt`. Note `chatId` here is a plain `String`, not `@db.ObjectId`,
unlike every other foreign key in the schema.

### `Otp`
`email`, `otp`, `createdAt`. **No expiry column and no TTL index** — rows accumulate forever and
expiry is enforced in application code if at all.

---

## Indexes

**There are none.** The schema declares no `@@index` on any model.

The queries that need them:

| Query | Needed index |
|---|---|
| Messages for a chat, newest first (hottest path in the app) | `Message @@index([chatId, timestamp(sort: Desc)])` |
| Deletion watermark lookup | already covered by `@@unique([userId, chatId])` |
| Unread scan | `MessageReadStatus @@index([messageId, userId])` |
| Chat list ordering | `Chat @@index([lastModified])` |
| OTP cleanup | `Otp` TTL index on `createdAt` |

This is `flaws.md` #5, and it is the difference between a chat app that demos well and one that
stays usable at volume.
