import { PrismaClient } from "@prisma/client";
import { customResponse } from "../../../utils/Response";

const prisma = new PrismaClient();
const AWS = require("aws-sdk");
const S3 = new AWS.S3();

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const userController = {
  async uploadImage(req, res, next) {
    try {
      const { fileName } = req.body;

      if (!fileName) {
        return res.status(400).send({ message: "File name is required" });
      }

      const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Expires: 60 * 60,
        ContentType: "image/*",
      };

      const url = await userController.getPresignUrlPromiseFunction(
        S3,
        s3Params
      );
      const fileLink = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      if (url) {
        return res.status(200).send({ url, fileLink });
      } else {
        return res
          .status(500)
          .send({ message: "Failed to generate presigned URL" });
      }
    } catch (err) {
      return res
        .status(500)
        .send({ message: "Internal Server Error", error: err.message });
    }
  },

  async getPresignUrlPromiseFunction(S3, s3Params) {
    return new Promise((resolve, reject) => {
      S3.getSignedUrl("putObject", s3Params, (err, url) => {
        if (err) {
          return reject(err);
        }
        resolve(url);
      });
    });
  },

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
                    mode: 'insensitive', 
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
                name: 'asc',
            },
        });

        res.json(users);
    } catch (err) {
        next(err);
    }
}
};
export default userController;
