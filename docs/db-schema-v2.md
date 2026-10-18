# Commune — Database Schema (v2)

Current state after the October 2026 pass. [`db-schema.md`](db-schema.md) describes the original
schema, including the indexes it was missing, and is kept as the historical record.

MongoDB via Prisma. Seven models, unchanged in shape — what changed is indexes, uniqueness, two
field types and three new fields.

---

## Index summary

Nothing in the original schema declared an index. These are the ones the query patterns actually
need.

| Model | Index | Serves |
|---|---|---|
| `Message` | `@@index([chatId, timestamp(sort: Desc), id(sort: Desc)])` | `getMessagesByChat` — the hottest query in the app. Covers the `chatId` filter, the `timestamp desc` sort and the `id` tiebreaker the compound cursor needs. |
| `Message` | `@@index([senderId])` | Cascade deletes when a user is removed. |
| `Chat` | `@@index([userIds, isGroup, lastModified(sort: Desc)])` | `getChats` and `getRooms`. Multikey on MongoDB, because `userIds` is an array. |
| `DeletedChat` | `@@unique([userId, chatId])` | Watermark lookup. Pre-existing. |
| `DeletedChat` | `@@index([chatId])` | Cascade on chat deletion. |
| `MessageReadStatus` | `@@unique([messageId, userId])` | **New constraint.** One receipt per reader per message. |
| `MessageReadStatus` | `@@index([userId])` | Unread counts. |
| `InviteToken` | `@unique` on `token` | Pre-existing. |
| `InviteToken` | `@@index([chatId])` | Invite cleanup on group deletion. |
| `User` | `@unique` on `email` | Pre-existing. |
| `User` | `@unique` on `username` | **New constraint.** |
| `User` | `@@index([name])` | `searchUsers`. |
| `Otp` | `@@index([email])` | OTP lookup and cleanup. |

---

## Changes by model

### `User`

| Change | Why |
|---|---|
| `username` → `@unique` | Usernames were minted as `@${name}${countOfUsersWithThatName + 1}`, a read-then-write race that collides whenever two accounts share a display name. |
| `+ resetPasswordTries Int @default(0)` | Caps password-reset code guesses. There was no ceiling. |
| `+ @@index([name])` | `searchUsers` filters on `name`. |

`password`, `resetPasswordToken`, `resetPasswordExpiry`, `resetPasswordTries` and `googleId` are
never returned by the API — see `src/v1/utils/publicUser.js`.

### `Message`

| Change | Why |
|---|---|
| `+ fileUrl String?` | Attachments were concatenated onto `content` as a newline-separated string, so they could not be queried, listed or rendered distinctly without parsing message bodies. The `type` column that should have carried this already existed. |
| `+ @@index([chatId, timestamp desc, id desc])` | The paging query was a collection scan plus an in-memory sort. |
| `+ @@index([senderId])` | Supports the cascade on user deletion. |

`logo String?` remains and remains unused; it is left in place rather than dropped, since removing
a field is a destructive migration for no functional gain.

### `MessageReadStatus`

| Change | Why |
|---|---|
| `+ @@unique([messageId, userId])` | `updateMessageStatus` inserted with `createMany` and nothing prevented duplicates, so re-opening a chat added another receipt each time and the unread count drifted. |
| `+ @@index([userId])` | Unread-count queries filter by reader. |

### `InviteToken`

| Change | Why |
|---|---|
| `chatId String` → `chatId String @db.ObjectId` | It pointed at `Chat.id`, which is an `ObjectId`, while being stored as a plain string. The relation and the stored BSON type disagreed. |
| `+ usedAt DateTime?` | Lets a one-time invite be marked rather than deleted, so "already used" can be distinguished from "never existed". |
| `+ @@index([chatId])` | Invite cleanup when a group is deleted. |

### `Otp`

| Change | Why |
|---|---|
| `+ expiresAt DateTime` | OTPs never expired. A six-digit numeric code that stays valid indefinitely is a few thousand requests from guessed. |
| `+ tries Int @default(0)` | No attempt ceiling existed. |
| `+ @@index([email])` | Every OTP query is by email. |

### `Chat`, `DeletedChat`

Shape unchanged; indexes added as above. The `DeletedChat` watermark design is deliberately
untouched — it is the best-designed part of the original schema.

---

## Applying this

The three new constraints can be violated by existing data, and `prisma db push` fails rather than
dropping rows. Run the cleanup first:

```bash
npm run build
npm run migrate:cleanup            # report only — writes nothing
npm run migrate:cleanup -- --apply
npx prisma db push
```

Full procedure, including the backup step, in [`migration-notes.md`](migration-notes.md).
