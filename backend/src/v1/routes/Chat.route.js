import express from "express";
import authMiddleware from "../middlewares/Auth.middleware";
import { chatController } from "../controllers";
import upload from "../middlewares/upload";

const router = express.Router();

router.use(authMiddleware);

router.post("/create", upload.single("logo"), chatController.createChat);
router.get("/get-chats", chatController.getChats);
router.get("/get-rooms", chatController.getRooms);
router.post("/send", chatController.createMessage);
router.post("/accept-invite/:inviteToken", chatController.acceptInviteLink);

// `PUT /update/:chatId` used to exist alongside this and map to the same
// handler; the duplicate has been dropped.
router.patch(
  "/:chatId/update",
  upload.single("logo"),
  chatController.updateGroupChat
);
router.get("/:chatId/messages", chatController.getMessagesByChat);
router.get("/:chatId/unread", chatController.getUnreadMessages);
router.put("/:chatId/status", chatController.updateMessageStatus);
router.patch("/:chatId/remove-members", chatController.removeGroupMembers);
router.post("/:chatId/invite-link", chatController.generateInvite);
router.delete("/:chatId", chatController.deleteChat);

// Keep the catch-all id route last so it cannot shadow the paths above.
router.get("/:chatId", chatController.getChatById);

export default router;
