/**
 * One-off data cleanup that has to run BEFORE `prisma db push` applies the new
 * schema. Three of the schema changes add constraints that existing documents
 * can violate, and `db push` fails rather than silently dropping data:
 *
 *   1. MessageReadStatus gains @@unique([messageId, userId]).
 *      `updateMessageStatus` used `createMany` with no uniqueness backing it,
 *      so re-opening a chat inserted a fresh read-receipt row every time.
 *
 *   2. User.username gains @unique.
 *      Usernames were minted as `@${name}${countOfUsersNamedThat + 1}`, which
 *      collides whenever two accounts share a display name.
 *
 *   3. InviteToken.chatId gains @db.ObjectId.
 *      It was declared as a plain String while pointing at Chat.id, which is
 *      an ObjectId, so the values are stored with the wrong BSON type.
 *
 * Usage:
 *   npm run build
 *   npm run migrate:cleanup           # report only, writes nothing
 *   npm run migrate:cleanup -- --apply
 *   npx prisma db push                # then create the new indexes
 *
 * Take a database backup first. Run the report, read it, then apply.
 */
import crypto from "crypto";
import prisma from "../../prisma/index";

const APPLY = process.argv.includes("--apply");

const log = (...args) => console.log(...args);
const action = (msg) => log(`  ${APPLY ? "APPLIED" : "WOULD APPLY"}: ${msg}`);

async function dedupeReadStatus() {
  log("\n1. MessageReadStatus duplicates");
  const groups = await prisma.$runCommandRaw({
    aggregate: "MessageReadStatus",
    pipeline: [
      {
        $group: {
          _id: { messageId: "$messageId", userId: "$userId" },
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ],
    cursor: {},
  });

  const batch = groups?.cursor?.firstBatch || [];
  if (!batch.length) {
    log("  none — the unique index can be created as-is");
    return;
  }

  // Keep the first row of each group, drop the rest.
  const toDelete = batch.flatMap((group) => group.ids.slice(1));
  log(`  ${batch.length} duplicated (messageId, userId) pairs`);
  action(`delete ${toDelete.length} redundant read-receipt rows`);

  if (APPLY) {
    await prisma.$runCommandRaw({
      delete: "MessageReadStatus",
      deletes: [{ q: { _id: { $in: toDelete } }, limit: 0 }],
    });
  }
}

async function dedupeUsernames() {
  log("\n2. Duplicate usernames");
  const groups = await prisma.$runCommandRaw({
    aggregate: "User",
    pipeline: [
      { $match: { username: { $ne: null } } },
      { $group: { _id: "$username", ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ],
    cursor: {},
  });

  const batch = groups?.cursor?.firstBatch || [];
  if (!batch.length) {
    log("  none — the unique index can be created as-is");
    return;
  }

  for (const group of batch) {
    // The oldest account keeps the name; the rest get a suffix.
    const [, ...rest] = group.ids;
    log(`  "${group._id}" is held by ${group.count} accounts`);
    for (const id of rest) {
      const suffixed = `${group._id}${crypto.randomInt(1000, 9999)}`;
      action(`rename one account to "${suffixed}"`);
      if (APPLY) {
        await prisma.$runCommandRaw({
          update: "User",
          updates: [{ q: { _id: id }, u: { $set: { username: suffixed } } }],
        });
      }
    }
  }
}

async function fixInviteTokenChatIds() {
  log("\n3. InviteToken.chatId stored as a string rather than an ObjectId");
  const found = await prisma.$runCommandRaw({
    find: "InviteToken",
    filter: { chatId: { $type: "string" } },
    limit: 1000,
  });

  const docs = found?.cursor?.firstBatch || [];
  if (!docs.length) {
    log("  none — every chatId is already an ObjectId");
    return;
  }

  log(`  ${docs.length} invite tokens to convert`);
  action(`rewrite ${docs.length} chatId values as ObjectIds`);

  if (APPLY) {
    // $toObjectId throws on a malformed string, so convert only valid ones and
    // drop invite tokens whose chatId could never have resolved anyway.
    const valid = docs.filter((d) => /^[0-9a-fA-F]{24}$/.test(d.chatId));
    const invalid = docs.filter((d) => !/^[0-9a-fA-F]{24}$/.test(d.chatId));

    for (const doc of valid) {
      await prisma.$runCommandRaw({
        update: "InviteToken",
        updates: [
          {
            q: { _id: doc._id },
            u: [{ $set: { chatId: { $toObjectId: "$chatId" } } }],
          },
        ],
      });
    }
    if (invalid.length) {
      log(`  dropping ${invalid.length} invite tokens with an unparseable chatId`);
      await prisma.$runCommandRaw({
        delete: "InviteToken",
        deletes: [{ q: { _id: { $in: invalid.map((d) => d._id) } }, limit: 0 }],
      });
    }
  }
}

async function main() {
  log(
    APPLY
      ? "Running pre-push cleanup in APPLY mode — this writes to the database."
      : "Running pre-push cleanup in REPORT mode — nothing will be written.\n" +
          "Re-run with --apply once the report looks right."
  );

  await dedupeReadStatus();
  await dedupeUsernames();
  await fixInviteTokenChatIds();

  log(
    APPLY
      ? "\nDone. Now run `npx prisma db push` to create the new indexes."
      : "\nReport complete. No changes were made."
  );
}

main()
  .catch((err) => {
    console.error("\nCleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
