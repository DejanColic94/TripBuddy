import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import {
  ExchangeRateProviderError,
  convertCurrency,
} from "./exchangeRateService";
import { LocationProviderError, searchLocations } from "./locationService";
import { WeatherProviderError, getWeatherForecast } from "./weatherService";

const app = express();
app.use(cors());
app.use(helmet());
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    skip: (req) => req.path === "/health",
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "integration-service", status: "ok" });
});

app.get("/locations", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";

  if (query.length < 2) {
    return res.status(400).json({ error: "query must be at least 2 characters" });
  }
  if (query.length > 100) {
    return res.status(400).json({ error: "query must be 100 characters or fewer" });
  }

  try {
    return res.status(200).json({
      locations: await searchLocations(query),
      attribution: "Location data by GeoNames via Open-Meteo.com",
    });
  } catch (error) {
    if (error instanceof LocationProviderError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[INTEGRATION] Location search failed:", error);
    return res.status(500).json({ error: "Failed to search locations" });
  }
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

app.get("/exchange-rate", async (req, res) => {
  const from =
    typeof req.query.from === "string" ? req.query.from.trim().toUpperCase() : "";
  const to =
    typeof req.query.to === "string" ? req.query.to.trim().toUpperCase() : "";
  const amountValue =
    typeof req.query.amount === "string" ? req.query.amount.trim() : "";
  const amount = Number(amountValue);
  const currencyPattern = /^[A-Z]{3}$/;

  if (!currencyPattern.test(from) || !currencyPattern.test(to)) {
    return res.status(400).json({
      error: "from and to must be three-letter currency codes",
    });
  }
  if (
    !amountValue ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1_000_000_000
  ) {
    return res.status(400).json({
      error: "amount must be greater than 0 and at most 1000000000",
    });
  }

  try {
    return res.status(200).json(await convertCurrency(from, to, amount));
  } catch (error) {
    if (error instanceof ExchangeRateProviderError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[INTEGRATION] Currency conversion failed:", error);
    return res.status(500).json({ error: "Failed to convert currency" });
  }
});

export default app;
