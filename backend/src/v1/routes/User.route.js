import express from "express";
import { userController } from "../controllers";
import authMiddleware from "../middlewares/Auth.middleware";
import upload from "../middlewares/upload";
import { otpLimiter, emailLimiter } from "../middlewares/rateLimiters";

const router = express.Router();

router.get("/my-details", authMiddleware, userController.myDetails);
router.patch(
  "/update-profile",
  authMiddleware,
  upload.single("profilePic"),
  userController.updateUser
);
router.get("/search", authMiddleware, userController.searchUsers);
router.get("/user-info", authMiddleware, userController.getUserDetails);

router.post("/forgot/password", emailLimiter, userController.forgotPassword);
router.post("/verify/code", otpLimiter, userController.verifyResetCode);
router.post("/reset/password", otpLimiter, userController.resetPassword);

export default router;
