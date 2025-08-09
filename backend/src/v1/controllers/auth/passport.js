const { PrismaClient } = require("@prisma/client");
const passport = require("passport");
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
// const IP = process.env.REACT_APP_IP;
// const REACT_APP_PROD_SSL_SWITCH = process.env.REACT_APP_PROD_SSL_SWITCH;
// const REACT_APP_PROD_SSL_PORT = process.env.REACT_APP_PROD_SSL_PORT;
// const BACKEND_URL =  `${REACT_APP_PROD_SSL_SWITCH}://${IP}:${REACT_APP_PROD_SSL_PORT}/v1`;
const BACKEND_URL = `${process.env.BACKEND_URL}/v1`;
// for the testing purpose use this url
//'http://localhost:5000/v1'
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
      callbackURL: BACKEND_URL + "/auth/google/callback",
    },
    async (req, acc, token, profile, done) => {
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
      const accessToken = jwt.sign(
        { userId: user.id, googleId: user.googleId },
        process.env.USER_ACCESS_SECRET
      );
      return done(null, { user, accessToken });
    }
  )
);
