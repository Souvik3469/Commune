import express from "express";
import http from "http";
import cors from "cors";
import createError from "http-errors";
import helmet from "helmet";
import morgan from "morgan";

import { authRoutes, chatRoute, userRoute } from "./v1/routes";
import { generalLimiter } from "./v1/middlewares/rateLimiters";
import { initRealtime } from "./v1/realtime";
import { startSandboxCron } from "./v1/cron/sandboxReset.cron";
import prisma from "./prisma/index";

const app = express();
const type = process.env.REACT_APP_TYPE;

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
const corsOrigins = (type === "dev" ? devOrigins : prodOrigins).filter(Boolean);

const httpServer = http.createServer(app);

app.set("trust proxy", 1);

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

// The socket server shares the HTTP allow-list. It used to run `origin: "*"`
// with `credentials: true`, so any page on the internet could open a socket.
initRealtime(httpServer, corsOrigins);

// Middlewares
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// express-session and passport used to be mounted here with a hardcoded
// secret. The Google strategy they existed for was never registered and auth
// is entirely JWT-based, so the session layer has been removed rather than
// given a secret it had no use for.

app.use(generalLimiter);

// Routes
app.use("/v1/auth", authRoutes);
app.use("/v1/user", userRoute);
app.use("/v1/chat", chatRoute);

app.all("/", (req, res) =>
  res.send({ message: "API is Up and Running on render 😎🚀" })
);

app.get("/healthz", async (req, res) => {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    res.json({ status: "ok", database: "up" });
  } catch {
    res.status(503).json({ status: "degraded", database: "down" });
  }
});

startSandboxCron();

// 404 handler
app.use((req, res, next) => next(createError.NotFound()));

// Error handler. Unexpected failures used to return `err.message` verbatim,
// which leaks driver and query internals; only deliberate 4xx messages are
// safe to pass through.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error("Unhandled error:", err);
  }
  res.status(status).send({
    status,
    message:
      status >= 500
        ? "Something went wrong. Please try again later."
        : err.message,
  });
});

const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running @ ${BACKEND_URL}`);
  // The old log claimed "Connected to MONGODB" unconditionally, without ever
  // having asked the database anything.
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    console.log("✅ Database reachable");
  } catch (err) {
    console.error("❌ Database unreachable:", err.message);
  }
});

/**
 * Node's default for an unhandled rejection is to terminate the process, so a
 * single stray promise anywhere — a socket handler, a cron tick — could take
 * the whole API down. Log it and stay up.
 */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down`);
  httpServer.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

["SIGINT", "SIGTERM"].forEach((signal) =>
  process.on(signal, () => shutdown(signal))
);

export default app;
