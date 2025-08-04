const { PrismaClient } = require("@prisma/client");
const Ably = require("ably");
const { generateInviteLink } = require("../../../utils/InviteLink");

const prisma = new PrismaClient();
const ably = new Ably.Realtime(process.env.ABLY_API_KEY);
import fs from "fs";
import path from "path";
import cloudinary from "../../utils/cloudinary";

const chatController = {
  async createChat(req, res, next) {
    try {
      let { userIds, isGroup, name, usernames } = req.body;
      const currentUserId = req.user.id;

      const defaultGroupLogo = "https://www.tenniscall.com/images/chat.jpg";
      let logoUrl = defaultGroupLogo;

      if (req.file) {
        const localPath = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          req.file.filename
        );
        const uploadResult = await cloudinary.uploader.upload(localPath, {
          folder: "grp_chat_logos",
        });
        logoUrl = uploadResult.secure_url;
        fs.unlinkSync(localPath); // remove file
      }

      if (isGroup && !name) {
        return res.status(400).json({ error: "Group chats must have a name." });
      }

      if (usernames) {
        const users = await prisma.user.findMany({
          where: { username: { in: usernames, mode: "insensitive" } },
        });

        if (users.length !== usernames.length) {
          return res.status(400).json({ error: "One or more users not found" });
        }

        userIds = users.map((u) => u.id);
      }

      // Deduplicate userIds and include current user
      const allUserIds = Array.from(
        new Set([...(userIds || []), currentUserId])
      );

      const includeFields = {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePic: true,
            dob: true,
          },
        },
        messages: {
          select: {
            content: true,
            type: true,
            timestamp: true,
            sender: {
              select: {
                name: true,
                email: true,
                profilePic: true,
                dob: true,
              },
            },
          },
        },
      };

      let chat;

      if (isGroup) {
        chat = await prisma.chat.create({
          data: {
            name,
            logo: logoUrl,
            isGroup: true,
            adminId: currentUserId,
            lastModified: new Date(),
            userIds: allUserIds,
            users: {
              connect: allUserIds.map((id) => ({ id })),
            },
          },
          include: includeFields,
        });
      } else {
        const otherUserId = userIds?.[0];
        const existingChat = await prisma.chat.findFirst({
          where: {
            isGroup: false,
            userIds: {
              hasEvery: [currentUserId, otherUserId],
            },
          },
          include: includeFields,
        });

        if (existingChat) return res.json(existingChat);

        chat = await prisma.chat.create({
          data: {
            isGroup: false,
            lastModified: new Date(),
            userIds: [currentUserId, otherUserId],
            users: {
              connect: [{ id: currentUserId }, { id: otherUserId }],
            },
          },
          include: includeFields,
        });
      }

      res.json(chat);
    } catch (err) {
      next(err);
    }
  },

  async updateGroupChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const { name, addUserIds = [], removeUserIds = [] } = req.body;
      const currentUserId = req.user.id;

      const existingChat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { users: true },
      });

      if (!existingChat)
        return res.status(404).json({ error: "Chat not found" });
      if (!existingChat.isGroup)
        return res
          .status(400)
          .json({ error: "Only group chats can be updated" });
      if (existingChat.adminId !== currentUserId)
        return res
          .status(403)
          .json({ error: "Only the admin can update the group chat" });

      let logoUrl = existingChat.logo;

      if (req.file) {
        const localPath = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          req.file.filename
        );
        const uploadResult = await cloudinary.uploader.upload(localPath, {
          folder: "grp_chat_logos",
        });
        logoUrl = uploadResult.secure_url;
      }

      const currentIds = existingChat.userIds;
      const updatedIds = Array.from(
        new Set([
          ...currentIds.filter((id) => !removeUserIds.includes(id)),
          ...addUserIds,
          currentUserId,
        ])
      );

      const updatedChat = await prisma.chat.update({
        where: { id: chatId },
        data: {
          name: name || existingChat.name,
          logo: logoUrl,
          userIds: { set: updatedIds },
          users: {
            connect: updatedIds.map((id) => ({ id })),
            disconnect: removeUserIds.map((id) => ({ id })),
          },
          lastModified: new Date(),
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePic: true,
              dob: true,
            },
          },
          messages: {
            orderBy: { timestamp: "desc" },
            take: 1,
            select: {
              content: true,
              type: true,
              timestamp: true,
              sender: {
                select: {
                  name: true,
                  email: true,
                  profilePic: true,
                  dob: true,
                },
              },
            },
          },
        },
      });

      res.json(updatedChat);
    } catch (err) {
      console.error("Update group chat error:", err);
      next(err);
    }
  },

  async getChats(req, res, next) {
    try {
      const userId = req.user.id;

      const chats = await prisma.chat.findMany({
        where: {
          isGroup: false,
          userIds: {
            has: userId,
          },
        },
        include: {
          users: {
            select: {
              name: true,
              email: true,
              id: true,
              profilePic: true,
            },
          },
          messages: {
            orderBy: {
              timestamp: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          lastModified: "desc",
        },
      });

      const filteredChats = await Promise.all(
        chats.map(async (chat) => {
          const deletedChat = await prisma.deletedChat.findUnique({
            where: {
              userId_chatId: {
                userId: userId,
                chatId: chat.id,
              },
            },
          });

          if (deletedChat) {
            const latestMessage = await prisma.message.findFirst({
              where: {
                chatId: chat.id,
                timestamp: {
                  gt: deletedChat.deletedAt,
                },
              },
              orderBy: {
                timestamp: "desc",
              },
            });

            if (!latestMessage) {
              return null;
            }
          }

          return chat;
        })
      );

      const visibleChats = filteredChats.filter(Boolean);

      res.json(visibleChats);
    } catch (err) {
      console.log(err);
      next(err);
    }
  },

  async getChatById(req, res, next) {
    try {
      const userId = req.user.id;
      const { chatId } = req.params;

      // Step 1: Find the chat
      const chat = await prisma.chat.findUnique({
        where: {
          id: chatId,
          userIds: {
            has: userId,
          },
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePic: true,
            },
          },
          messages: {
            orderBy: {
              timestamp: "desc",
            },
            take: 1,
          },
        },
      });

      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      // Step 2: Check if user deleted the chat
      const deletedChat = await prisma.deletedChat.findUnique({
        where: {
          userId_chatId: {
            userId,
            chatId,
          },
        },
      });

      if (deletedChat) {
        const latestMessage = await prisma.message.findFirst({
          where: {
            chatId,
            timestamp: {
              gt: deletedChat.deletedAt,
            },
          },
          orderBy: {
            timestamp: "desc",
          },
        });

        // If no message after deletion, return 204 No Content
        if (!latestMessage) {
          return res.status(204).json(null);
        }
      }

      res.json(chat);
    } catch (err) {
      console.error(err);
      next(err);
    }
  },
  async getRooms(req, res, next) {
    try {
      const userId = req.user.id;

      const chats = await prisma.chat.findMany({
        where: {
          isGroup: true,
          userIds: {
            has: userId,
          },
        },
        select: {
          id: true,
          name: true,
          logo: true,
          isGroup: true,
          adminId: true, // ✅ include this
          userIds: true,
          lastModified: true,
          users: {
            select: {
              name: true,
              email: true,
              id: true,
              profilePic: true,
            },
          },
          messages: {
            orderBy: {
              timestamp: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          lastModified: "desc",
        },
      });

      res.json(chats);
    } catch (err) {
      console.log(err);
      next(err);
    }
  },

  async getUnreadMessages(req, res, next) {
    try {
      const userId = req.user.id;
      const chatId = req.params.chatId;
      const unreadMessages = await prisma.message.findMany({
        where: {
          chatId,
          MessageReadStatus: {
            none: {
              userId,
              readAt: { not: null },
            },
          },
        },
        select: { id: true },
      });

      res.json(unreadMessages.length);
    } catch (err) {
      next(err);
    }
  },

  async createMessage(req, res, next) {
    try {
      const { content, chatId, type, fileUrl } = req.body;
      const currentUserId = req.user.id;

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { users: true },
      });

      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const isUserInChat = chat.users.some((user) => user.id === currentUserId);

      if (!isUserInChat) {
        return res
          .status(403)
          .json({ error: "User is not a member of this chat" });
      }

      let messageContent = content || "";
      if (fileUrl) {
        messageContent = messageContent
          ? `${messageContent}\n${fileUrl}`
          : fileUrl;
      }

      const message = await prisma.message.create({
        data: {
          content: messageContent,
          chatId,
          senderId: currentUserId,
          type: type || "text",
        },
        include: {
          sender: {
            select: {
              name: true,
              email: true,
            },
          },
          chat: {
            select: {
              name: true,
              isGroup: true,
              admin: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      ably.channels.get(`chat-${chatId}`).publish("message", {
        ...message,
        sender: {
          name: message.sender.name,
          email: message.sender.email,
        },
        chat: {
          name: message.chat.name,
          isGroup: message.chat.isGroup,
          admin: message.chat.admin,
          timestamp: message.timestamp,
        },
      });

      await prisma.chat.update({
        where: { id: chatId },
        data: { lastModified: new Date() },
      });
      await prisma.messageReadStatus.createMany({
        data: {
          messageId: message.id,
          userId: currentUserId,
          readAt: new Date(),
        },
      });
      res.json({
        ...message,
        sender: {
          name: message.sender.name,
          email: message.sender.email,
        },
        chat: {
          name: message.chat.name,
          isGroup: message.chat.isGroup,
          admin: message.chat.admin,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async updateMessageStatus(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user.id;

      const unreadMessages = await prisma.message.findMany({
        where: {
          chatId,
          MessageReadStatus: {
            none: {
              userId: userId,
              readAt: { not: null },
            },
          },
        },
        select: { id: true },
      });

      const messageIds = unreadMessages.map((msg) => msg.id);

      // Mark these messages as read by this user
      if (messageIds.length > 0) {
        await prisma.messageReadStatus.createMany({
          data: messageIds.map((messageId) => ({
            messageId,
            userId,
            readAt: new Date(),
          })),
        });
      }

      res.json({ message: "Message status updated successfully" });
    } catch (err) {
      next(err);
    }
  },

  // async getMessagesByChat(req, res, next) {
  //   try {
  //     const { chatId } = req.params;
  //     const { cursor } = req.query;

  //     const chat = await prisma.chat.findFirst({
  //       where: {
  //         id: chatId,
  //         users: { some: { id: req.user.id } },
  //       },
  //     });

  //     if (!chat) {
  //       return res.status(404).json({
  //         error: "Chat not found or user is not a member of this chat",
  //       });
  //     }

  //     const deletedChat = await prisma.deletedChat.findUnique({
  //       where: { userId_chatId: { userId: req.user.id, chatId } },
  //     });

  //     const whereCondition = {
  //       chatId,
  //     };

  //     if (deletedChat) {
  //       whereCondition.timestamp = { gt: deletedChat.deletedAt };
  //     }

  //     if (cursor) {
  //       whereCondition.timestamp = {
  //         ...(whereCondition.timestamp || {}),
  //         lt: new Date(cursor),
  //       };
  //     }

  //     const messages = await prisma.message.findMany({
  //       where: whereCondition,
  //       orderBy: { timestamp: "desc" },
  //       take: 20,
  //       include: {
  //         sender: {
  //           select: {
  //             name: true,
  //             email: true,
  //             profilePic: true,
  //             dob: true,
  //           },
  //         },
  //         MessageReadStatus: {
  //           where: { userId: req.user.id },
  //         },
  //       },
  //     });

  //     res.json({ messages: messages.reverse(), chat });
  //   } catch (err) {
  //     next(err);
  //   }
  // },

  // controllers/messageController.ts

  async getMessagesByChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const { cursor } = req.query;
      const userId = req.user.id;

      const limit = 20;

      // Check if user is a participant of the chat
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          users: {
            some: { id: userId },
          },
        },
      });

      if (!chat) {
        return res.status(404).json({
          error: "Chat not found or user is not a member of this chat",
        });
      }

      // Check if user has deleted the chat before
      const deletedChat = await prisma.deletedChat.findUnique({
        where: {
          userId_chatId: {
            userId,
            chatId,
          },
        },
      });

      // Prepare where condition
      const whereCondition = {
        chatId,
        ...(deletedChat && {
          timestamp: {
            gt: deletedChat.deletedAt,
          },
        }),
        ...(cursor && {
          timestamp: {
            ...(deletedChat?.deletedAt ? { gt: deletedChat.deletedAt } : {}),
            lt: new Date(cursor),
          },
        }),
      };

      // Fetch messages with pagination
      const messages = await prisma.message.findMany({
        where: whereCondition,
        orderBy: { timestamp: "desc" },
        take: limit + 1,
        include: {
          sender: {
            select: {
              name: true,
              profilePic: true,
            },
          },
          chat: true,
        },
      });

      const hasMore = messages.length > limit;
      const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

      return res.status(200).json({
        messages: messagesToReturn,
        nextCursor: hasMore ? messagesToReturn.at(-1)?.timestamp : null, // using timestamp here
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  },

  async deleteChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const currentUserId = req.user.id;

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: {
          isGroup: true,
          adminId: true,
          users: { select: { id: true } },
        },
      });

      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (!chat.isGroup) {
        await prisma.deletedChat.upsert({
          where: {
            userId_chatId: {
              userId: currentUserId,
              chatId: chatId,
            },
          },
          update: {
            deletedAt: new Date(),
          },
          create: {
            userId: currentUserId,
            chatId: chatId,
            deletedAt: new Date(),
          },
        });

        return res
          .status(200)
          .json({ message: "Chat deleted for current user." });
      }

      if (chat.isGroup) {
        if (chat.adminId === currentUserId) {
          return res
            .status(403)
            .json({ error: "Admins cannot delete the group chat." });
        }

        await prisma.chat.update({
          where: { id: chatId },
          data: {
            users: { disconnect: { id: currentUserId } },
          },
        });

        return res.status(200).json({
          message:
            "You have been removed from the group and will no longer see this chat.",
        });
      }
    } catch (err) {
      next(err);
    }
  },

  // async updateGroupChat(req, res, next) {
  //   try {
  //     const { chatId } = req.params;
  //     const { name, logo, newUserIds } = req.body;
  //     const currentUserId = req.user.id;

  //     const chat = await prisma.chat.findUnique({
  //       where: { id: chatId },
  //       include: {
  //         users: {
  //           select: {
  //             id: true,
  //             name: true,
  //             email: true,
  //           },
  //         },
  //       },
  //     });

  //     if (!chat) {
  //       return res.status(404).json({ error: "Group chat not found" });
  //     }

  //     if (chat.adminId !== currentUserId) {
  //       return res
  //         .status(403)
  //         .json({ error: "Only the admin can update the group chat" });
  //     }

  //     const updateData = {
  //       lastModified: new Date(),
  //     };

  //     if (name) updateData.name = name;
  //     if (logo) updateData.logo = logo;

  //     if (newUserIds && newUserIds.length > 0) {
  //       const existingUserIds = chat.users.map((user) => user.id);
  //       const validNewUserIds = newUserIds.filter(
  //         (id) => !existingUserIds.includes(id)
  //       );

  //       updateData.userIds = {
  //         set: [...existingUserIds, ...validNewUserIds],
  //       };

  //       updateData.users = {
  //         connect: validNewUserIds.map((id) => ({ id })),
  //       };
  //     }

  //     const updatedChat = await prisma.chat.update({
  //       where: { id: chatId },
  //       data: updateData,
  //       include: {
  //         users: {
  //           select: {
  //             name: true,
  //             email: true,
  //           },
  //         },
  //       },
  //     });

  //     res.json(updatedChat);
  //   } catch (err) {
  //     next(err);
  //   }
  // },

  //if sending invitelink via email
  // async  sendInviteLink(req, res, next) {
  //   try {
  //     const { chatId } = req.params;
  //     const currentUserId = req.user.id;
  //     const { email } = req.body;

  //
  //     const inviteLink = await generateInviteLink(chatId, currentUserId);

  //
  //     await sendEmail(email, inviteLink);

  //     res.json({ message: 'Invite link sent successfully' });
  //   } catch (err) {
  //     next(err);
  //   }
  // },
  // async  sendEmail(email, inviteLink) {
  //   console.log(`Sending invite link to ${email}: ${inviteLink}`);
  //
  // },

  async generateInvite(req, res, next) {
    try {
      const { chatId } = req.params;
      console.log("ChatId", chatId);
      const currentUserId = req.user.id;
      const inviteLink = await generateInviteLink(chatId, currentUserId);

      res.status(200).json({ inviteLink });
    } catch (err) {
      next(err);
    }
  },

  async acceptInviteLink(req, res, next) {
    try {
      const { inviteToken } = req.params;
      const currentUserId = req.user.id;

      const invite = await prisma.inviteToken.findUnique({
        where: { token: inviteToken },
        include: {
          chat: {
            include: {
              users: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!invite) {
        return res
          .status(404)
          .json({ error: "Invalid or expired invite token" });
      }

      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ error: "Invite token has expired" });
      }

      if (invite.chat.users.some((user) => user.id === currentUserId)) {
        return res
          .status(400)
          .json({ error: "You are already a member of this group chat" });
      }

      const updatedChat = await prisma.chat.update({
        where: { id: invite.chatId },
        data: {
          userIds: {
            push: currentUserId,
          },
          users: {
            connect: { id: currentUserId },
          },
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // await prisma.inviteToken.delete({
      //   where: { token: inviteToken },
      // });

      res.json({
        message: "Successfully joined the group chat",
        chatId: updatedChat.id,
      });
    } catch (err) {
      next(err);
    }
  },

  async removeGroupMembers(req, res, next) {
    try {
      const { chatId } = req.params;
      const currentUserId = req.user.id;
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "Invalid userIds array" });
      }

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          users: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!chat) {
        return res.status(404).json({ error: "Group chat not found" });
      }

      if (!chat.isGroup) {
        return res
          .status(400)
          .json({ error: "Operation allowed only for group chats" });
      }

      if (chat.adminId !== currentUserId) {
        return res
          .status(403)
          .json({ error: "Only the admin can remove members" });
      }

      const chatUserIds = chat.users.map((user) => user.id);
      for (const userId of userIds) {
        if (!chatUserIds.includes(userId)) {
          return res.status(400).json({
            error: `User with id ${userId} is not a member of this group chat`,
          });
        }
      }

      const updatedChat = await prisma.chat.update({
        where: { id: chatId },
        data: {
          userIds: {
            set: chatUserIds.filter((id) => !userIds.includes(id)),
          },
          users: {
            disconnect: userIds.map((id) => ({ id })),
          },
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.json({ message: "Users removed successfully", chat: updatedChat });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = chatController;
