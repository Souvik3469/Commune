import express from "express";
import authMiddleware from "../middlewares/Auth.middleware";
import chatController from "../controllers/chat/chat";
import upload from "../middlewares/upload";

const router = express.Router();

// 📁 Chat creation & fetching
router.post(
  "/create",
  authMiddleware,
  upload.single("logo"),
  chatController.createChat
);

router.put(
  "/update/:chatId",
  authMiddleware,
  upload.single("logo"),
  chatController.updateGroupChat
);

router.get("/get-chats", authMiddleware, chatController.getChats); // one-to-one
router.get("/get-rooms", authMiddleware, chatController.getRooms); // group chats
router.delete("/:chatId", authMiddleware, chatController.deleteChat); // delete chat

// 📁 Messages
router.post("/send", authMiddleware, chatController.createMessage);
router.get(
  "/:chatId/messages",
  authMiddleware,
  chatController.getMessagesByChat
);
router.get("/:chatId/unread", authMiddleware, chatController.getUnreadMessages);
router.put(
  "/:chatId/status",
  authMiddleware,
  chatController.updateMessageStatus
);

// 📁 Group chat management
router.patch(
  "/:chatId/update",
  authMiddleware,
  upload.single("logo"),
  chatController.updateGroupChat
);
router.patch(
  "/:chatId/remove-members",
  authMiddleware,
  chatController.removeGroupMembers
);

// 📁 Group invite links
router.post(
  "/:chatId/invite-link",
  authMiddleware,
  chatController.generateInvite
);
router.post(
  "/accept-invite/:inviteToken",
  authMiddleware,
  chatController.acceptInviteLink
);

router.get("/:chatId", authMiddleware, chatController.getChatById);

export default router;
