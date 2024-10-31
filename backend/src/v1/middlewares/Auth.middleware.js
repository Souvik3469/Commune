import { NextFunction, Request, Response } from "express";
import createError from "http-errors";
import jwt, { JwtPayload } from "jsonwebtoken";
import prisma from "../../prisma/index";
import config from "../config/env.config";
import qs from "querystring";
import axios from "axios";
// google middleware ->

export const getGoogleOAuthURL = () => {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

  const options = {
    redirect_uri: process.env.REDIRECT_URL,
    client_id: process.env.CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);

  return `${rootUrl}?${qs.toString()}`;
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  const token = authHeader.split(" ")[1];
  let user;
  try {
    const decoded = jwt.verify(token, process.env.USER_ACCESS_SECRET);
    console.log(decoded, "decoded");
    if (!decoded.googleId) {
      // Normal login user
      user = await prisma.user.findUnique({
        where: {
          id: decoded,
        },
      });
    }
    if (!user) {
      // Google login user
      console.log(decoded, "gogoleuid");
      user = await prisma.user.findFirst({
        where: {
          googleId: decoded.googleId,
        },
      });
    }

    if (!user) {
      return res.status(401).json({ message: "Unauthorized. User not found." });
    }

    req.user = user;
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).json({ message: "Unauthorized. Invalid token." });
  }
};

export default authMiddleware;
