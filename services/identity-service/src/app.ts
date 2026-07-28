import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/authRoutes";
import internalRoutes from "./routes/internalRoutes";
import swaggerSpec from "./swagger";

const app = express();

app.use(cors());
app.use(helmet());
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    skip: (req) => req.path === "/health",
  })
);
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (_req, res) => {
  res.json({ service: "identity-service", status: "ok" });
});

app.get("/", (_req, res) => {
  res.json({ service: "identity-service", message: "identity root works" });
});

app.use("/internal", internalRoutes);
app.use("/", authRoutes);

export default app;
