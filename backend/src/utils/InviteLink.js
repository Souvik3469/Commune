const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function generateInviteLink(chatId, currentUserId) {

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
  });

  if (!chat) {
    throw new Error('Group chat not found');
  }
   if (!chat.isGroup) {
    throw new Error('Invite links can only be generated for group chats');
  }

  if (chat.adminId !== currentUserId) {
    throw new Error('Only the admin can generate invite links');
  }


  const inviteToken = crypto.randomBytes(32).toString('hex');

  
  await prisma.inviteToken.create({
    data: {
      token: inviteToken,
      chatId: chat.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    },
  });

  
  const inviteLink = `${process.env.FRONTEND_URL}/join/${inviteToken}`;

  return inviteLink;
}

module.exports = { generateInviteLink };