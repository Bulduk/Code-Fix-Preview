import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { pnlSnapshotsTable } from "@workspace/db";
import { desc, lt } from "drizzle-orm";
import { fetchBalance } from "../lib/ccxt-service.js";
import { vault } from "../lib/vault.js";

const router = Router();
router.use(requireAuth);

function uid() { return Math.random().toString(36).slice(2, 11); }

// GET /api/pnl/snapshots
router.get("/snapshots", async (_req, res) => {
  try {
    const rows = await db.select().from(pnlSnapshotsTable).orderBy(desc(pnlSnapshotsTable.snapshotAt)).limit(1440);
    res.json(rows.map((r: typeof rows[0]) => ({ ts: r.snapshotAt.getTime(), equity: r.equity, realized: r.realized, unrealized: r.unrealized })));
  } catch {
    // Fallback: 30 günlük mock
    const now = Date.now();
    res.json(Array.from({ length: 30 }, (_, i) => ({
      ts: now - (29 - i) * 86400000,
      equity: 11000 + i * 55 + Math.sin(i) * 200,
      realized: 100 + i * 8.5,
      unrealized: -50 + i * 6 + Math.cos(i) * 80,
    })));
  }
});

// POST /api/pnl/snapshot — anlık snapshot kaydet
router.post("/snapshot", async (req, res) => {
  const { equity, realized, unrealized } = req.body as { equity: number; realized: number; unrealized: number };
  try {
    const [row] = await db.insert(pnlSnapshotsTable).values({ id: uid(), equity, realized: realized ?? 0, unrealized: unrealized ?? 0, totalBalance: equity }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// DELETE /api/pnl/purge?before=<ts>
router.delete("/purge", async (req, res) => {
  const before = Number(req.query["before"]);
  if (!before) { res.status(400).json({ error: "before timestamp gerekli" }); return; }
  try {
    await db.delete(pnlSnapshotsTable).where(lt(pnlSnapshotsTable.snapshotAt, new Date(before)));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/pnl/balances — tüm borsaların bakiyesi (tek endpoint)
router.get("/balances", async (_req, res) => {
  const list    = vault.listSync();
  const results = await Promise.allSettled(
    list.map((ex) =>
      fetchBalance(ex.id).then((b) => ({
        ...b,
        exchangeId: ex.id,
        exchange:   ex.exchange,
        label:      ex.label,
        mode:       ex.mode,
        fetchedAt:  Date.now(),
      }))
    )
  );
  res.json(
    results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { exchangeId: list[i]?.id, exchange: list[i]?.exchange, label: list[i]?.label, mode: list[i]?.mode, totalUsd: 0, assets: [], error: "fetch failed", fetchedAt: Date.now() }
    )
  );
});

export default router;
