import express from "express";
import { loginController } from "../controllers";
import authMiddleware from "../middlewares/Auth.middleware";
import upload from "../middlewares/upload";
import {
  authLimiter,
  otpLimiter,
  emailLimiter,
} from "../middlewares/rateLimiters";

const router = express.Router();

// Credential and code endpoints get their own budgets rather than sharing the
// global one with message reads.
router.post("/login", authLimiter, loginController.login);
router.post(
  "/register",
  authLimiter,
  upload.single("profilePic"),
  loginController.register
);
router.post("/logout", authMiddleware, loginController.logout);
router.post("/send-otp", emailLimiter, loginController.sendOTP);
router.post("/verify-otp", otpLimiter, loginController.verifyOtp);

export default router;
