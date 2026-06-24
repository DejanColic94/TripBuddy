import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import {
  createProxyMiddleware,
  fixRequestBody,
} from "http-proxy-middleware";

dotenv.config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 4000;

const IDENTITY_SERVICE_URL =
  process.env.IDENTITY_SERVICE_URL || "http://localhost:4001";
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || "http://localhost:4002";

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "gateway", status: "ok" });
});

app.use(
  "/auth",
  createProxyMiddleware({
    target: IDENTITY_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/auth": "",
    },
    on: {
      proxyReq: fixRequestBody,
    },
  })
);

app.use(
  "/trips",
  createProxyMiddleware({
    target: TRIP_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) =>
      path === "/" ? "/trips" : `/trips${path.startsWith("/?") ? path.slice(1) : path}`,
    on: {
      proxyReq: fixRequestBody,
    },
  })
);

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});
