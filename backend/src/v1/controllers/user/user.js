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

      const defaultProfilePic = "https://i.pravatar.cc/150?u=27";
      const userWithDefaultPhoto = {
        ...user,
        profilePic: user.profilePic || defaultProfilePic,
      };

      res.json(customResponse(200, userWithDefaultPhoto));
    } catch (err) {
      console.log(err, "err");
      res.status(500).json(customResponse(500, "Something went wrong"));
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
      res.json(customResponse(400, err));
      console.log(err, "err");
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
        },
      });

      return res
        .status(200)
        .json({ message: "Profile updated successfully", data: updatedUser });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Something went wrong", error: err.message });
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
      next(err);
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
      console.error("Forgot Password Error:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err.message });
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
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async resetPassword(req, res) {
    try {
      const { email, newPassword } = req.body;
      // console.log("Pass",newPassword)

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
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};
export default userController;
