import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { ZodError, z } from "zod";
import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import createError from "http-errors";
import ms from "ms";
import { customResponse } from "../../../utils/Response";

const prisma = new PrismaClient();

const userController = {
  async userDetails(req, res, next) {
    try {
      let user;
      user = await prisma.user.findFirst({
        where: {
          id: req.user.id,
        },
      });
      res.json(customResponse(200, user));
    } catch (err) {
      res.json(customResponse(400, err));
      console.log(err, "err");
    }
  },
  async SelectTopic(req, res, next) {
    try {
      const userId = req.user.id;
      const { titles, bio } = req.body;
      console.log(titles);
      console.log(bio, "bio");
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      if (user) {
        await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            bio: bio,
          },
        });
      }
      titles.map(async (title) => {
        await prisma.topics.create({
          data: {
            title: title,
            userId: userId,
          },
        });
      });
      res.status(200).json({
        message: "profile updated",
        success: true,
      });
    } catch (err) {
      console.log(err, "err");
      res.status(200).json({
        message: err,
        success: false,
      });
    }
  },
};
export default userController;
