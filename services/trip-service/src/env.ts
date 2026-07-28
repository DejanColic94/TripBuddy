import dotenv from "dotenv";

dotenv.config();

const unsafeValues = new Set(["change_me", "<PLACEHOLDER>"]);

export function validateEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const requiredVariables = [
    "TRIP_DB_HOST",
    "TRIP_DB_NAME",
    "TRIP_DB_USER",
    "TRIP_DB_PASSWORD",
    "TRIP_JWT_SECRET",
    "IDENTITY_SERVICE_URL",
    "INTERNAL_SERVICE_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "FRONTEND_URL",
  ];
  const invalidVariables = requiredVariables.filter((name) => {
    const value = process.env[name]?.trim();
    return !value || unsafeValues.has(value);
  });

  if (invalidVariables.length > 0) {
    throw new Error(
      `Missing or unsafe production environment variables: ${invalidVariables.join(", ")}`
    );
  }
}
