import fs from "fs/promises";
import prisma from "../../../prisma/index";
import cloudinary from "../../utils/cloudinary";
import { generateInviteLink } from "../../../utils/InviteLink";
import { publishMessage, publishChatEvent } from "../../realtime";

const DEFAULT_GROUP_LOGO = "https://www.tenniscall.com/images/chat.jpg";
const MESSAGE_PAGE_SIZE = 20;

/** Upload a multer temp file to Cloudinary. */
const uploadImage = async (file, folder) => {
  if (!file) return null;
  const result = await cloudinary.uploader.upload(file.path, { folder });
  return result.secure_url;
};

/**
 * Remove a multer temp file. Called from a `finally` so it also runs on the
 * validation paths that return before any upload happens — the group-update
 * handler used to leave every uploaded logo on local disk, and every early
 * `400` left one behind regardless of handler.
 */
const discardTempFile = async (file) => {
  if (file?.path) await fs.unlink(file.path).catch(() => {});
};

const chatPreviewInclude = {
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
      id: true,
      content: true,
      type: true,
      fileUrl: true,
      timestamp: true,
      senderId: true,
      sender: {
        select: { id: true, name: true, email: true, profilePic: true },
      },
    },
  },
};

/**
 * Shape a persisted message for the wire. `profilePic` was missing from the
 * realtime payload, so a message arriving live rendered with the default
 * avatar until the next refetch.
 */
const messageForClient = (message) => ({
  id: message.id,
  chatId: message.chatId,
  senderId: message.senderId,
  content: message.content,
  type: message.type,
  fileUrl: message.fileUrl,
  timestamp: message.timestamp,
  sender: message.sender,
});

