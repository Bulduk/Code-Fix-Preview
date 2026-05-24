/**
 * /api/signals — Signal history and strategy state
 */
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { strategyEngine } from "../lib/strategy-engine.js";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

// GET /api/signals — recent signals from DB
router.get("/", async (req, res) => {
  const limit = Math.min(200, parseInt(req.query["limit"] as string ?? "50"));
  const sym = req.query["sym"] as string | undefined;

  try {
    let query = db.select().from(signalsTable).orderBy(desc(signalsTable.generatedAt)).limit(limit);
    const rows = await query;
    res.json(rows.map((r: typeof rows[0]) => ({
      ...r,
      indicators: r.indicators ? JSON.parse(r.indicators) as Record<string, number> : {},
      reasons: r.reasons ? r.reasons.split("; ") : [],
    })));
  } catch {
    res.json([]);
  }
});

// GET /api/signals/strategies — strategy states
router.get("/strategies", (_req, res) => {
  res.json(strategyEngine.getAll());
});

// POST /api/signals/strategies/:id/start
router.post("/strategies/:id/start", async (req, res) => {
  const id = req.params["id"] ?? "";
  const state = strategyEngine.get(id);
  if (!state) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  await strategyEngine.startStrategy({
    id: state.id,
    name: state.name,
    kind: state.kind,
    enabled: true,
    exchangeId: state.exchangeId,
    params: state.params,
  });
  res.json({ ok: true });
});

// POST /api/signals/strategies/:id/stop
router.post("/strategies/:id/stop", (req, res) => {
  const id = req.params["id"] ?? "";
  strategyEngine.stopStrategy(id);
  res.json({ ok: true });
});

// PATCH /api/signals/strategies/:id/params — hot reload
router.patch("/strategies/:id/params", async (req, res) => {
  const id = req.params["id"] ?? "";
  await strategyEngine.hotReload(id, req.body);
  res.json({ ok: true, state: strategyEngine.get(id) });
});

export default router;
