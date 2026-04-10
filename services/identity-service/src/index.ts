import "./env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes";
import { testConnection } from "./db";

const app = express();
const PORT = process.env.IDENTITY_SERVICE_PORT || 4001;

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[IDENTITY] ${req.method} ${req.url}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ service: "identity-service", status: "ok" });
});

app.get("/", (_req, res) => {
  res.json({ service: "identity-service", message: "identity root works" });
});

app.use("/", authRoutes);

app.listen(PORT, async () => {
  console.log(`Identity service running on port ${PORT}`);
  await testConnection();
});