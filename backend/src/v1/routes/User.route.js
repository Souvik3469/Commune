import express from "express";
import { userController } from "../controllers";
import authMiddleware from "../middlewares/Auth.middleware";
import upload from "../middlewares/upload";

const router = express.Router();
router.get("/my-details", authMiddleware, userController.myDetails);
router.patch(
  "/update-profile",
  authMiddleware,
  upload.single("profilePic"),
  userController.updateUser
);
router.get("/search", authMiddleware, userController.searchUsers);
router.post("/forgot/password", userController.forgotPassword);
router.post("/verify/code", userController.verifyResetCode);
router.post("/reset/password", userController.resetPassword);
router.get("/user-info", authMiddleware, userController.getUserDetails);
export default router;
