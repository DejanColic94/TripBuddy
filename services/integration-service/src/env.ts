import dotenv from "dotenv";

dotenv.config();

export function validateEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const port = Number(process.env.INTEGRATION_SERVICE_PORT || 4003);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("INTEGRATION_SERVICE_PORT must be a valid port number");
  }
}
