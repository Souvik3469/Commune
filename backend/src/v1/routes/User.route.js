import express from "express";
import { userController } from "../controllers";
import authMiddleware from "../middlewares/Auth.middleware";

const router = express.Router();
router.get("/user-details", authMiddleware, userController.userDetails);
router.patch("/profile", authMiddleware, userController.SelectTopic);
router.post("/uploadImage", userController.uploadImage);
router.get("/connect", authMiddleware, userController.connect);
router.get("/search", authMiddleware, userController.searchUsers);
router.post("/forgot/password", userController.forgotPassword);
router.post("/verify/code",  userController.verifyResetCode);
router.post("/reset/password",  userController.resetPassword);
export default router;
