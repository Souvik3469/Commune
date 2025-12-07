import express from "express";
import http from "http";
import cors from "cors";
import createError from "http-errors";
import { authRoutes, chatRoute, userRoute } from "./v1/routes";
import session from "express-session";
import passport from "passport";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";

const app = express();
const type = process.env.REACT_APP_TYPE;

const devOrigins = [process.env.DEV_URL1, process.env.DEV_URL2];
const prodOrigins = [process.env.PROD_URL1, process.env.PROD_URL2];
const corsOrigins = type === "dev" ? devOrigins : prodOrigins;

const httpServer = http.createServer(app);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const io = new Server(httpServer, {
  cors: { origin: "*", credentials: true },
});

io.on("connection", (socket) => {
  // Register user globally
  socket.on("register", ({ userId }) => {
    socket.data.userId = userId;
    socket.join(`user-${userId}`);
  });

  // Join chat room
  socket.on("join", ({ roomId, userId }) => {
    socket.data.userId = userId;
    if (roomId) socket.join(roomId);
  });

  socket.on("leave", ({ roomId }) => {
    if (roomId) socket.leave(roomId);
  });

  // --- WebRTC Signaling ---
  socket.on(
    "offer",
    ({ roomId, from, offer, video, to, callerName, callerAvatar }) => {
      const payload = { from, offer, video, callerName, callerAvatar };
      if (to) {
        socket.to(`user-${to}`).emit("offer", payload); // ✅ direct call
      } else if (roomId) {
        socket.to(roomId).emit("offer", payload); // ✅ group call
      }
    }
  );

  socket.on("answer", ({ roomId, from, answer, to }) => {
    const payload = { from, answer };
    if (to) {
      socket.to(`user-${to}`).emit("answer", payload);
    } else if (roomId) {
      socket.to(roomId).emit("answer", payload);
    }
  });

  socket.on("candidate", ({ roomId, candidate, to }) => {
    const payload = { from: socket.data.userId, candidate };
    if (to) {
      socket.to(`user-${to}`).emit("candidate", payload);
    } else if (roomId) {
      socket.to(roomId).emit("candidate", payload);
    }
  });

  socket.on("end-call", ({ roomId, to }) => {
    const payload = { from: socket.data.userId };
    if (to) {
      socket.to(`user-${to}`).emit("end-call", payload);
    } else if (roomId) {
      socket.to(roomId).emit("end-call", payload);
    }
  });
});

// Middlewares
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({ resave: false, saveUninitialized: true, secret: "commune" }));
app.use(passport.initialize());
app.use(passport.session());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);

// Routes
app.use("/v1/auth", authRoutes);
app.use("/v1/user", userRoute);
app.use("/v1/chat", chatRoute);

app.all("/", (req, res) =>
  res.send({ message: "API is Up and Running on render 😎🚀" })
);

// 404 handler
app.use((req, res, next) => next(createError.NotFound()));

// Error handler
app.use((err, req, res, next) => {
  res
    .status(err.status || 500)
    .send({ status: err.status || 500, message: err.message });
});

const PORT = process.env.PORT || 5000;
// httpServer.listen(PORT, () => {
//   console.log(`🚀 Server running @ http://localhost:${PORT}`);
//   console.log(`Connected to ${process.env.DATABASE_URL}`);
// });

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:5000");
});
