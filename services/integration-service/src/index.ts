import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const PORT = Number(process.env.INTEGRATION_SERVICE_PORT) || 4003;

const server = app.listen(PORT, () => {
  console.log(`Integration service running on port ${PORT}`);
});

let isShuttingDown = false;

function shutdown(signal: string, exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[Shutdown] ${signal} received; closing integration service`);

  const forceExitTimer = setTimeout(() => {
    console.error("[Shutdown] Integration service did not close within 10 seconds");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close((error) => {
    clearTimeout(forceExitTimer);

    if (error) {
      console.error("[Shutdown] Failed to close integration service:", error);
      process.exit(1);
    }

    console.log("[Shutdown] Integration service closed");
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
