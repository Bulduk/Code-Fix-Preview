import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initWsHub } from "./lib/ws-hub.js";
import { seedDefaults } from "./lib/seed.js";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = createServer(app);
initWsHub(server);

server.listen(port, () => {
  logger.info({ port }, "Nexus API Server + WS Hub listening");
  // DB hazır olduğunda varsayılan verileri seed et
  seedDefaults().catch((e) => logger.warn({ err: e }, "seedDefaults failed"));
});
