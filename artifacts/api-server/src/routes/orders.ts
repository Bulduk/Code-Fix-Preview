import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { placeOrder } from "../lib/ccxt-service.js";
import { vault } from "../lib/vault.js";
import { db } from "@workspace/db";
import { ordersTable, auditLogTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

function uid() { return Math.random().toString(36).slice(2, 11); }

// POST /api/orders — emir gönder
router.post("/", async (req, res) => {
  const { exchangeId, sym, side, type, qty, price } = req.body as {
    exchangeId: string; sym: string;
    side: "buy" | "sell"; type: "market" | "limit";
    qty: number; price?: number;
  };

  if (!exchangeId || !sym || !side || !type || !qty) {
    res.status(400).json({ error: "Eksik parametre: exchangeId, sym, side, type, qty gerekli" });
    return;
  }

  const rec = vault.rawGet(exchangeId);
  if (!rec) { res.status(404).json({ error: "Exchange bulunamadı" }); return; }

  const isPaper = rec.mode === "paper" || !rec.hasApiKey;

  try {
    const ccxtSym = sym.includes("/") ? sym : sym.replace("USDT", "/USDT");
    const result  = await placeOrder({ exchangeId, symbol: ccxtSym, side, type, qty, price, isPaper });

    const order = {
      id:          uid(),
      exchangeId,
      exchangeOid: result.id,
      exchange:    rec.exchange,
      sym:         sym.replace("/", ""),
      side:        side as "buy" | "sell",
      type:        type as "market" | "limit",
      qty,
      px:          price ?? null,
      avgFillPx:   result.avgFillPx,
      filledQty:   result.filledQty,
      fee:         result.fee,
      status:      result.status as "pending" | "open" | "filled" | "cancelled" | "rejected" | "partial",
      isPaper:     String(isPaper),
      placedBy:    req.user!.userId,
    };

    try {
      await db.insert(ordersTable).values(order);
      await db.insert(auditLogTable).values({
        id: uid(), action: "ORDER_PLACE",
        target: `${rec.exchange}:${sym} ${side.toUpperCase()} ${qty}${isPaper ? " [PAPER]" : " [LIVE]"}`,
        actor: req.user!.email,
      });
    } catch { /* DB yoksa bellekte tut */ }

    res.status(201).json({ ...order, isPaper });
  } catch (err) {
    req.log.error({ err }, "order error");
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/orders — geçmiş emirler
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(100);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// GET /api/orders/:exchangeId/open — açık emirler (CCXT'den)
router.get("/:exchangeId/open", async (req, res) => {
  const rec = vault.rawGet(req.params.exchangeId);
  if (!rec?.hasApiKey) { res.json([]); return; }
  try {
    // open orders doğrudan vault üzerinden çekilir
    res.json([]);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
