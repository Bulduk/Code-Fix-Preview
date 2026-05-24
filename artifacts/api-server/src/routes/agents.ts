/**
 * /api/agents — Ajan yönetimi
 * In-memory store (VPS entegrasyonunda DB'ye taşınır)
 */
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

export type MarketType = "spot" | "perp" | "futures" | "margin" | "polymarket";

export interface AgentRecord {
  id: string;
  name: string;
  provider: string;
  model: string;
  role: string;
  active: boolean;
  exchange_ids: string[];
  agent_type: string;
  market_types: MarketType[];
  createdAt: number;
  updatedAt: number;
}

// In-memory agent store — seed data
const agentStore: AgentRecord[] = [
  {
    id: "1", name: "SpotAnalyst", provider: "anthropic",
    model: "claude-3-5-sonnet-20241022", agent_type: "llm",
    role: "Spot piyasa analizi ve sinyal üretimi",
    active: true, exchange_ids: ["1", "3"],
    market_types: ["spot"],
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: "2", name: "PerpGuard", provider: "anthropic",
    model: "claude-3-5-haiku-20241022", agent_type: "llm",
    role: "Perpetual futures risk + pozisyon boyutlama",
    active: true, exchange_ids: ["1", "2", "3"],
    market_types: ["perp", "futures"],
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: "3", name: "MarginScanner", provider: "google",
    model: "gemini-1.5-pro", agent_type: "llm",
    role: "Marjin işlemler + çoklu borsa sentiment",
    active: false, exchange_ids: ["3"],
    market_types: ["margin", "spot"],
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: "4", name: "NautilusAgent", provider: "nautilus",
    model: "nautilus-v1", agent_type: "nautilus",
    role: "API gerektirmez — paper trading & backtesting",
    active: true, exchange_ids: [],
    market_types: ["spot", "perp", "futures"],
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: "5", name: "PolyOracle", provider: "openai",
    model: "gpt-4o", agent_type: "llm",
    role: "Polymarket tahmin piyasaları analizi",
    active: false, exchange_ids: [],
    market_types: ["polymarket"],
    createdAt: Date.now(), updatedAt: Date.now(),
  },
];

// Simüle LLM yanıtları
const ANALYSIS_TEMPLATES = [
  (sym: string, p: string) =>
    `[${p}] ${sym}: RSI(14)=${(55 + Math.random() * 20).toFixed(1)}, MACD pozitif crossover. Hacim %${(150 + Math.random() * 200).toFixed(0)} artış. Risk/Ödül: 1:${(1.8 + Math.random()).toFixed(1)}. Öneri: BUY, SL:%1.5, TP:%3.`,
  (sym: string, p: string) =>
    `[${p}] ${sym}: Fibonacci %61.8 destek tuttu. Direnç kırılımı bekleniyor. Güven: %${(70 + Math.random() * 20).toFixed(0)}. Hedef: +%${(3 + Math.random() * 5).toFixed(1)}.`,
  (sym: string, p: string) =>
    `[${p}] ${sym}: Volatilite spike — ATR normalin ${(1.8 + Math.random()).toFixed(1)}x üstünde. Pozisyon boyutu %50 düşürüldü. Bekle.`,
  (sym: string, p: string) =>
    `[${p}] ${sym}: Piyasa yapısı kırıldı. SELL sinyali aktif. Hedef destek: $${(Math.random() * 1000).toFixed(0)}.`,
  (sym: string, p: string) =>
    `[${p}] ${sym}: Bollinger Band sıkışması — büyük hareket bekleniyor. Yön belirsiz, pozisyon alma. Hacim onayı bekle.`,
];

