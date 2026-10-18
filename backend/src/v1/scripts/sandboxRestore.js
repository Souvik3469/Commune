import path from "path";
import prisma from "../../prisma/index";
import fs from "fs";

// Resolved against the project root rather than the process working
// directory, which varies between `npm run dev` and `npm start`.
const BACKUP_FILE = path.resolve(__dirname, "../../../sandbox_backup.json");


async function restore() {
  console.log("♻️ Resetting sandbox users only...");

  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));

  const sandboxEmails = backup.map((u) => u.email);
  const sandboxUserIds = backup.map((u) => u.id);

  // Find chats that belong to sandbox users
  const sandboxChats = await prisma.chat.findMany({
    where: {
      userIds: {
        hasSome: sandboxUserIds,
      },
    },
    select: { id: true },
  });

  const sandboxChatIds = sandboxChats.map((c) => c.id);

  // Delete dependent data ONLY for sandbox users
  await prisma.messageReadStatus.deleteMany({
    where: { userId: { in: sandboxUserIds } },
  });

  await prisma.message.deleteMany({
    where: { chatId: { in: sandboxChatIds } },
  });

  await prisma.deletedChat.deleteMany({
    where: { userId: { in: sandboxUserIds } },
  });

  await prisma.chat.deleteMany({
    where: { id: { in: sandboxChatIds } },
  });

  // Delete sandbox users
  await prisma.user.deleteMany({
    where: { email: { in: sandboxEmails } },
  });

  // Recreate sandbox users
  for (const user of backup) {
    const {
      chats,
      groupChats,
      messages,
      MessageReadStatus,
      deletedChats,
      ...userData
    } = user;

    await prisma.user.create({
      data: {
        ...userData,
        id: user.id,
      },
    });
  }

  console.log("✅ Sandbox users reset completed safely");
}

/**
 * This module used to call `restore()` at module scope *and* export it. The
 * cron module imports it, so every server boot silently wiped and recreated
 * the sandbox accounts — and the `$disconnect()` that followed tore down the
 * connection pool the API had just started with.
 *
 * It now runs only when executed directly as a script.
 */
// Babel compiles this module to CommonJS, so `require.main` is the reliable
// "am I the entry point" check here.
if (require.main === module) {
  restore()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export default restore;
