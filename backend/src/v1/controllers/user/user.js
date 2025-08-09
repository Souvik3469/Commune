import { PrismaClient } from "@prisma/client";
import { customResponse } from "../../../utils/Response";

import { sendEmail } from "../../utils/sendEmail";
const prisma = new PrismaClient();

import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import cloudinary from "../../utils/cloudinary";

const userController = {
  async myDetails(req, res, next) {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.user.id },
      });
      if (!user) {
        return res.status(404).json(customResponse(404, "User not found"));
      }
      res.json(customResponse(200, user));
    } catch (err) {
      console.error("Something went wrong during fetching your details: ", err);
      return res.status(500).json({
        message:
          "Something went wrong during fetching your details. Please try again later.",
      });
    }
  },

  async getUserDetails(req, res, next) {
    try {
      const { userId } = req.query;
      let user;
      user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          name: true,
          email: true,
          phoneNumber: true,
          profilePic: true,
          bio: true,
        },
      });
      res.json(customResponse(200, user));
    } catch (err) {
      console.error("Something went wrong during fetching user details: ", err);
      return res.status(500).json({
        message:
          "Something went wrong during fetching user details. Please try again later.",
      });
    }
  },

  async updateUser(req, res) {
    try {
      const { name, email, password } = req.body;
      const userId = req.user.id;
      let profilePic;
      if (req.file) {
        const localPath = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          req.file.filename
        );
        const uploadResult = await cloudinary.uploader.upload(localPath, {
          folder: "profile_pics",
        });
        profilePic = uploadResult.secure_url;
        fs.unlinkSync(localPath);
      }
      const dataToUpdate = { name, email };
      if (password) {
        dataToUpdate.password = await bcrypt.hash(password, 10);
      }
      if (profilePic) {
        dataToUpdate.profilePic = profilePic;
      }
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: dataToUpdate.name,
          email: dataToUpdate.email,
          password: dataToUpdate.password,
          profilePic: dataToUpdate.profilePic,
          gender: dataToUpdate.gender,
        },
      });
      return res
        .status(200)
        .json({ message: "Profile updated successfully", data: updatedUser });
    } catch (err) {
      console.error("Something went wrong during updating your profile: ", err);
      return res.status(500).json({
        message:
          "Something went wrong during updating your profile. Please try again later.",
      });
    }
  },

  async searchUsers(req, res, next) {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      const users = await prisma.user.findMany({
        where: {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          profilePic: true,
          dob: true,
        },
        orderBy: {
          name: "asc",
        },
      });
      res.json(users);
    } catch (err) {
      console.error("Something went wrong during searching users: ", err);
      return res.status(500).json({
        message:
          "Something went wrong during searching users. Please try again later.",
      });
    }
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // const resetToken = crypto.randomBytes(32).toString("hex");
      // const resetTokenHash = crypto
      //   .createHash("sha256")
      //   .update(resetToken)
      //   .digest("hex");
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      await prisma.user.update({
        where: { email },
        data: {
          resetPasswordToken: resetCode,
          resetPasswordExpiry,
        },
      });
      // const resetURL = `${process.env.DEV_URL2}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      // Send the email
      await sendEmail(
        email,
        "Password Reset Request",
        // `
        //   <p>You requested a password reset.</p>
        //   <p>Click the link below to reset your password:</p>
        //   <a href="${resetURL}">${resetURL}</a>
        //   <p>This link will expire in 15 minutes.</p>
        // `
        `Your password reset code is ${resetCode}. The code will expire in 15 minutes`
      );
      return res.status(200).json({ message: "Password reset email sent" });
    } catch (err) {
      console.error("Something went wrong during forgot password: ", err);
      return res.status(500).json({
        message:
          "Something went wrong during forgot password. Please try again later.",
      });
    }
  },

  async verifyResetCode(req, res) {
    try {
      const { email, resetCode } = req.body;
      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (
        !user ||
        user.resetPasswordToken !== resetCode ||
        user.resetPasswordExpiry < new Date()
      ) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset code" });
      }
      res.status(200).json({ message: "Code verified successfully" });
    } catch (err) {
      console.error("Something went wrong during verifying code: ", err);
      return res.status(500).json({
        message:
          "Something went wrong during verifying code. Please try again later.",
      });
    }
  },

  async resetPassword(req, res) {
    try {
      const { email, newPassword } = req.body;
      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (
        !user ||
        !user.resetPasswordToken ||
        user.resetPasswordExpiry < new Date()
      ) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset code" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpiry: null,
        },
      });
      res.status(200).json({ message: "Password reset successful" });
    } catch (err) {
      console.error("Something went wrong during resetting password: ", err);
      return res.status(500).json({
        message:
          "Something went wrong during resetting password. Please try again later.",
      });
    }
  },
};
export default userController;
