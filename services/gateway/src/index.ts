import "./env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import {
  createProxyMiddleware,
  fixRequestBody,
} from "http-proxy-middleware";
import { validateEnvironment } from "./env";

validateEnvironment();

const app = express();
const PORT = process.env.GATEWAY_PORT || 4000;

const IDENTITY_SERVICE_URL =
  process.env.IDENTITY_SERVICE_URL || "http://localhost:4001";
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || "http://localhost:4002";
const INTEGRATION_SERVICE_URL =
  process.env.INTEGRATION_SERVICE_URL || "http://localhost:4003";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  cors(
    isProduction
      ? {
          origin: FRONTEND_URL,
          methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
          allowedHeaders: ["Authorization", "Content-Type"],
        }
      : undefined
  )
);
app.use(helmet());
app.use(
  morgan(isProduction ? "combined" : "dev", {
    skip: (req) => req.path === "/health",
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "gateway", status: "ok" });
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests; please try again later" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts; please try again later" },
});

app.use(apiLimiter);
app.use(
  [
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/resend-verification",
  ],
  authLimiter
);

app.use(
  "/auth",
  createProxyMiddleware({
    target: IDENTITY_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/auth": "",
    },
    on: {
      proxyReq: fixRequestBody,
    },
  })
);

app.use(
  "/trips",
  createProxyMiddleware({
    target: TRIP_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) =>
      path === "/" ? "/trips" : `/trips${path.startsWith("/?") ? path.slice(1) : path}`,
    on: {
      proxyReq: fixRequestBody,
    },
  })
);

app.use(
  "/integrations",
  createProxyMiddleware({
    target: INTEGRATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/integrations": "" },
  })
);

const server = app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});

let isShuttingDown = false;

function shutdown(signal: string, exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[Shutdown] ${signal} received; closing gateway`);

  const forceExitTimer = setTimeout(() => {
    console.error("[Shutdown] Gateway did not close within 10 seconds");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close((error) => {
    clearTimeout(forceExitTimer);

    if (error) {
      console.error("[Shutdown] Failed to close gateway:", error);
      process.exit(1);
    }

    console.log("[Shutdown] Gateway closed");
    process.exit(exitCode);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  console.error("[Process] Uncaught exception:", error);
  shutdown("uncaughtException", 1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled rejection:", reason);
  shutdown("unhandledRejection", 1);
});
