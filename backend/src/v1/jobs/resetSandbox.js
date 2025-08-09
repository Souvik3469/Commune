/* Commented bcoz of external cron job */

// import { PrismaClient } from "@prisma/client";
// import cron from "node-cron";
// import fs from "fs";

// const prisma = new PrismaClient();
// const SANDBOX_EMAILS = [
//   "user1@gmail.com",
//   "user2@gmail.com",
//   "user3@gmail.com",
//   "user4@gmail.com",
//   "user5@gmail.com",
// ];

// // 12:00 AM IST = 18:30 UTC (server uses UTC)
// cron.schedule("30 18 * * *", async () => {
//   console.log("♻ Resetting sandbox users...");

//   // Load snapshot of just profile data
//   const backupData = JSON.parse(fs.readFileSync("sandbox_backup.json", "utf8"));

//   // Step 1: Get sandbox user IDs
//   const sandboxUsers = await prisma.user.findMany({
//     where: { email: { in: SANDBOX_EMAILS } },
//     select: { id: true },
//   });
//   const userIds = sandboxUsers.map((u) => u.id);

//   // Step 2: Delete related data
//   await prisma.messageReadStatus.deleteMany({
//     where: { userId: { in: userIds } },
//   });
//   await prisma.message.deleteMany({
//     where: {
//       OR: [
//         { senderId: { in: userIds } },
//         { chat: { userIds: { hasSome: userIds } } },
//       ],
//     },
//   });
//   await prisma.deletedChat.deleteMany({
//     where: { userId: { in: userIds } },
//   });
//   await prisma.inviteToken.deleteMany({
//     where: { invitedUserId: { in: userIds } },
//   });
//   await prisma.chat.deleteMany({
//     where: {
//       OR: [{ userIds: { hasSome: userIds } }, { adminId: { in: userIds } }],
//     },
//   });

//   // Step 3: Restore user profiles
//   for (const user of backupData) {
//     await prisma.user.update({
//       where: { id: user.id },
//       data: {
//         name: user.name,
//         email: user.email,
//         username: user.username,
//         password: user.password,
//         gender: user.gender,
//         dob: user.dob,
//         bio: user.bio,
//         profilePic: user.profilePic,
//         phoneNumber: user.phoneNumber,
//         active: user.active,
//       },
//     });
//   }

//   console.log("✅ Sandbox users reset completed");
// });
