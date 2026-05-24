/**
 * /api/ai — AI Orchestrator endpoints
 */
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { aiOrchestrator } from "../lib/ai-orchestrator.js";
import { getGateway, getAllGateways } from "../lib/binance-futures.js";
import { systemState } from "./config.js";

const router = Router();
router.use(requireAuth);

// GET /api/ai/agents
router.get("/agents", (_req, res) => {
  res.json(aiOrchestrator.getAgents());
});

// PATCH /api/ai/agents/:id
router.patch("/agents/:id", requireAdmin, (req, res) => {
  const idParam = req.params["id"] ?? "";
  const id = Array.isArray(idParam) ? (idParam[0] ?? "") : idParam;
  const updated = aiOrchestrator.updateAgent(id, req.body);
  if (!updated) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(updated);
});

// POST /api/ai/run — run full orchestration flow
router.post("/run", async (req, res) => {
  const { symbol, exchangeId } = req.body as { symbol?: string; exchangeId?: string };
  const sym = symbol ?? "BTCUSDT";
  const exId = Array.isArray(exchangeId) ? exchangeId[0] : exchangeId;

  // Find a gateway
  let gateway = exId ? getGateway(exId) : undefined;
  if (!gateway) {
    const gateways = getAllGateways();
    gateway = gateways.values().next().value;
  }

  if (!gateway) {
    res.status(400).json({ error: "No active gateway found" });
    return;
  }

  try {
    // Get candles
    const candles = await gateway.fetchOHLCV(sym, "15m", 100);
    const balance = await gateway.getBalance();
    const positions = await gateway.getPositions();

    const result = await aiOrchestrator.run({
      symbol: sym,
      candles,
      currentPrice: candles[candles.length - 1]?.close ?? 0,
      balance: balance.availableBalance,
      openPositions: positions.length,
      tradeMode: systemState.tradeMode as "manual" | "semi_auto" | "full_auto",
      signalThreshold: systemState.signalThreshold,
      autoApproveBelow: systemState.autoApproveBelow,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/ai/memory
router.get("/memory", (req, res) => {
  const symbol = req.query["symbol"] as string | undefined;
  res.json(aiOrchestrator.getMemory(symbol));
});

// DELETE /api/ai/memory
router.delete("/memory", requireAdmin, (_req, res) => {
  aiOrchestrator.clearMemory();
  res.json({ ok: true });
});

// POST /api/ai/memory/:flowId/outcome — record trade outcome
router.post("/memory/:flowId/outcome", (req, res) => {
  const flowId = req.params["flowId"] ?? "";
  const { outcome, pnl } = req.body as { outcome: "win" | "loss"; pnl: number };
  aiOrchestrator.recordOutcome(flowId, outcome, pnl);
  res.json({ ok: true });
});

export default router;
