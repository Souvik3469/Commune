import fs from "fs/promises";
import bcrypt from "bcrypt";
import crypto from "crypto";
import createError from "http-errors";

import prisma from "../../../prisma/index";
import cloudinary from "../../utils/cloudinary";
import { sendOTPEmail } from "../../services/EmailService";
import { customResponse } from "../../../utils/Response";
import { genOtp } from "../../utils/utils";
import { signAccessToken } from "../../utils/tokens";
import { publicUser } from "../../utils/publicUser";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small_2x/default-avatar-icon-of-social-media-user-vector.jpg";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_TRIES = 5;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Length-independent comparison, so a wrong code cannot be timed. */
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const normaliseEmail = (email) => String(email || "").trim().toLowerCase();

/** Username must be unique in the schema, so collisions are retried. */
const mintUsername = async (name) => {
  const base = `@${String(name).replace(/\s+/g, "")}`.toLowerCase();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate =
      attempt === 0
        ? base
        : `${base}${crypto.randomInt(1000, 9999)}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}${crypto.randomBytes(4).toString("hex")}`;
};

const loginController = {
  async register(req, res, next) {
    const file = req.file;
    try {
      const { name, password, gender } = req.body;
      const email = normaliseEmail(req.body.email);

      if (!name?.trim() || !email || !password || !gender) {
        return res
          .status(400)
          .json({ message: "All fields except profilePic are required" });
      }
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address" });
      }
      if (String(password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      let profilePic = DEFAULT_AVATAR;
      if (file) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: "profile_pics",
        });
        profilePic = uploadResult.secure_url;
      }

      const createdUser = await prisma.user.create({
        data: {
          email,
          name: name.trim(),
          password: await bcrypt.hash(password, 10),
          // The old scheme was `@${name}${countOfUsersWithThatName + 1}`,
          // which races and collides whenever two people share a name.
          username: await mintUsername(name),
          gender,
          profilePic,
        },
      });

      const accessToken = signAccessToken(createdUser.id);
      res.cookie("accessToken", accessToken, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.REACT_APP_TYPE !== "dev",
      });

      return res.status(201).json({
        message: "User created successfully",
        // `createdUser` was returned whole, bcrypt hash included.
        data: { createdUser: publicUser(createdUser), accessToken },
      });
    } catch (err) {
      return next(err);
    } finally {
      if (file) await fs.unlink(file.path).catch(() => {});
    }
  },

  async login(req, res, next) {
    try {
      const email = normaliseEmail(req.body?.email);
      const { password } = req.body || {};
      if (!email || !password) {
        return next(createError.Unauthorized("Verify your Credentials"));
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Hash anyway so a missing account is not measurably faster than a
        // wrong password.
        await bcrypt.compare(password, "$2b$10$invalidinvalidinvalidinvalidinv");
        return next(createError.Unauthorized("Verify your Credentials"));
      }

      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return next(createError.Unauthorized("Verify your Credentials"));
      }

      const accessToken = signAccessToken(user.id);
      res.cookie("accessToken", accessToken, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.REACT_APP_TYPE !== "dev",
      });
      return res.json(customResponse(200, { accessToken }));
    } catch (err) {
      return next(err);
    }
  },

  async logout(req, res, next) {
    try {
      res.clearCookie("accessToken");
      return res.json(customResponse(200, "Logged Out"));
    } catch (err) {
      return next(err);
    }
  },

  async sendOTP(req, res, next) {
    try {
      const email = normaliseEmail(req.query.email);
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address" });
      }

      // This delete was never awaited, so a previous OTP could outlive the one
      // replacing it and both stayed valid.
      await prisma.otp.deleteMany({ where: { email } });

      const otp = genOtp();
      await prisma.otp.create({
        data: {
          email,
          otp,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      });

      await sendOTPEmail(otp, email, "there");
      return res
        .status(200)
        .json({ success: true, message: "OTP sent successfully" });
    } catch (err) {
      return next(err);
    }
  },

  async verifyOtp(req, res, next) {
    try {
      const email = normaliseEmail(req.query.email);
      const { otp } = req.body || {};
      if (!email || !otp) {
        return res.status(400).json({ success: false, error: "Invalid OTP" });
      }

      const existingOTP = await prisma.otp.findFirst({
        where: { email },
        orderBy: { createdAt: "desc" },
      });

      // OTPs had no expiry and no attempt ceiling: a six-digit numeric code
      // that stayed valid indefinitely is a few thousand requests from guessed.
      if (!existingOTP || existingOTP.expiresAt < new Date()) {
        if (existingOTP) {
          await prisma.otp.delete({ where: { id: existingOTP.id } });
        }
        return res
          .status(400)
          .json({ success: false, error: "Invalid or expired OTP" });
      }

      if (existingOTP.tries >= OTP_MAX_TRIES) {
        await prisma.otp.delete({ where: { id: existingOTP.id } });
        return res.status(429).json({
          success: false,
          error: "Too many attempts. Please request a new code.",
        });
      }

      if (!safeEqual(existingOTP.otp, otp)) {
        await prisma.otp.update({
          where: { id: existingOTP.id },
          data: { tries: { increment: 1 } },
        });
        return res.status(400).json({ success: false, error: "Invalid OTP" });
      }

      await prisma.otp.delete({ where: { id: existingOTP.id } });
      return res
        .status(200)
        .json({ success: true, message: "OTP verification successful" });
    } catch (err) {
      return next(err);
    }
  },
};

export default loginController;
