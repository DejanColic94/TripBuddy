import "./env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { initDb, testConnection } from "./db";
import tripsRouter from "./routes/trips";
import swaggerSpec from "./swagger";

const app = express();
const PORT = process.env.TRIP_SERVICE_PORT || 4002;

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (_req, res) => {
  res.json({ service: "trip-service", status: "ok" });
});

app.use("/trips", tripsRouter);

app.listen(PORT, async () => {
  console.log(`Trip service running on port ${PORT}`);
  await testConnection();
  await initDb();
});
