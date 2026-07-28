import "./env";
import app from "./app";
import pool, { initDb, testConnection } from "./db";
import { validateEnvironment } from "./env";

const PORT = process.env.IDENTITY_SERVICE_PORT || 4001;

let server: ReturnType<typeof app.listen> | undefined;
let isShuttingDown = false;

async function start(): Promise<void> {
  validateEnvironment();
  await testConnection();
  await initDb();

  server = app.listen(PORT, () => {
    console.log(`Identity service running on port ${PORT}`);
  });
}

function shutdown(signal: string, exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[Shutdown] ${signal} received; closing identity service`);

  const forceExitTimer = setTimeout(() => {
    console.error("[Shutdown] Identity service did not close within 10 seconds");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  const closeResources = async (): Promise<void> => {
    try {
      await pool.end();
      clearTimeout(forceExitTimer);
      console.log("[Shutdown] Identity service closed");
      process.exit(exitCode);
    } catch (error) {
      console.error("[Shutdown] Failed to close identity service:", error);
      process.exit(1);
    }
  };

  if (!server) {
    void closeResources();
    return;
  }

  server.close((error) => {
    if (error) {
      console.error("[Shutdown] Failed to stop identity HTTP server:", error);
      exitCode = 1;
    }
    void closeResources();
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

void start().catch((error) => {
  console.error("[Startup] Identity service failed to start:", error);
  shutdown("startup failure", 1);
});
