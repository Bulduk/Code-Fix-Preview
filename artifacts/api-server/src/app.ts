import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// CORS — VPS'te nginx aynı origin'den proxy yaptığı için wildcard yeterli
// Production'da VPS_DOMAIN env'den kısıtlanabilir
const allowedOrigins = process.env["ALLOWED_ORIGINS"]
  ? process.env["ALLOWED_ORIGINS"].split(",").map((s) => s.trim())
  : ["*"];

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id:     req.id,
          method: req.method,
          url:    req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy (nginx arkasında çalışıyor)
app.set("trust proxy", 1);

app.use("/api", router);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint bulunamadı" });
});

// Global error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Sunucu hatası";
  logger.error({ err }, "Unhandled application error");
  res.status(500).json({ error: message });
});

export default app;
