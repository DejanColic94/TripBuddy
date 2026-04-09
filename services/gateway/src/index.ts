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
  process.env.IDENTITY_SERVICE_URL || "http://identity-service:4001";

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "gateway", status: "ok" });
});

app.use(
  "/api/auth",
  createProxyMiddleware({
    target: IDENTITY_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/auth": "",
    },
    on: {
      proxyReq: fixRequestBody,
    },
  })
);

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});