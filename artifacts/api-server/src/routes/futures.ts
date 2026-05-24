/**
 * /api/futures — Binance Futures specific endpoints
 * Positions, leverage, margin type, hedge mode, funding rates, OHLCV
 */
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { getGateway, createGateway, getAllGateways } from "../lib/binance-futures.js";
import { vault } from "../lib/vault.js";
import { riskEngine } from "../lib/risk-engine.js";
import { db } from "@workspace/db";
import { positionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

function pid(p: string | string[]): string {
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

// GET /api/futures/positions — all open positions across all gateways
router.get("/positions", async (_req, res) => {
  const results: Record<string, unknown>[] = [];

  for (const [exchangeId, gateway] of getAllGateways()) {
    try {
      const positions = await gateway.getPositions();
      for (const pos of positions) {
        results.push({ ...pos, exchangeId });
      }
    } catch (err) {
      results.push({ exchangeId, error: String(err) });
    }
  }

  res.json(results);
});

// GET /api/futures/:exchangeId/positions
router.get("/:exchangeId/positions", async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  try {
    const positions = await gateway.getPositions();
    res.json(positions);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/futures/:exchangeId/balance
router.get("/:exchangeId/balance", async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  try {
    const balance = await gateway.getBalance();
    res.json(balance);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/futures/:exchangeId/orders
router.get("/:exchangeId/orders", async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const symbol = req.query["symbol"] as string | undefined;
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  try {
    const orders = await gateway.getOpenOrders(symbol);
    res.json(orders);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/futures/:exchangeId/orders — place futures order
router.post("/:exchangeId/orders", async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  const { symbol, side, type, amount, price, stopPrice, reduceOnly, positionSide, strategyId } = req.body as {
    symbol: string; side: "buy" | "sell"; type: string;
    amount: number; price?: number; stopPrice?: number;
    reduceOnly?: boolean; positionSide?: "LONG" | "SHORT" | "BOTH";
    strategyId?: string;
  };

  if (!symbol || !side || !type || !amount) {
    res.status(400).json({ error: "symbol, side, type, amount required" });
    return;
  }

  // Risk check
  const currentPrice = gateway.getMarkPrice(symbol) || price || 0;
  const riskCheck = riskEngine.checkOrder({
    symbol, side, qty: amount, price: currentPrice, exchangeId,
  });

  if (!riskCheck.approved) {
    res.status(403).json({
      error: "Risk check failed",
      reasons: riskCheck.reasons,
    });
    return;
  }

  try {
    const order = await gateway.placeOrder({
      symbol, side,
      type: type as "market" | "limit" | "stop_market" | "stop_limit",
      amount: riskCheck.adjustedQty ?? amount,
      price,
      stopPrice,
      reduceOnly,
      positionSide,
      strategyId,
      placedBy: req.user!.userId,
    });

    res.status(201).json({
      ...order,
      riskAdjusted: riskCheck.reasons.length > 0,
      riskReasons: riskCheck.reasons,
    });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// DELETE /api/futures/:exchangeId/orders/:orderId
router.delete("/:exchangeId/orders/:orderId", async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const orderId = pid(req.params["orderId"] ?? "");
  const symbol = req.query["symbol"] as string;
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  try {
    await gateway.cancelOrder(orderId, symbol);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/futures/:exchangeId/close-position
router.post("/:exchangeId/close-position", async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const { symbol, percentage } = req.body as { symbol: string; percentage?: number };
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  try {
    const order = await gateway.closePosition(symbol, percentage ?? 100);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// PATCH /api/futures/:exchangeId/leverage
router.patch("/:exchangeId/leverage", requireAdmin, async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const { symbol, leverage } = req.body as { symbol: string; leverage: number };
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  if (!symbol || !leverage || leverage < 1 || leverage > 125) {
    res.status(400).json({ error: "symbol and leverage (1-125) required" });
    return;
  }

  try {
    await gateway.setLeverage(symbol, leverage);
    res.json({ ok: true, symbol, leverage });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// PATCH /api/futures/:exchangeId/margin-type
router.patch("/:exchangeId/margin-type", requireAdmin, async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const { symbol, marginType } = req.body as { symbol: string; marginType: "ISOLATED" | "CROSSED" };
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  try {
    await gateway.setMarginType(symbol, marginType);
    res.json({ ok: true, symbol, marginType });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/futures/:exchangeId/ohlcv
router.get("/:exchangeId/ohlcv", async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const symbol = req.query["symbol"] as string ?? "BTCUSDT";
  const timeframe = req.query["timeframe"] as string ?? "1h";
  const limit = Math.min(500, parseInt(req.query["limit"] as string ?? "200"));
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  try {
    const ohlcv = await gateway.fetchOHLCV(symbol, timeframe, limit);
    res.json(ohlcv);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/futures/:exchangeId/funding-rate
router.get("/:exchangeId/funding-rate", async (req, res) => {
  const exchangeId = pid(req.params["exchangeId"] ?? "");
  const symbol = req.query["symbol"] as string ?? "BTCUSDT";
  const gateway = getGateway(exchangeId);

  if (!gateway) {
    res.status(404).json({ error: "Gateway not found" });
    return;
  }

  try {
    const rate = await gateway.fetchFundingRate(symbol);
    res.json(rate);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/futures/status — all gateway statuses
router.get("/status", (_req, res) => {
  const statuses: Record<string, unknown>[] = [];
  for (const [id, gateway] of getAllGateways()) {
    statuses.push({ exchangeId: id, ...gateway.getStatus() });
  }
  res.json(statuses);
});

export default router;
