import express from "express";
import { userController } from "../controllers";
import authMiddleware from "../middlewares/Auth.middleware";

const router = express.Router();
router.get("/user-details", authMiddleware, userController.userDetails);

router.get("/search", authMiddleware, userController.searchUsers);
router.post("/forgot/password", userController.forgotPassword);
router.post("/verify/code",  userController.verifyResetCode);
router.post("/reset/password",  userController.resetPassword);
router.get("/user-info", authMiddleware, userController.getUserDetails);
export default router;
