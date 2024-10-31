import express from "express";
import { loginController } from "../controllers";
import authMiddleware from "../middlewares/Auth.middleware";
import passport from "passport";
import { customResponse } from "../../utils/Response";
require("../controllers/auth/passport");
const router = express.Router();
router.use(passport.initialize());
router.use(passport.session());
router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  (req, res) => {
    // Check if req.user exists and contains accessToken
    if (req.user && req.user.accessToken) {
      // Construct the success redirection URL with the access token as a query parameter
      const successRedirectUrl = `http://localhost:3000/google-login?accessToken=${req.user.accessToken}`;

      // Log the access token
      console.log(req.user.accessToken, "req");

      // Optionally, set the access token as a cookie
      // res.cookie("accessToken", req.user.accessToken, {
      //   maxAge: ms("30m"),
      //   httpOnly: true,
      // });

      // Redirect to the success URL with the access token
      res.redirect(successRedirectUrl);
    } else {
      // If req.user or accessToken is missing, redirect to failure URL
      res.redirect("/auth/failure");
    }
  }
);
router.post("/login", loginController.login);
router.post("/register", loginController.register);
router.post("/logout", authMiddleware, loginController.logout);
router.post("/send-otp", loginController.sendOTP);
router.post("/verify-otp", loginController.verifyOtp);
// router.get("/auth/google", (req, res) => {
//   const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile email`;
//   res.redirect(url);
// });

export default router;