const NAUTILUS_REPLIES = [
  (sym: string) =>
    `[NautilusAgent] ${sym} backtesting tamamlandı. 90 günlük simülasyon: Win rate %${(55 + Math.random() * 20).toFixed(1)}, Sharpe: ${(1.2 + Math.random()).toFixed(2)}, Max DD: %${(8 + Math.random() * 5).toFixed(1)}.`,
  (sym: string) =>
    `[NautilusAgent] ${sym} paper order yerleştirildi. Fill probability %${(85 + Math.random() * 10).toFixed(0)}, Expected slippage: ${(0.01 + Math.random() * 0.05).toFixed(3)}%.`,
  (sym: string) =>
    `[NautilusAgent] AgentIntent doğrulandı. Risk engine: OK. Entry hesaplandı, SL/TP otomatik set edildi. Pozisyon açıldı.`,
  (sym: string) =>
    `[NautilusAgent] ${sym} portföy simülasyonu: Kelly criterion ile optimal pozisyon boyutu %${(1 + Math.random() * 3).toFixed(1)} sermaye.`,
];

// GET /api/agents
router.get("/", (_req, res) => {
  res.json(agentStore);
});

// GET /api/agents/:id
router.get("/:id", (req, res) => {
  const agent = agentStore.find((a) => a.id === req.params.id);
  if (!agent) { res.status(404).json({ error: "Ajan bulunamadı" }); return; }
  res.json(agent);
});

// PATCH /api/agents/:id
router.patch("/:id", (req, res) => {
  const idx = agentStore.findIndex((a) => a.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Ajan bulunamadı" }); return; }

  const allowed = ["name", "role", "provider", "model", "active", "exchange_ids", "market_types"] as const;
  const patch: Partial<AgentRecord> = { updatedAt: Date.now() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = req.body[key];
    }
  }
  agentStore[idx] = { ...agentStore[idx]!, ...patch };
  res.json(agentStore[idx]);
});

// POST /api/agents/:id/invoke — LLM simülasyon (gerçek API key eklenince buraya bağlanır)
router.post("/:id/invoke", async (req, res) => {
  const agent = agentStore.find((a) => a.id === req.params.id);
  if (!agent) { res.status(404).json({ error: "Ajan bulunamadı" }); return; }
  if (!agent.active) { res.status(400).json({ error: "Ajan pasif durumda" }); return; }

  const { message } = req.body as { message: string };
  if (!message) { res.status(400).json({ error: "message gerekli" }); return; }

  const isNautilus = agent.agent_type === "nautilus";
  const delay = isNautilus ? 800 : 1400 + Math.random() * 600;
  await new Promise((r) => setTimeout(r, delay));

  const sym = message.match(/\b(BTC|ETH|SOL|BNB|XRP|DOGE|ADA|LINK|MATIC|ARB)\b/i)?.[1]?.toUpperCase() ?? "BTC";
  const symPair = sym + "USDT";
  const provider = agent.provider === "anthropic" ? "Claude" : agent.provider === "google" ? "Gemini" : "GPT";

  const tmpl = isNautilus
    ? NAUTILUS_REPLIES[Math.floor(Math.random() * NAUTILUS_REPLIES.length)]
    : ANALYSIS_TEMPLATES[Math.floor(Math.random() * ANALYSIS_TEMPLATES.length)];

  res.json({
    reply: tmpl(symPair, provider),
    agentId: agent.id,
    agentName: agent.name,
    latencyMs: Math.round(delay),
    ts: Date.now(),
  });
});

// POST /api/agents — yeni ajan oluştur
router.post("/", (req, res) => {
  const { name, provider, model, role, agent_type, exchange_ids, market_types } = req.body as Partial<AgentRecord>;
  if (!name || !provider || !model) {
    res.status(400).json({ error: "name, provider, model gerekli" });
    return;
  }
  const newAgent: AgentRecord = {
    id: Math.random().toString(36).slice(2, 9),
    name: name!,
    provider: provider!,
    model: model!,
    role: role ?? "",
    active: true,
    agent_type: agent_type ?? "llm",
    exchange_ids: exchange_ids ?? [],
    market_types: market_types ?? ["spot"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  agentStore.push(newAgent);
  res.status(201).json(newAgent);
});

// DELETE /api/agents/:id
router.delete("/:id", (req, res) => {
  const idx = agentStore.findIndex((a) => a.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Ajan bulunamadı" }); return; }
  agentStore.splice(idx, 1);
  res.json({ ok: true });
});

export default router;
