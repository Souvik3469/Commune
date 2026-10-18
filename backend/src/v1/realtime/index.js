import { Server } from "socket.io";
import prisma from "../../prisma/index";
import { userIdFromToken, bearerFromHeader } from "../utils/tokens";

/**
 * Room naming. `user:<id>` is a single user's personal room (call offers land
 * here). `chat:<id>` is one conversation — every member of a chat is joined to
 * it for as long as their socket lives, which is what lets the sidebar show a
 * live preview without opening a connection per row.
 */
const userRoom = (userId) => `user:${userId}`;
const chatRoom = (chatId) => `chat:${chatId}`;

let io = null;

export const getIO = () => io;

const isMember = async (userId, chatId) => {
  if (!userId || !chatId) return false;
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userIds: { has: userId } },
      select: { id: true },
    });
    return Boolean(chat);
  } catch (err) {
    // Fail closed: an unreachable database must not admit anyone to a room.
    console.error("Membership check failed:", err.message);
    return false;
  }
};

/**
 * Socket.IO does not catch rejections from async handlers, so an unhandled one
 * takes the whole process down. Every async listener registered below is
 * wrapped.
 */
const safeHandler =
  (label, handler) =>
  (...args) =>
    Promise.resolve(handler(...args)).catch((err) =>
      console.error(`socket handler "${label}" failed:`, err.message)
    );

/**
 * Fan a persisted message out to everyone in the conversation. Called by the
 * chat controller *after* the database transaction commits, so a client can
 * never see a message the database does not have.
 */
export const publishMessage = (chatId, message) => {
  if (!io) return;
  io.to(chatRoom(chatId)).emit("chat:message", message);
};

export const publishChatEvent = (chatId, event, payload) => {
  if (!io) return;
  io.to(chatRoom(chatId)).emit(event, payload);
};

export const initRealtime = (httpServer, corsOrigins) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  /**
   * Handshake authentication. The socket layer used to accept whatever
   * `userId` the client sent in a `register` event, so any client could join
   * another user's personal room and answer their calls. Identity now comes
   * from the same JWT the HTTP routes verify, and is never read from a payload.
   */
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        bearerFromHeader(socket.handshake.headers?.authorization);
      const userId = userIdFromToken(token);
      if (!userId) return next(new Error("Unauthorized"));

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, profilePic: true },
      });
      if (!user) return next(new Error("Unauthorized"));

      socket.data.userId = user.id;
      socket.data.userName = user.name;
      socket.data.userAvatar = user.profilePic || "";
      return next();
    } catch (err) {
      // An unhandled rejection in here crashes the server, so a database blip
      // would take the API down with it. Refuse the handshake instead.
      console.error("Socket handshake failed:", err.message);
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", safeHandler("connection", async (socket) => {
    const { userId } = socket.data;
    socket.join(userRoom(userId));

    // Subscribe to every conversation this user belongs to, so one socket
    // covers the whole sidebar.
    try {
      const chats = await prisma.chat.findMany({
        where: { userIds: { has: userId } },
        select: { id: true },
      });
      chats.forEach((chat) => socket.join(chatRoom(chat.id)));
    } catch (err) {
      console.error("Failed to subscribe socket to chats:", err.message);
    }

    // Chats created or joined after connect.
    socket.on(
      "chat:subscribe",
      safeHandler("chat:subscribe", async ({ chatId } = {}, ack) => {
        if (await isMember(userId, chatId)) {
          socket.join(chatRoom(chatId));
          if (typeof ack === "function") ack({ ok: true });
        } else if (typeof ack === "function") {
          ack({ ok: false });
        }
      })
    );

    socket.on("chat:unsubscribe", ({ chatId } = {}) => {
      if (chatId) socket.leave(chatRoom(chatId));
    });

    /**
     * Typing indicators. Previously published straight from one browser to
     * another over a client-held Ably key, so the sender id and display name
     * were whatever the client claimed. Both are taken from the authenticated
     * socket now, and the event is only relayed into rooms this socket has
     * actually been admitted to.
     */
    socket.on("typing", ({ chatId, typing } = {}) => {
      if (!chatId || !socket.rooms.has(chatRoom(chatId))) return;
      socket.to(chatRoom(chatId)).emit("typing", {
        chatId,
        typing: Boolean(typing),
        userId,
        userName: socket.data.userName,
      });
    });

    // --- WebRTC signalling ---
    // `from`, `callerName` and `callerAvatar` are derived server-side. They
    // used to be forwarded straight from the client, which let a caller present
    // as any user.
    socket.on(
      "join",
      safeHandler("join", async ({ roomId } = {}) => {
        if (!roomId) return;
        if (await isMember(userId, roomId)) socket.join(roomId);
      })
    );

    socket.on("leave", ({ roomId } = {}) => {
      if (roomId) socket.leave(roomId);
    });

    const signal = (event, build) => {
      socket.on(
        event,
        safeHandler(event, (payload = {}) => {
          const { roomId, to } = payload;
          const body = { ...build(payload), from: userId };
          if (to) {
            socket.to(userRoom(to)).emit(event, body);
          } else if (roomId && socket.rooms.has(roomId)) {
            socket.to(roomId).emit(event, body);
          }
        })
      );
    };

    signal("offer", ({ offer, video }) => ({
      offer,
      video: Boolean(video),
      callerName: socket.data.userName,
      callerAvatar: socket.data.userAvatar,
    }));
    signal("answer", ({ answer }) => ({ answer }));
    signal("candidate", ({ candidate }) => ({ candidate }));
    signal("end-call", () => ({}));
  }));

  return io;
};

export default initRealtime;
