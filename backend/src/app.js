import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import createError from "http-errors";
import {
  authRoutes,
  chatRoute,
  userRoute,
 
} from "./v1/routes";
import cloudinary from "cloudinary";
import session from "express-session";
import passport from "passport";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";

// Configuration and middleware
const app = express();
const type = process.env.REACT_APP_TYPE;
console.log("Type",type)

const devOrigins = [
  process.env.DEV_URL1,
  process.env.DEV_URL2,
  process.env.DEV_URL3,
];
const prodOrigins = [
  process.env.PROD_URL1,
  process.env.PROD_URL2,
  process.env.PROD_URL3,
];

const corsOrigins = type === "dev" ? devOrigins : prodOrigins;

const server = http.createServer(app);
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});





// Configure general middleware

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({ resave: false, saveUninitialized: true, secret: "ankush" }));
app.use(passport.initialize());
app.use(passport.session());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Express routes
app.use("/v1/auth", authRoutes);
app.use("/v1/user", userRoute);
app.use("/v1/chat", chatRoute);

// Welcome Route
app.all("/", (req, res) =>
  res.send({ message: "API is Up and Running on render 😎🚀" })
);

// // 404 Handler
app.use((req, res, next) => {
  next(createError.NotFound());
});

// Error Handler
app.use((err, req, res, next) => {
  res
    .status(err.status || 500)
    .send({ status: err.status || 500, message: err.message });
});

// failure
// router.get("/failure", userController.failureGoogleLogin);
// Server Configs
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 @ http://localhost:${PORT}`);
  console.log(`Connected to ${process.env.DATABASE_URL}`);
});
