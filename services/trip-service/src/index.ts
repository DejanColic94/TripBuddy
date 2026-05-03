import "./env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { initDb, testConnection } from "./db";

const app = express();
const PORT = process.env.TRIP_SERVICE_PORT || 4002;

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "trip-service", status: "ok" });
});

app.listen(PORT, async () => {
  console.log(`Trip service running on port ${PORT}`);
  await testConnection();
  await initDb();
});
