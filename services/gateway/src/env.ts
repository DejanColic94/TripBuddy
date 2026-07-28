import dotenv from "dotenv";

dotenv.config();

const unsafeValues = new Set(["change_me", "<PLACEHOLDER>"]);

export function validateEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const requiredVariables = [
    "IDENTITY_SERVICE_URL",
    "TRIP_SERVICE_URL",
    "INTEGRATION_SERVICE_URL",
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
