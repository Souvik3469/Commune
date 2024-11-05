import express from "express";

import authMiddleware from "../middlewares/Auth.middleware";
import chatController from "../controllers/chat/chat";

const router = express.Router();
router.post('/create-chat', authMiddleware,chatController.createChat );
router.get('/get-chats', authMiddleware,chatController.getChats);
router.get('/get-rooms', authMiddleware,chatController.getRooms);
router.delete('/delete-chat/:chatId', authMiddleware,chatController.deleteChat);
router.post('/create-message', authMiddleware, chatController.createMessage);
router.get('/get-messages/:chatId', authMiddleware, chatController.getMessagesByChat);
router.get('/get-unreadmessage/:chatId', authMiddleware, chatController.getUnreadMessages);

router.patch('/update-grpchat/:chatId', authMiddleware, chatController.updateGroupChat);
router.patch('/remove-members/:chatId', authMiddleware, chatController.removeGroupMembers);
router.put('/update-status/:chatId', authMiddleware, chatController.updateMessageStatus);
router.post('/generate-invite/:chatId', authMiddleware, chatController.generateInvite);
router.post('/accept-invite/:inviteToken', authMiddleware, chatController.acceptInviteLink);


export default router;