import fs from "fs/promises";
import bcrypt from "bcrypt";
import crypto from "crypto";

import prisma from "../../../prisma/index";
import cloudinary from "../../utils/cloudinary";
import { customResponse } from "../../../utils/Response";
import { sendEmail } from "../../utils/utils";
import { publicUser, publicUserSelect } from "../../utils/publicUser";

const RESET_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_TRIES = 5;
const MIN_PASSWORD_LENGTH = 8;
const SEARCH_LIMIT = 25;

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const normaliseEmail = (email) => String(email || "").trim().toLowerCase();

/**
 * Loads the reset candidate for an email and says whether `code` is the live
 * one. Returns `null` when there is nothing to reset, so callers can answer
 * identically whether the account exists or not.
 */
const checkResetCode = async (email, code) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      resetPasswordToken: true,
      resetPasswordExpiry: true,
      resetPasswordTries: true,
    },
  });
  if (!user || !user.resetPasswordToken || !user.resetPasswordExpiry) {
    return { user: null, valid: false };
  }
  if (user.resetPasswordExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        resetPasswordTries: 0,
      },
    });
    return { user: null, valid: false };
  }
  if (user.resetPasswordTries >= RESET_MAX_TRIES) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        resetPasswordTries: 0,
      },
    });
    return { user: null, valid: false };
  }

  const valid = safeEqual(user.resetPasswordToken, code);
  if (!valid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordTries: { increment: 1 } },
    });
  }
  return { user, valid };
};

const userController = {
  async myDetails(req, res, next) {
    try {
      // req.user is already the public projection; it used to be the whole row,
      // password hash and live reset code included.
      return res.json(customResponse(200, req.user));
    } catch (err) {
      return next(err);
    }
  },

  async getUserDetails(req, res, next) {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          profilePic: true,
          bio: true,
        },
      });
      if (!user) {
        return res.status(404).json(customResponse(404, "User not found"));
      }
      return res.json(customResponse(200, user));
    } catch (err) {
      return next(err);
    }
  },

  async updateUser(req, res, next) {
    const file = req.file;
    try {
      const { name, password, bio, gender, phoneNumber } = req.body;
      const userId = req.user.id;

      if (password && String(password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        });
      }

      // Email is deliberately not updatable here. It is the login identifier
      // and the password-reset channel, so changing it needs its own verified
      // flow rather than a field on the profile form.
      const data = {};
      if (name?.trim()) data.name = name.trim();
      if (bio !== undefined) data.bio = bio;
      // `gender` was read into a local object but then assigned from a key that
      // was never set, so this field could never actually be updated.
      if (gender !== undefined) data.gender = gender;
      if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;
      if (password) data.password = await bcrypt.hash(password, 10);

      if (file) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: "profile_pics",
        });
        data.profilePic = uploadResult.secure_url;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "Nothing to update" });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
        select: publicUserSelect,
      });

      return res
        .status(200)
        .json({ message: "Profile updated successfully", data: updatedUser });
    } catch (err) {
      return next(err);
    } finally {
      if (file) await fs.unlink(file.path).catch(() => {});
    }
  },

  async searchUsers(req, res, next) {
    try {
      const query = String(req.query.query || "").trim();
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const users = await prisma.user.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
          // Searching never usefully returns yourself.
          id: { not: req.user.id },
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          profilePic: true,
          dob: true,
        },
        orderBy: { name: "asc" },
        // The result set used to be unbounded, so a one-character query
        // returned every matching user in the database.
        take: SEARCH_LIMIT,
      });
      return res.json(users);
    } catch (err) {
      return next(err);
    }
  },

  async forgotPassword(req, res, next) {
    try {
      const email = normaliseEmail(req.body?.email);
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      // Answer the same way whether or not the account exists. A 404 here
      // turned this endpoint into an account-enumeration oracle.
      if (user) {
        const resetCode = crypto.randomInt(100000, 1000000).toString();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            resetPasswordToken: resetCode,
            resetPasswordExpiry: new Date(Date.now() + RESET_TTL_MS),
            resetPasswordTries: 0,
          },
        });

        const sent = await sendEmail(
          email,
          "Password Reset Request",
          `Your password reset code is ${resetCode}. The code will expire in 15 minutes`
        );
        if (!sent) {
          // The mailer used to swallow its own failures, so this endpoint
          // reported success for mail it had not sent.
          return res.status(502).json({
            message: "Could not send the reset email. Please try again later.",
          });
        }
      }

      return res.status(200).json({
        message:
          "If an account exists for that address, a reset code has been sent.",
      });
    } catch (err) {
      return next(err);
    }
  },

  async verifyResetCode(req, res, next) {
    try {
      const email = normaliseEmail(req.body?.email);
      const { resetCode } = req.body || {};
      if (!email || !resetCode) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset code" });
      }

      const { valid } = await checkResetCode(email, resetCode);
      if (!valid) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset code" });
      }
      return res.status(200).json({ message: "Code verified successfully" });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * The reset code is checked here too. This handler used to accept
   * `{ email, newPassword }` and only assert that *some* unexpired reset code
   * existed on the account — it never compared the caller's code against it, so
   * anyone who knew an email address that had requested a reset could set that
   * account's password without ever seeing the code.
   */
  async resetPassword(req, res, next) {
    try {
      const email = normaliseEmail(req.body?.email);
      const { resetCode, newPassword } = req.body || {};

      if (!email || !resetCode || !newPassword) {
        return res
          .status(400)
          .json({ message: "Email, reset code and new password are required" });
      }
      if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        });
      }

      const { user, valid } = await checkResetCode(email, resetCode);
      if (!user || !valid) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset code" });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: await bcrypt.hash(newPassword, 10),
          resetPasswordToken: null,
          resetPasswordExpiry: null,
          resetPasswordTries: 0,
        },
      });

      return res.status(200).json({ message: "Password reset successful" });
    } catch (err) {
      return next(err);
    }
  },
};

export { publicUser };
export default userController;
