import express from "express";
import authMiddleware from "../middlewares/Auth.middleware";
import { chatController } from "../controllers";
import upload from "../middlewares/upload";

const router = express.Router();

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
router.get("/get-chats", authMiddleware, chatController.getChats);
router.get("/get-rooms", authMiddleware, chatController.getRooms);
router.delete("/:chatId", authMiddleware, chatController.deleteChat);
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
