import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { WeatherProviderError, getWeatherForecast } from "./weatherService";

const app = express();
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "integration-service", status: "ok" });
});

app.get("/weather", async (req, res) => {
  const destination =
    typeof req.query.destination === "string" ? req.query.destination.trim() : "";
  const startDate =
    typeof req.query.startDate === "string" ? req.query.startDate : "";
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : "";
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const isValidDate = (value: string) => {
    if (!datePattern.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };

  if (!destination) return res.status(400).json({ error: "destination is required" });
  if (destination.length > 255) {
    return res.status(400).json({ error: "destination must be 255 characters or fewer" });
  }
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return res.status(400).json({ error: "startDate and endDate must use YYYY-MM-DD" });
  }
  if (startDate > endDate) {
    return res.status(400).json({ error: "startDate must not be after endDate" });
  }

  try {
    return res.status(200).json(await getWeatherForecast(destination, startDate, endDate));
  } catch (error) {
    if (error instanceof WeatherProviderError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[INTEGRATION] Weather lookup failed:", error);
    return res.status(500).json({ error: "Failed to load weather forecast" });
  }
});

export default app;
