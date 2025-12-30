import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function restore() {
  console.log("♻️ Resetting sandbox users only...");

  const backup = JSON.parse(fs.readFileSync("sandbox_backup.json", "utf-8"));

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
  await prisma.$disconnect();
}

restore().catch(console.error);

export default restore;
