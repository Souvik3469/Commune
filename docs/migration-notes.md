# Commune — Deploying the v2 changes

What has to happen to a live database and environment before this branch can serve traffic. Read it
all before starting; two steps are irreversible.

---

## 0. Prerequisite: the database must be a replica set

`createMessage` now wraps its writes in `prisma.$transaction`. Prisma's interactive transactions on
MongoDB **require a replica set**.

- **MongoDB Atlas** — already a replica set. Nothing to do.
- **A standalone local `mongod`** — transactions will be rejected with
  `Transactions are not supported by this deployment`. Start it with `--replSet rs0` and run
  `rs.initiate()` once, or use `mongodb-memory-server` / an Atlas dev cluster for local work.

---

## 1. Back up

```bash
mongodump --uri "$DATABASE_URL" --out ./backup-$(date +%F)
```

Step 3 deletes rows and renames usernames. Do not skip this.

---

## 2. Environment

**Remove** — no longer read by anything:

| Variable | Why |
|---|---|
| `ABLY_API_KEY` (backend) | Ably is gone; Socket.IO carries all realtime now. |
| `VITE_ABLY_API_KEY` (frontend) | Same — and this one was a **root key shipped in the bundle**, so treat it as compromised: revoke it in the Ably dashboard rather than just deleting the variable. |
| `CLIENT_ID`, `CLIENT_SECRET` (backend) | The Passport Google strategy was never registered; the files have been deleted. |

**Add:**

| Variable | Value |
|---|---|
| `ACCESS_TOKEN_TTL` | Optional, defaults to `7d`. |
| `FRONTEND_URL` | Was already read by the invite-link builder but missing from `.env.example`. |

**Check:** `USER_ACCESS_SECRET` must be set — the app now throws at token-signing time if it is
not, rather than silently signing with `undefined`.

---

## 3. Data cleanup — run *before* `prisma db push`

Three new constraints can be violated by existing documents. `db push` fails rather than dropping
data, so the conflicts have to be resolved first.

| Constraint | Conflict it can hit |
|---|---|
| `MessageReadStatus @@unique([messageId, userId])` | Duplicate read receipts. `updateMessageStatus` inserted a fresh row on every chat re-open. |
| `User.username @unique` | Colliding usernames from the old `@${name}${count + 1}` minting scheme. |
| `InviteToken.chatId @db.ObjectId` | Values stored as plain strings. |

```bash
npm run migrate:cleanup              # REPORT ONLY — writes nothing
```

Read the report. It prints every row it would delete and every username it would rename. Then:

```bash
npm run migrate:cleanup -- --apply
```

What `--apply` does:

- **Read receipts** — keeps the first row of each duplicated `(messageId, userId)` pair, deletes the
  rest. No information is lost: the rows are identical apart from `_id` and `readAt`.
- **Usernames** — the oldest account keeps the name; the others get a random four-digit suffix.
  **Users whose username changes are not notified.** If any of them matter, check the report and
  tell them.
- **Invite tokens** — converts string `chatId`s to `ObjectId`. Tokens whose `chatId` is not a valid
  24-character hex string are deleted, because they could never have resolved to a chat anyway.

---

## 4. Apply the schema

```bash
npx prisma db push
npx prisma generate
```

This creates the indexes in [`db-schema-v2.md`](db-schema-v2.md). On a large `Message` collection
the compound index build takes a while; MongoDB builds it in the background, so the app stays
available.

---

## 5. Deploy order

**Backend first, then frontend.** The backend keeps accepting the old bare-string JWTs and the old
`addUserIds[]` form keys, so an old frontend keeps working against a new backend. The reverse is not
true — a new frontend expects the authenticated socket handshake and the `chat:message` event, which
an old backend does not serve.

```bash
# backend
npm ci && npm run build && npm start

# frontend
npm ci && npm run build
```

---

## 6. Verify

```bash
curl https://<api>/healthz      # {"status":"ok","database":"up"}
```

Then, signed in:

1. Send a message — it should appear for the **recipient** in both the open thread and their sidebar
   preview, without a reload. That is the fix for the client-published `new-message` event.
2. Watch the browser's network panel: there should be **one** WebSocket, not one per visible chat.
3. Scroll a long thread to the top — paging should not skip or repeat messages.
4. Add and remove a group member from the edit dialog — this had never worked before.
5. Leave a group as its admin — ownership should transfer instead of being refused.
6. Open devtools and confirm no Ably key appears in the bundle.

---

## 7. Rolling back

The code rolls back cleanly — the previous build runs against the migrated schema, because every
schema change is additive apart from the three constraints, and extra indexes do not break the old
queries.

The **data** changes do not roll back. Deleted duplicate receipts and renamed usernames stay as they
are. That is what the backup in step 1 is for.

---

## 8. Known gaps

- **Nothing here has been exercised against a real MongoDB.** No Mongo or Docker was available on
  the machine where these changes were made. The schema validates, the code compiles, lints, unit
  tests pass and the server boots and survives an unreachable database — but the transaction, the
  indexes, the compound cursor against real rows and this migration script have not been run.
  **Rehearse on a restored copy of production before touching production.**
- `InviteToken.usedAt` is in the schema but not yet written by `acceptInviteLink`; single-use
  invites remain a follow-up.
- The frontend bundle is ~974 kB, over Vite's warning threshold. Pre-existing, unrelated, worth
  code-splitting later.
