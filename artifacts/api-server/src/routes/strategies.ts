import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { strategiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

function uid() { return Math.random().toString(36).slice(2, 11); }

const fallback = [
  { id:"1", name:"BTC Scalper", kind:"scalping", enabled:1, allocation:20, provider:"anthropic", model:"claude-3-5-sonnet-20241022", exchangeId:"3", paramsJson:JSON.stringify({timeframe:"1m",stop_loss_pct:1.5,take_profit_pct:3,risk_per_trade_pct:1,max_positions:3}), code:"" },
  { id:"2", name:"ETH Momentum", kind:"momentum", enabled:0, allocation:15, provider:"google", model:"gemini-1.5-pro", exchangeId:"2", paramsJson:JSON.stringify({timeframe:"15m",stop_loss_pct:2,take_profit_pct:5,risk_per_trade_pct:0.8,lookback:20}), code:"" },
];

function toApi(s: { id: string; name: string; kind: string; enabled: number; allocation: number; provider: string; model: string; exchangeId: string; paramsJson: string; code: string | null }) {
  return { ...s, code: s.code ?? "", params: JSON.parse(s.paramsJson ?? "{}"), enabled: Boolean(s.enabled), exchange_id: s.exchangeId };
}

router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(strategiesTable);
    res.json(rows.length ? rows.map(toApi) : fallback.map(toApi));
  } catch { res.json(fallback.map(toApi)); }
});

router.post("/", requireAdmin, async (req, res) => {
  const { name, kind, enabled, allocation, provider, model, exchange_id, params, code } = req.body;
  try {
    const [row] = await db.insert(strategiesTable).values({
      id: uid(), name, kind, enabled: enabled ? 1 : 0, allocation, provider, model,
      exchangeId: exchange_id, paramsJson: JSON.stringify(params ?? {}), code,
    }).returning();
    res.status(201).json(toApi(row as typeof fallback[0]));
  } catch (err) { res.status(400).json({ error: String(err) }); }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const { name, kind, enabled, allocation, provider, model, exchange_id, params, code } = req.body;
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined)        patch["name"]       = name;
    if (kind !== undefined)        patch["kind"]       = kind;
    if (enabled !== undefined)     patch["enabled"]    = enabled ? 1 : 0;
    if (allocation !== undefined)  patch["allocation"] = allocation;
    if (provider !== undefined)    patch["provider"]   = provider;
    if (model !== undefined)       patch["model"]      = model;
    if (exchange_id !== undefined) patch["exchangeId"] = exchange_id;
    if (params !== undefined)      patch["paramsJson"] = JSON.stringify(params);
    if (code !== undefined)        patch["code"]       = code;
    const [row] = await db.update(strategiesTable).set(patch).where(eq(strategiesTable.id, String(req.params.id))).returning();
    res.json(toApi(row as typeof fallback[0]));
  } catch (err) { res.status(400).json({ error: String(err) }); }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(strategiesTable).where(eq(strategiesTable.id, String(req.params.id)));
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: String(err) }); }
});

export default router;
