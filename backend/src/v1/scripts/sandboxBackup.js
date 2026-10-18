import path from "path";
import prisma from "../../prisma/index";
import fs from "fs";

const BACKUP_FILE = path.resolve(__dirname, "../../../sandbox_backup.json");


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

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(users, null, 2));

  console.log("✅ Sandbox backup created");
  await prisma.$disconnect();
}

// Runs only when executed directly, not on import.
// Babel compiles this module to CommonJS, so `require.main` is the reliable
// "am I the entry point" check here.
if (require.main === module) {
  backup()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export default backup;
