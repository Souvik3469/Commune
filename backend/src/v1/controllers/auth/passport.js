const { PrismaClient } = require("@prisma/client");
const passport = require("passport");
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const GoogleStrategy = require("passport-google-oauth2").Strategy;
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});
const prisma = new PrismaClient();
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:5000/v1/auth/google/callback",
    },
    async (req, acc, token, profile, done) => {
      console.log(profile, "profile data");
      let user = await prisma.user.findFirst({
        where: {
          email: profile.email,
        },
      });

      const googlePassword = profile.id;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(googlePassword, salt);

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: profile.displayName,
            email: profile.email,
            googleId: profile.id,
            password: hashedPassword,
          },
        });
      }
      console.log(user, "user");
      const accessToken = jwt.sign(
        { userId: user.id, googleId: user.googleId },
        process.env.USER_ACCESS_SECRET
      );
      return done(null, { user, accessToken });
    }
  )
);
