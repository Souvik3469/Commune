import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

const SANDBOX_EMAILS = [
  "user1@gmail.com",
  "user2@gmail.com",
  "user3@gmail.com",
  "user4@gmail.com",
  "user5@gmail.com",
];

async function backup() {
  const users = await prisma.user.findMany({
    where: { email: { in: SANDBOX_EMAILS } },
    include: {
      chats: {
        include: {
          messages: true,
          deletedChats: true,
          inviteTokens: true,
        },
      },
      groupChats: {
        include: {
          messages: true,
          deletedChats: true,
          inviteTokens: true,
        },
      },
      messages: true,
      MessageReadStatus: true,
      deletedChats: true,
    },
  });

  fs.writeFileSync("sandbox_backup.json", JSON.stringify(users, null, 2));

  console.log("✅ Sandbox backup created");
  await prisma.$disconnect();
}

backup();
