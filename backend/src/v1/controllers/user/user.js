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

  async SelectTopic(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        phoneNumber,
        titles,
        bio,
        gender,
        collegeName,
        state,
        city,
        stream,
        yearofstudy,
        kyc,
        collegeID,
        dob,
        profilePic,
      } = req.body;

      console.log(titles);
      console.log(bio, "bio");

      const updateData = {};

      if (bio) updateData.bio = bio;
      if (gender) updateData.gender = gender;
      if(dob) updateData.dob=dob
      if (stream) updateData.stream = stream;
      if (yearofstudy) updateData.yearofstudy = yearofstudy;
      if (state) updateData.state = state;
      if (collegeID) updateData.collegeId = collegeID;
      if (kyc) updateData.kyc = kyc;
      if (profilePic) updateData.profilePic = profilePic;
      if (city) updateData.city = city;
      if (collegeName) updateData.collegeName = collegeName;
      if(phoneNumber) updateData.phoneNumber=phoneNumber

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
          data: updateData,
        });
        await prisma.user.update({
          where: {
            id:userId
          },
          data:{
            active:true
          }
        });
      }

      if (titles) {
        const titlePromises = titles.map(async (title) => {
          return await prisma.topic.create({
            data: {
              title: title,
              userId: userId,
            },
          });
        });
        await Promise.all(titlePromises);
      }

      res.status(200).json({
        message: "Profile updated",
        success: true,
      });
    } catch (err) {
      console.log(err, "err");
      res.status(200).json({
        message: err.message || "An error occurred",
        success: false,
      });
    }
  },
};
export default userController;
