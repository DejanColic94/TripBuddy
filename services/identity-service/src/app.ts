import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/authRoutes";
import swaggerSpec from "./swagger";

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

export default app;
