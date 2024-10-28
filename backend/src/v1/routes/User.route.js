import express from "express";
import { userController } from "../controllers";
import authMiddleware from "../middlewares/Auth.middleware";

const router = express.Router();
router.get("/user-details", authMiddleware, userController.userDetails);
router.post("/profile", authMiddleware, userController.SelectTopic);

export default router;
