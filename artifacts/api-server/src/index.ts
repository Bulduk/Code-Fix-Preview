import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initWsHub } from "./lib/ws-hub.js";
import { seedDefaults } from "./lib/seed.js";

const port = Number(process.env["PORT"] ?? 8080);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Geçersiz PORT değeri: "${process.env["PORT"]}"`);
}

const server = createServer(app);
initWsHub(server);

server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Nexus API Server + WS Hub dinleniyor");
  seedDefaults().catch((e) => logger.warn({ err: e }, "seedDefaults başarısız"));
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM alındı — graceful shutdown başlıyor");
  server.close(() => {
    logger.info("HTTP server kapatıldı");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
});

process.on("SIGINT", () => {
  logger.info("SIGINT alındı");
  server.close(() => process.exit(0));
});
