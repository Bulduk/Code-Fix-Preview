/**
 * /api/system — VPS sistem durumu ve sağlık monitörü
 * Coolify health check + frontend sistem sayfası için
 */
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { vault } from "../lib/vault.js";
import { db } from "@workspace/db";
import { pnlSnapshotsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import os from "os";

const router = Router();

const startTime = Date.now();

// GET /api/system/status — public health + sistem bilgisi
router.get("/status", async (_req, res) => {
  const uptimeMs  = Date.now() - startTime;
  const uptimeSec = Math.floor(uptimeMs / 1000);

  // DB bağlantı testi
  let dbOk = false;
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    await db.select().from(pnlSnapshotsTable).limit(1);
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch { dbOk = false; }

  // Exchange durumları
  const exchanges = vault.list().map((ex) => ({
    id:          ex.id,
    exchange:    ex.exchange,
    label:       ex.label,
    mode:        ex.mode,
    hasApiKey:   ex.hasApiKey,
    wsConnected: ex.wsConnected ?? false,
    latencyMs:   ex.latencyMs ?? null,
  }));

  // Sistem kaynakları
  const memTotal  = os.totalmem();
  const memFree   = os.freemem();
  const memUsedPct = Math.round(((memTotal - memFree) / memTotal) * 100);
  const loadAvg   = os.loadavg();
  const cpuCount  = os.cpus().length;

  res.json({
    status:    "ok",
    version:   process.env["npm_package_version"] ?? "1.0.0",
    env:       process.env["NODE_ENV"] ?? "development",
    tradeMode: process.env["TRADE_MODE"] ?? "paper",
    uptime: {
      ms:      uptimeMs,
      seconds: uptimeSec,
      human:   formatUptime(uptimeSec),
    },
    db: {
      ok:        dbOk,
      latencyMs: dbLatencyMs,
    },
    exchanges,
    system: {
      platform:   os.platform(),
      arch:       os.arch(),
      nodeVersion: process.version,
      memTotal:   Math.round(memTotal / 1024 / 1024),
      memFree:    Math.round(memFree  / 1024 / 1024),
      memUsedPct,
      loadAvg1m:  loadAvg[0]?.toFixed(2) ?? "0",
      loadAvg5m:  loadAvg[1]?.toFixed(2) ?? "0",
      cpuCount,
    },
    ts: Date.now(),
  });
});

// GET /api/system/health — Coolify / Docker healthcheck için minimal
router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: Math.floor((Date.now() - startTime) / 1000), ts: Date.now() });
});

// GET /api/system/metrics — detaylı metrikler (auth gerekli)
router.get("/metrics", requireAuth, async (_req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    process: {
      pid:      process.pid,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss:      Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    os: {
      hostname:  os.hostname(),
      platform:  os.platform(),
      release:   os.release(),
      cpus:      os.cpus().map((c) => ({ model: c.model, speed: c.speed })),
      loadAvg:   os.loadavg(),
      memTotal:  Math.round(os.totalmem() / 1024 / 1024),
      memFree:   Math.round(os.freemem()  / 1024 / 1024),
      uptime:    Math.floor(os.uptime()),
    },
    ts: Date.now(),
  });
});

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}g ${h}s ${m}d`;
  if (h > 0) return `${h}s ${m}d ${s}sn`;
  if (m > 0) return `${m}d ${s}sn`;
  return `${s}sn`;
}

export default router;
