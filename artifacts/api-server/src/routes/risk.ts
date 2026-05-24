/**
 * /api/risk — Risk Engine management
 */
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { riskEngine } from "../lib/risk-engine.js";
import { broadcast } from "../lib/ws-hub.js";

const router = Router();
router.use(requireAuth);

// GET /api/risk — current risk state
router.get("/", (_req, res) => {
  res.json(riskEngine.getSummary());
});

// GET /api/risk/config
router.get("/config", (_req, res) => {
  res.json(riskEngine.getConfig());
});

// PATCH /api/risk/config — update risk config
router.patch("/config", requireAdmin, (req, res) => {
  try {
    riskEngine.updateConfig(req.body);
    const config = riskEngine.getConfig();
    broadcast({ type: "risk_config_updated", config, ts: Date.now() });
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/risk/kill-switch/trigger
router.post("/kill-switch/trigger", requireAdmin, (req, res) => {
  const reason = (req.body as { reason?: string }).reason ?? `Manual trigger by ${req.user!.email}`;
  riskEngine.triggerKillSwitch(reason);
  res.json({ ok: true, reason });
});

// POST /api/risk/kill-switch/reset
router.post("/kill-switch/reset", requireAdmin, (req, res) => {
  riskEngine.resetKillSwitch();
  res.json({ ok: true });
});

// POST /api/risk/check — pre-trade risk check
router.post("/check", (req, res) => {
  const { symbol, side, qty, price, stopLoss, takeProfit, exchangeId, atr } = req.body as {
    symbol: string; side: "buy" | "sell"; qty: number; price: number;
    stopLoss?: number; takeProfit?: number; exchangeId: string; atr?: number;
  };

  if (!symbol || !side || !qty || !price) {
    res.status(400).json({ error: "symbol, side, qty, price required" });
    return;
  }

  const result = riskEngine.checkOrder({ symbol, side, qty, price, stopLoss, takeProfit, exchangeId, atr });
  res.json(result);
});

// POST /api/risk/record-trade — record trade outcome
router.post("/record-trade", (req, res) => {
  const { pnlUsd, balance } = req.body as { pnlUsd: number; balance: number };
  riskEngine.recordTrade(pnlUsd, balance);
  res.json({ ok: true, state: riskEngine.getSummary() });
});

export default router;
