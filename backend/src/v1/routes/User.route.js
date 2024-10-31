import express from "express";
import { userController } from "../controllers";
import authMiddleware from "../middlewares/Auth.middleware";

const router = express.Router();
router.get("/user-details", authMiddleware, userController.userDetails);
router.patch("/profile", authMiddleware, userController.SelectTopic);
router.post("/uploadImage", userController.uploadImage);
export default router;
