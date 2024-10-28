const { PrismaClient } = require('@prisma/client');
const Ably = require('ably');

const prisma = new PrismaClient();
const ably = new Ably.Realtime(process.env.ABLY_API_KEY);

const chatController = {
  async createChat(req, res, next) {
    try {
      const { userId } = req.body;
      const currentUserId = req.user.id;

      const existingChat = await prisma.chat.findFirst({
        where: {
          AND: [
            { userIds: { has: currentUserId } },
            { userIds: { has: userId } },
          ],
        },
        include: {
          users: true,
        },
      });

      if (existingChat) {

        return res.json(existingChat);
      }


      const chat = await prisma.chat.create({
        data: {
          userIds: [currentUserId, userId],
          users: {
            connect: [{ id: currentUserId }, { id: userId }],
          },
        },
        include: {
          users: true,
        },
      });

      res.json(chat);
    } catch (err) {
      next(err);
    }
  },

  async getChats(req, res, next) {
    try {
      const userId = req.user.id; 

     
      const chats = await prisma.chat.findMany({
        where: {
          userIds: {
            has: userId,
          },
        },
        include: {
          users: true,
          messages: { 
            include: {
              sender: true,
            },
          },
        },
      });

      res.json(chats);
    } catch (err) {
      console.log(err);
      next(err);
    }
  },

  async createMessage(req, res, next) {
    try {
      const { content, chatId } = req.body;
      const currentUserId = req.user.id; 

      const message = await prisma.message.create({
        data: {
          content,
          chatId,
          senderId: currentUserId,
        },
        include: {
          sender: true,
          chat: true,
        },
      });

      ably.channels.get(`chat-${chatId}`).publish('message', message);
      res.json(message);
    } catch (err) {
      next(err);
    }
  },

  async getMessagesByChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const messages = await prisma.message.findMany({
        where: {
          chatId,
        },
        include: {
          sender: true,
        },
      });
      res.json(messages);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = chatController;
