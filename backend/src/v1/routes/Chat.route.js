import express from "express";

import authMiddleware from "../middlewares/Auth.middleware";
import chatController from "../controllers/chat/chat";

const router = express.Router();
router.post('/create-chat', authMiddleware,chatController.createChat );
router.get('/get-chats', authMiddleware,chatController.getChats);
router.post('/create-message', authMiddleware, chatController.createMessage);
router.get('/get-messages/:chatId', authMiddleware, chatController.getMessagesByChat);


export default router;