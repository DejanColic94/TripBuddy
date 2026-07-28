import "./env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
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

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "gateway", status: "ok" });
});

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
