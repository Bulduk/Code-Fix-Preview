/**
 * /api/config — sistem yapılandırması
 * Trade modu backend'de saklanır → Nautilus/Barter-rs buradan okur.
 */
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

// In-memory config (production'da DB'ye taşı)
type TradeMode = "manual" | "semi_auto" | "full_auto";

const systemState: {
  tradeMode: TradeMode;
  paperTrading: boolean;
  signalThreshold: number;
  maxConcurrentOrders: number;
  autoApproveBelow: number;
  defaultExchange: string;
  defaultProvider: string;
  updatedAt: number;
} = {
  tradeMode: (process.env["TRADE_MODE"] as TradeMode) ?? "semi_auto",
  paperTrading: process.env["TRADE_MODE"] !== "live",
  signalThreshold: 0.80,
  maxConcurrentOrders: 5,
  autoApproveBelow: 0.65,
  defaultExchange: "okx",
  defaultProvider: "anthropic",
  updatedAt: Date.now(),
};

router.use(requireAuth);

// GET /api/config — tüm sistem durumu
router.get("/", (_req, res) => {
  res.json(systemState);
});

// PATCH /api/config/trade-mode — mod değiştir
router.patch("/trade-mode", async (req, res) => {
  const { mode } = req.body as { mode: TradeMode };
  const VALID: TradeMode[] = ["manual", "semi_auto", "full_auto"];
  if (!VALID.includes(mode)) {
    res.status(400).json({ error: `Geçersiz mod: ${mode}. Geçerli: ${VALID.join(", ")}` });
    return;
  }

  const prev = systemState.tradeMode;
  systemState.tradeMode   = mode;
  systemState.paperTrading = mode !== "full_auto" || systemState.paperTrading;
  systemState.updatedAt   = Date.now();

  req.log.info({ prev, next: mode, actor: req.user?.email }, "Trade mode değişti");

  // WebSocket'e broadcast (basit impl — production'da event bus kullan)
  res.json({
    ok: true,
    prev,
    current: mode,
    paperTrading: systemState.paperTrading,
    updatedAt: systemState.updatedAt,
    warning: mode === "full_auto" && !systemState.paperTrading
      ? "⚠️ TAM OTO + CANLI MOD: Emirler onaysız gönderiliyor"
      : undefined,
  });
});

// PATCH /api/config — genel config güncelle
router.patch("/", requireAdmin, (req, res) => {
  const allowed = ["paperTrading","signalThreshold","maxConcurrentOrders","autoApproveBelow","defaultExchange","defaultProvider"] as const;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      (systemState as Record<string, unknown>)[key] = req.body[key];
    }
  }
  systemState.updatedAt = Date.now();
  res.json(systemState);
});

export default router;
export type { TradeMode };
export { systemState };