const chatController = {
  async createChat(req, res, next) {
    try {
      let { userIds, isGroup, name, usernames } = req.body;
      const currentUserId = req.user.id;

      isGroup = isGroup === true || isGroup === "true";
      if (userIds && !Array.isArray(userIds)) userIds = [userIds];
      if (usernames && !Array.isArray(usernames)) usernames = [usernames];

      if (isGroup && !name?.trim()) {
        return res.status(400).json({ error: "Group chats must have a name." });
      }

      if (usernames?.length) {
        const users = await prisma.user.findMany({
          where: { username: { in: usernames, mode: "insensitive" } },
          select: { id: true },
        });
        // Compare against the distinct set: a repeated username used to make
        // the length check fail for an otherwise valid request.
        if (users.length !== new Set(usernames.map((u) => u.toLowerCase())).size) {
          return res.status(400).json({ error: "One or more users not found" });
        }
        userIds = users.map((u) => u.id);
      }

      const allUserIds = Array.from(
        new Set([...(userIds || []), currentUserId])
      );

      // Every id must resolve to a real user before a chat is built around it.
      const known = await prisma.user.count({
        where: { id: { in: allUserIds } },
      });
      if (known !== allUserIds.length) {
        return res.status(400).json({ error: "One or more users not found" });
      }

      const logoUrl = isGroup
        ? (await uploadImage(req.file, "grp_chat_logos")) || DEFAULT_GROUP_LOGO
        : null;

      let chat;
      if (isGroup) {
        if (allUserIds.length < 2) {
          return res
            .status(400)
            .json({ error: "A group chat needs at least one other member." });
        }
        chat = await prisma.chat.create({
          data: {
            name: name.trim(),
            logo: logoUrl,
            isGroup: true,
            adminId: currentUserId,
            lastModified: new Date(),
            // `connect` maintains userIds itself; setting the scalar array as
            // well used to duplicate every id in it.
            users: { connect: allUserIds.map((id) => ({ id })) },
          },
          include: chatPreviewInclude,
        });
      } else {
        const otherUserId = userIds?.[0];
        if (!otherUserId) {
          return res
            .status(400)
            .json({ error: "A direct chat needs one other user." });
        }
        if (otherUserId === currentUserId) {
          return res
            .status(400)
            .json({ error: "You cannot start a chat with yourself." });
        }

        const existingChat = await prisma.chat.findFirst({
          where: {
            isGroup: false,
            userIds: { hasEvery: [currentUserId, otherUserId] },
          },
          include: chatPreviewInclude,
        });

        if (existingChat) {
          // Reopening a conversation you had deleted clears your watermark.
          await prisma.deletedChat.deleteMany({
            where: { userId: currentUserId, chatId: existingChat.id },
          });
          return res.json(existingChat);
        }

        chat = await prisma.chat.create({
          data: {
            isGroup: false,
            lastModified: new Date(),
            users: { connect: [{ id: currentUserId }, { id: otherUserId }] },
          },
          include: chatPreviewInclude,
        });
      }

      return res.json(chat);
    } catch (err) {
      return next(err);
    } finally {
      await discardTempFile(req.file);
    }
  },

  async updateGroupChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const currentUserId = req.user.id;

      // The group-edit form posts multipart fields named `addUserIds[]` and
      // `removeUserIds[]`. multer does not expand bracket notation, so the
      // handler only ever saw the default empty arrays and adding or removing
      // members from the UI silently did nothing. Both spellings are read.
      const rawAdd = req.body["addUserIds[]"] ?? req.body.addUserIds ?? [];
      const rawRemove =
        req.body["removeUserIds[]"] ?? req.body.removeUserIds ?? [];
      const { name } = req.body;

      const existingChat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: { id: true, isGroup: true, adminId: true, logo: true, name: true, userIds: true },
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

      const toAdd = (Array.isArray(rawAdd) ? rawAdd : [rawAdd]).filter(Boolean);
      const toRemove = (
        Array.isArray(rawRemove) ? rawRemove : [rawRemove]
      ).filter(Boolean);

      // The admin cannot be removed from their own group — otherwise the group
      // is left with an admin who is not a member.
      const removals = toRemove.filter((id) => id !== currentUserId);

      if (toAdd.length) {
        const known = await prisma.user.count({ where: { id: { in: toAdd } } });
        if (known !== new Set(toAdd).size) {
          return res.status(400).json({ error: "One or more users not found" });
        }
      }

      const logoUrl =
        (await uploadImage(req.file, "grp_chat_logos")) || existingChat.logo;

      const updatedChat = await prisma.chat.update({
        where: { id: chatId },
        data: {
          name: name?.trim() || existingChat.name,
          logo: logoUrl,
          users: {
            connect: toAdd.map((id) => ({ id })),
            disconnect: removals.map((id) => ({ id })),
          },
          lastModified: new Date(),
        },
        include: chatPreviewInclude,
      });

      publishChatEvent(chatId, "chat:updated", { chatId });
      return res.json(updatedChat);
    } catch (err) {
      return next(err);
    } finally {
      await discardTempFile(req.file);
    }
  },

  /**
   * Direct chats, newest first, minus the ones this user has deleted and which
   * have had no activity since.
   */
  async getChats(req, res, next) {
    try {
      const userId = req.user.id;
      const chats = await prisma.chat.findMany({
        where: { isGroup: false, userIds: { has: userId } },
        include: chatPreviewInclude,
        orderBy: { lastModified: "desc" },
      });

      // One query for every watermark instead of one query per chat in a
      // Promise.all — the old version issued N+1 round trips per sidebar load.
      const deleted = await prisma.deletedChat.findMany({
        where: { userId, chatId: { in: chats.map((c) => c.id) } },
        select: { chatId: true, deletedAt: true },
      });
      const deletedAtByChat = new Map(
        deleted.map((d) => [d.chatId, d.deletedAt])
      );

      const visibleChats = chats.filter((chat) => {
        const deletedAt = deletedAtByChat.get(chat.id);
        if (!deletedAt) return true;
        const latest = chat.messages[0];
        return Boolean(latest && latest.timestamp > deletedAt);
      });

      return res.json(visibleChats);
    } catch (err) {
      return next(err);
    }
  },

  async getChatById(req, res, next) {
    try {
      const userId = req.user.id;
      const { chatId } = req.params;

      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userIds: { has: userId } },
        include: chatPreviewInclude,
      });
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const deletedChat = await prisma.deletedChat.findUnique({
        where: { userId_chatId: { userId, chatId } },
        select: { deletedAt: true },
      });
      if (deletedChat) {
        const latest = chat.messages[0];
        if (!latest || latest.timestamp <= deletedChat.deletedAt) {
          // 204 must not carry a body; the old handler passed `null` to
          // `res.json`, which Express silently dropped.
          return res.status(404).json({ message: "Chat not found" });
        }
      }

      return res.json(chat);
    } catch (err) {
      return next(err);
    }
  },

  async getRooms(req, res, next) {
    try {
      const userId = req.user.id;
      const chats = await prisma.chat.findMany({
        where: { isGroup: true, userIds: { has: userId } },
        select: {
          id: true,
          name: true,
          logo: true,
          isGroup: true,
          adminId: true,
          userIds: true,
          lastModified: true,
          ...chatPreviewInclude,
        },
        orderBy: { lastModified: "desc" },
      });
      return res.json(chats);
    } catch (err) {
      return next(err);
    }
  },

  /**
   * Unread count for one chat. This used to `findMany` every unread row and
   * return `.length`, pulling one document per unread message over the wire.
   */
  async getUnreadMessages(req, res, next) {
    try {
      const userId = req.user.id;
      const { chatId } = req.params;

      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userIds: { has: userId } },
        select: { id: true },
      });
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const deletedChat = await prisma.deletedChat.findUnique({
        where: { userId_chatId: { userId, chatId } },
        select: { deletedAt: true },
      });

      const count = await prisma.message.count({
        where: {
          chatId,
          // Your own messages were being counted as unread to you.
          senderId: { not: userId },
          ...(deletedChat ? { timestamp: { gt: deletedChat.deletedAt } } : {}),
          MessageReadStatus: {
            none: { userId, readAt: { not: null } },
          },
        },
      });

      return res.json(count);
    } catch (err) {
      return next(err);
    }
  },

  async createMessage(req, res, next) {
    try {
      const { content, chatId, type, fileUrl } = req.body;
      const currentUserId = req.user.id;

      if (!chatId) {
        return res.status(400).json({ error: "chatId is required" });
      }
      if (!content?.trim() && !fileUrl) {
        return res
          .status(400)
          .json({ error: "A message needs text or an attachment." });
      }

      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userIds: { has: currentUserId } },
        select: { id: true },
      });
      if (!chat) {
        return res
          .status(403)
          .json({ error: "User is not a member of this chat" });
      }

      /**
       * One transaction for the three writes that have to agree: the message,
       * the chat's ordering timestamp, and the sender's own read receipt.
       * Previously these were three independent awaits with the realtime
       * publish wedged between the first and the second, so a crash mid-way
       * left recipients holding a message whose chat never reordered.
       */
      const message = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            content: content?.trim() || "",
            // The file used to be concatenated onto the message text, which
            // made attachments unqueryable and unrenderable without parsing.
            fileUrl: fileUrl || null,
            chatId,
            senderId: currentUserId,
            type: type || (fileUrl ? "file" : "text"),
          },
          include: {
            sender: {
              select: { id: true, name: true, email: true, profilePic: true },
            },
          },
        });

        await tx.chat.update({
          where: { id: chatId },
          data: { lastModified: created.timestamp },
        });

        // `createMany` was being handed a single object rather than an array.
        await tx.messageReadStatus.create({
          data: {
            messageId: created.id,
            userId: currentUserId,
            readAt: new Date(),
          },
        });

        return created;
      });

      const payload = messageForClient(message);

      // Published only after the transaction commits.
      publishMessage(chatId, payload);

      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  },

  async updateMessageStatus(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user.id;

      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userIds: { has: userId } },
        select: { id: true },
      });
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const unreadMessages = await prisma.message.findMany({
        where: {
          chatId,
          senderId: { not: userId },
          MessageReadStatus: { none: { userId } },
        },
        select: { id: true },
      });

      if (unreadMessages.length > 0) {
        const readAt = new Date();
        await prisma.messageReadStatus.createMany({
          data: unreadMessages.map((msg) => ({
            messageId: msg.id,
            userId,
            readAt,
          })),
          // Backed by @@unique([messageId, userId]); repeated calls used to
          // insert a fresh row each time.
          skipDuplicates: true,
        });
      }

      publishChatEvent(chatId, "chat:read", { chatId, userId });
      return res.json({ message: "Message status updated successfully" });
    } catch (err) {
      return next(err);
    }
  },

  async getMessagesByChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const { cursor } = req.query;
      const userId = req.user.id;

      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userIds: { has: userId } },
        select: { id: true },
      });
      if (!chat) {
        return res.status(404).json({
          error: "Chat not found or user is not a member of this chat",
        });
      }

      const deletedChat = await prisma.deletedChat.findUnique({
        where: { userId_chatId: { userId, chatId } },
        select: { deletedAt: true },
      });

      /**
       * Compound cursor. The cursor used to be a bare timestamp, which is not
       * unique — two messages written in the same millisecond, ordinary in a
       * group chat, could be skipped or repeated across a page boundary. It is
       * now `<iso timestamp>_<id>` and the comparison breaks the tie on id.
       *
       * The `where` clause is also built in one place: the old version spread
       * two objects that both wrote `timestamp`, so the second silently
       * overwrote the first and only happened to be correct because it
       * re-added the condition by hand.
       */
      let cursorTimestamp = null;
      let cursorId = null;
      if (cursor) {
        const separator = String(cursor).lastIndexOf("_");
        const rawTimestamp =
          separator === -1 ? String(cursor) : String(cursor).slice(0, separator);
        cursorId = separator === -1 ? null : String(cursor).slice(separator + 1);
        const parsed = new Date(rawTimestamp);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Invalid cursor" });
        }
        cursorTimestamp = parsed;
      }

      const conditions = [{ chatId }];
      if (deletedChat) {
        conditions.push({ timestamp: { gt: deletedChat.deletedAt } });
      }
      if (cursorTimestamp) {
        conditions.push(
          cursorId
            ? {
                OR: [
                  { timestamp: { lt: cursorTimestamp } },
                  { timestamp: cursorTimestamp, id: { lt: cursorId } },
                ],
              }
            : { timestamp: { lt: cursorTimestamp } }
        );
      }

      const messages = await prisma.message.findMany({
        where: { AND: conditions },
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        take: MESSAGE_PAGE_SIZE + 1,
        include: {
          sender: {
            select: { id: true, name: true, email: true, profilePic: true },
          },
          // `chat: true` used to serialise the same chat object onto all
          // twenty messages, on the busiest endpoint in the app.
        },
      });

      const hasMore = messages.length > MESSAGE_PAGE_SIZE;
      const page = hasMore ? messages.slice(0, MESSAGE_PAGE_SIZE) : messages;
      const last = page.at(-1);

      return res.status(200).json({
        messages: page.map(messageForClient),
        nextCursor:
          hasMore && last
            ? `${last.timestamp.toISOString()}_${last.id}`
            : null,
      });
    } catch (err) {
      return next(err);
    }
  },

  async deleteChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const currentUserId = req.user.id;

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: { id: true, isGroup: true, adminId: true, userIds: true },
      });
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }
      if (!chat.userIds.includes(currentUserId)) {
        return res
          .status(403)
          .json({ error: "You are not a member of this chat" });
      }

      if (!chat.isGroup) {
        await prisma.deletedChat.upsert({
          where: { userId_chatId: { userId: currentUserId, chatId } },
          update: { deletedAt: new Date() },
          create: { userId: currentUserId, chatId, deletedAt: new Date() },
        });
        return res
          .status(200)
          .json({ message: "Chat deleted for current user." });
      }

      /**
       * The admin used to be the one member who could not delete the group,
       * which left abandoned groups undeletable by anyone. An admin leaving now
       * hands the group to the longest-standing remaining member, and deletes
       * it outright when nobody is left.
       */
      if (chat.adminId === currentUserId) {
        const heir = chat.userIds.find((id) => id !== currentUserId);
        if (!heir) {
          await prisma.$transaction([
            prisma.messageReadStatus.deleteMany({
              where: { message: { chatId } },
            }),
            prisma.message.deleteMany({ where: { chatId } }),
            prisma.deletedChat.deleteMany({ where: { chatId } }),
            prisma.inviteToken.deleteMany({ where: { chatId } }),
            prisma.chat.delete({ where: { id: chatId } }),
          ]);
          return res
            .status(200)
            .json({ message: "Group deleted — you were the last member." });
        }

        await prisma.chat.update({
          where: { id: chatId },
          data: {
            adminId: heir,
            users: { disconnect: { id: currentUserId } },
          },
        });
        publishChatEvent(chatId, "chat:updated", { chatId });
        return res.status(200).json({
          message:
            "You have left the group and admin rights were transferred to another member.",
        });
      }

      await prisma.chat.update({
        where: { id: chatId },
        data: { users: { disconnect: { id: currentUserId } } },
      });
      publishChatEvent(chatId, "chat:updated", { chatId });
      return res.status(200).json({
        message:
          "You have been removed from the group and will no longer see this chat.",
      });
    } catch (err) {
      return next(err);
    }
  },

  async generateInvite(req, res, next) {
    try {
      const { chatId } = req.params;
      const inviteLink = await generateInviteLink(chatId, req.user.id);
      return res.status(200).json({ inviteLink });
    } catch (err) {
      // generateInviteLink throws for "not a group" and "not the admin"; those
      // used to be swallowed into a generic 500.
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      return next(err);
    }
  },

  async acceptInviteLink(req, res, next) {
    try {
      const { inviteToken } = req.params;
      const currentUserId = req.user.id;

      const invite = await prisma.inviteToken.findUnique({
        where: { token: inviteToken },
        select: { id: true, chatId: true, expiresAt: true, usedAt: true },
      });
      if (!invite) {
        return res
          .status(404)
          .json({ error: "Invalid or expired invite token" });
      }
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ error: "Invite token has expired" });
      }

      const chat = await prisma.chat.findUnique({
        where: { id: invite.chatId },
        select: { id: true, isGroup: true, userIds: true },
      });
      if (!chat || !chat.isGroup) {
        return res.status(404).json({ error: "Group chat not found" });
      }
      if (chat.userIds.includes(currentUserId)) {
        return res
          .status(400)
          .json({ error: "You are already a member of this group chat" });
      }

      await prisma.chat.update({
        where: { id: invite.chatId },
        data: {
          // `connect` maintains userIds; pushing onto the scalar array as well
          // added the member's id to the chat twice.
          users: { connect: { id: currentUserId } },
          lastModified: new Date(),
        },
      });

      publishChatEvent(invite.chatId, "chat:updated", { chatId: invite.chatId });
      return res.json({
        message: "Successfully joined the group chat",
        chatId: invite.chatId,
      });
    } catch (err) {
      return next(err);
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
        select: { id: true, isGroup: true, adminId: true, userIds: true },
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
      if (userIds.includes(currentUserId)) {
        return res
          .status(400)
          .json({ error: "The admin cannot remove themselves from the group" });
      }

      const notMembers = userIds.filter((id) => !chat.userIds.includes(id));
      if (notMembers.length) {
        return res.status(400).json({
          error: `User with id ${notMembers[0]} is not a member of this group chat`,
        });
      }

      const updatedChat = await prisma.chat.update({
        where: { id: chatId },
        data: {
          users: { disconnect: userIds.map((id) => ({ id })) },
          lastModified: new Date(),
        },
        include: {
          users: { select: { id: true, name: true, email: true } },
        },
      });

      publishChatEvent(chatId, "chat:updated", { chatId });
      return res.json({ message: "Users removed successfully", chat: updatedChat });
    } catch (err) {
      return next(err);
    }
  },
};

export default chatController;
