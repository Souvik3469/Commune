import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

import bcrypt from "bcrypt";
import { sendOTPEmail } from "../../services/EmailService";
import createError from "http-errors";
import ms from "ms";
import { customResponse } from "../../../utils/Response";
import { genOtp } from "../../utils/utils";
import fs from "fs";
import path from "path";
import cloudinary from "../../utils/cloudinary";

const prisma = new PrismaClient();

const loginController = {
  async register(req, res) {
    try {
      const { name, email, password, gender } = req.body;
      const defaultAvatar =
        "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small_2x/default-avatar-icon-of-social-media-user-vector.jpg";

      if (!name || !email || !password || !gender) {
        return res
          .status(400)
          .json({ message: "All fields except profilePic are required" });
      }

      let profilePic = defaultAvatar;

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

        // Delete local file after upload
        fs.unlinkSync(localPath);
      }

      const existingUser = await prisma.user.findFirst({ where: { email } });

      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const userCount = await prisma.user.count({ where: { name } });
      const username = `@${name}${userCount + 1}`.toLowerCase();

      const hashedPassword = await bcrypt.hash(password, 10);

      const createdUser = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          username,
          // gender,
          profilePic,
        },
      });

      const accessToken = jwt.sign(
        createdUser.id,
        process.env.USER_ACCESS_SECRET
      );

      res.cookie("accessToken", accessToken, {
        maxAge: 30 * 60 * 1000,
        httpOnly: true,
      });

      return res.status(200).json({
        message: "User created successfully",
        data: { createdUser, accessToken },
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Something went wrong", error: err.message });
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = await req.body;
      console.log(password);
      let user;
      user = await prisma.user.findFirst({
        where: {
          email,
        },
      });

      if (!user) {
        return next(createError.Unauthorized("Verify your Credentials"));
      }
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return next(createError.Unauthorized("Verify your Credentials1"));
      }

      const accessToken = jwt.sign(user.id, process.env.USER_ACCESS_SECRET);

      res.cookie("accessToken", accessToken, {
        maxAge: ms("30m"),
        httpOnly: true,
      });

      res.json(customResponse(200, { accessToken }));
    } catch (err) {
      console.log(err);
      res.status(400).json({
        message: err,
      });
    }
  },

  async logout(req, res, next) {
    try {
      res.clearCookie("accessToken");
      res.json(customResponse(200, "Logged Out"));
    } catch (err) {
      console.log(err);
      return next(createError.InternalServerError());
    }
  },

  async sendOTP(req, res, next) {
    try {
      const { email } = req.query;
      console.log(email, "email");
      prisma.otp.deleteMany({
        where: {
          email: email,
        },
      });
      const otp = genOtp();
      console.log(otp, "otp");

      await prisma.otp.create({
        data: {
          email: email,
          otp: otp,
        },
      });
      console.log(email);

      // Send OTP via email
      // await sendEmail(
      //   email,
      //   "OTP Verification from DuoCortex",
      //   `<p>Your OTP is: <strong>${otp}</strong></p>`
      // );
      sendOTPEmail(otp, email, "User1 name");

      res.status(200).json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },

  async verifyOtp(req, res, next) {
    try {
      const { email } = req.query;
      const { otp } = req.body;
      const existingOTP = await prisma.otp.findFirst({
        where: {
          email,
          otp,
        },
      });
      if (existingOTP) {
        await prisma.otp.delete({
          where: {
            id: existingOTP.id,
          },
        });

        res
          .status(200)
          .json({ success: true, message: "OTP verification successful" });
      } else {
        // OTP is invalid
        res.status(400).json({ success: false, error: "Invalid OTP" });
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
};
export default loginController;
