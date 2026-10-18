import crypto from "crypto";
import prisma from "../prisma/index";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

const httpError = (status, message) =>
  Object.assign(new Error(message), { status });

async function generateInviteLink(chatId, currentUserId) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { id: true, isGroup: true, adminId: true },
  });

  if (!chat) {
    throw httpError(404, "Group chat not found");
  }
  if (!chat.isGroup) {
    throw httpError(400, "Invite links can only be generated for group chats");
  }
  if (chat.adminId !== currentUserId) {
    throw httpError(403, "Only the admin can generate invite links");
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");

  await prisma.inviteToken.create({
    data: {
      token: inviteToken,
      chatId: chat.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  return `${process.env.FRONTEND_URL}/join/${inviteToken}`;
}

export { generateInviteLink };
export default generateInviteLink;
