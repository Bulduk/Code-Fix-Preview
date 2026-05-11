/**
 * Nexus Trade OS — API Client
 * Gerçek HTTP → /api/* (api-server Express)
 * WS → /ws (api-server WS Hub → OKX canlı + sim ticks)
 * Fallback: DB yoksa mock veri döner (api-server bunu halleder)
 */

const BASE = "/api";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("tok") : null;
  const res   = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────

export type Exchange = {
  id: string; exchange: string; label: string; mode: string;
  is_active: boolean; hasApiKey: boolean; wsConnected?: boolean; latencyMs?: number;
};
export type Strategy = {
  id: string; name: string; kind: string; enabled: boolean;
  allocation: number; provider: string; model: string; exchange_id: string;
  code?: string;
  params: Record<string, unknown>;
};
export type AssetBalance  = { asset: string; free: number; locked: number; usdValue: number; total?: number };
export type ExchangeBalance = {
  exchangeId: string; exchange: string; label: string; mode: string;
  totalUsd: number; assets: AssetBalance[]; fetchedAt: number; error?: string | null;
};
export type PnLSnapshot   = { ts: number; equity: number; realized: number; unrealized: number };
export type OrderRecord   = {
  id: string; exchangeId?: string; exchange: string; sym: string;
  side: string; type: string; qty: number; px: number; avgFillPx?: number;
  fee?: number; status: string; isPaper?: boolean | string; createdAt?: string; ts?: number;
};
export type MarketType = "spot" | "perp" | "futures" | "margin" | "polymarket";

export type Agent = {
  id: string; name: string; provider: string; model: string;
  role: string; active: boolean; exchange_ids: string[]; agent_type: string;
  market_types: MarketType[];
};
export type User       = { id: string; email: string; role: string; totp_enabled: boolean };
export type AuditEntry = { id: string; action: string; target: string; actor: string; ts: number };

// ─── In-memory agent/user store (server-side gelene kadar) ───────────────

let agentStore: Agent[] = [
  {
    id:"1", name:"SpotAnalyst",    provider:"anthropic", model:"claude-3-5-sonnet-20241022",
    agent_type:"llm",      role:"Spot piyasa analizi ve sinyal üretimi",
    active:true,  exchange_ids:["exc-1","exc-3"],
    market_types:["spot"],
  },
  {
    id:"2", name:"PerpGuard",      provider:"anthropic", model:"claude-3-5-haiku-20241022",
    agent_type:"llm",      role:"Perpetual futures risk + pozisyon boyutlama",
    active:true,  exchange_ids:["exc-1","exc-2","exc-3"],
    market_types:["perp","futures"],
  },
  {
    id:"3", name:"MarginScanner",  provider:"google",    model:"gemini-1.5-pro",
    agent_type:"llm",      role:"Marjin işlemler + çoklu borsa sentiment",
    active:false, exchange_ids:["exc-3"],
    market_types:["margin","spot"],
  },
  {
    id:"4", name:"NautilusAgent",  provider:"nautilus",  model:"nautilus-v1",
    agent_type:"nautilus", role:"API gerektirmez — paper trading & backtesting",
    active:true,  exchange_ids:[],
    market_types:["spot","perp","futures"],
  },
  {
    id:"5", name:"PolyOracle",     provider:"openai",    model:"gpt-4o",
    agent_type:"llm",      role:"Polymarket tahmin piyasaları analizi",
    active:false, exchange_ids:[],
    market_types:["polymarket"],
  },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

const ANALYSIS_TEMPLATES = [
  (sym: string, p: string) => `[${p}] ${sym}: RSI(14)=${(55+Math.random()*20).toFixed(1)}, MACD pozitif crossover. Hacim %${(150+Math.random()*200).toFixed(0)} artış. Risk/Ödül: 1:${(1.8+Math.random()).toFixed(1)}. Öneri: BUY, SL:%1.5, TP:%3.`,
  (sym: string, p: string) => `[${p}] ${sym}: Fibonacci %61.8 destek tuttu. Direnç kırılımı bekleniyor. Güven: %${(70+Math.random()*20).toFixed(0)}. Hedef: +%${(3+Math.random()*5).toFixed(1)}.`,
  (sym: string, p: string) => `[${p}] ${sym}: Volatilite spike — ATR normalin ${(1.8+Math.random()).toFixed(1)}x üstünde. Pozisyon boyutu %50 düşürüldü.`,
  (sym: string, p: string) => `[${p}] ${sym}: Piyasa yapısı kırıldı. SELL sinyali aktif. Hedef destek: $${(Math.random()*1000).toFixed(0)}.`,
];
const NAUTILUS_REPLIES = [
  (sym: string) => `[NautilusAgent] ${sym} backtesting tamamlandı. 90 günlük simülasyon: Win rate %${(55+Math.random()*20).toFixed(1)}, Sharpe: ${(1.2+Math.random()).toFixed(2)}, Max DD: %${(8+Math.random()*5).toFixed(1)}.`,
  (sym: string) => `[NautilusAgent] ${sym} paper order yerleştirildi. Fill probability %${(85+Math.random()*10).toFixed(0)}, Expected slippage: ${(0.01+Math.random()*0.05).toFixed(3)}%.`,
  (sym: string) => `[NautilusAgent] AgentIntent doğrulandı. Risk engine: OK. Entry hesaplandı, SL/TP otomatik set edildi.`,
];

// ─── API ──────────────────────────────────────────────────────────────────

export const api = {

  // Auth
  async login(email: string, password: string) {
    return req<{ token: string; role: string; email: string }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    });
  },
  async me() { return req<{ userId: string; email: string; role: string }>("/auth/me"); },

  // Exchanges
  async getExchanges()      { return req<Exchange[]>("/exchanges"); },
  async createExchange(data: Record<string, unknown>)             { return req<Exchange>("/exchanges", { method:"POST", body:JSON.stringify(data) }); },
  async updateExchange(id: string, data: Record<string, unknown>) { return req<Exchange>(`/exchanges/${id}`, { method:"PATCH", body:JSON.stringify(data) }); },
  async deleteExchange(id: string)                                { return req<{ ok: boolean }>(`/exchanges/${id}`, { method:"DELETE" }); },
  async testExchangeConnection(id: string)                        { return req<{ ok: boolean; latencyMs: number }>(`/exchanges/${id}/test`, { method:"POST" }); },
  async getExchangeBalance(id: string)                            { return req<ExchangeBalance>(`/exchanges/${id}/balance`); },
  async getExchangeBalances()                                     { return req<ExchangeBalance[]>("/pnl/balances"); },
  async refreshExchangeBalance(id: string)                        { return api.getExchangeBalance(id).then((b) => ({ exchangeId: id, totalUsd: b.totalUsd, fetchedAt: Date.now() })); },

  // Orders
  async placeOrder(cmd: { ex: string; sym: string; side: string; type: string; qty: number; px?: number }) {
    // ex → exchangeId mapping (vault ile eşleştir)
    const exchanges = await api.getExchanges().catch(() => [] as Exchange[]);
    const match     = exchanges.find((e) => e.exchange === cmd.ex) ?? exchanges[0];
    return req<OrderRecord>("/orders", {
      method: "POST",
      body: JSON.stringify({ exchangeId: match?.id ?? "1", sym: cmd.sym, side: cmd.side, type: cmd.type, qty: cmd.qty, price: cmd.px }),
    });
  },
  async getOrders() { return req<OrderRecord[]>("/orders"); },

  // Strategies
  async getStrategies()    { return req<Strategy[]>("/strategies"); },
  async createStrategy(data: Omit<Strategy, "id">)             { return req<Strategy>("/strategies", { method:"POST", body:JSON.stringify(data) }); },
  async updateStrategy(id: string, data: Partial<Strategy>)    { return req<Strategy>(`/strategies/${id}`, { method:"PATCH", body:JSON.stringify(data) }); },
  async deleteStrategy(id: string)                             { return req<{ ok: boolean }>(`/strategies/${id}`, { method:"DELETE" }); },

  // PnL
  async getPnLSnapshots() { return req<PnLSnapshot[]>("/pnl/snapshots"); },
  async purgePnL(before: number) { return req<{ ok: boolean }>(`/pnl/purge?before=${before}`, { method:"DELETE" }); },

  // Agents (in-memory — VPS entegrasyon gelince burada güncellenir)
  async getAgents()                                        { return [...agentStore]; },
  async updateAgent(id: string, data: Partial<Agent>)     { agentStore = agentStore.map((a) => a.id === id ? { ...a, ...data } : a); return agentStore.find((a) => a.id === id)!; },
  async invokeAgent(id: string, message: string) {
    const agent    = agentStore.find((a) => a.id === id);
    const isNaut   = agent?.agent_type === "nautilus";
    await new Promise((r) => setTimeout(r, isNaut ? 800 : 1400 + Math.random() * 600));
    const sym      = message.match(/\b(BTC|ETH|SOL|BNB|XRP|DOGE|ADA|LINK|MATIC|ARB)\b/i)?.[1]?.toUpperCase() ?? "BTC";
    const provider = agent?.provider === "anthropic" ? "Claude" : agent?.provider === "google" ? "Gemini" : "GPT";
    const tmpl     = isNaut
      ? NAUTILUS_REPLIES[Math.floor(Math.random() * NAUTILUS_REPLIES.length)]
      : ANALYSIS_TEMPLATES[Math.floor(Math.random() * ANALYSIS_TEMPLATES.length)];
    return { reply: tmpl(sym + "USDT", provider) };
  },

  // Users / Audit (admin)
  async getUsers()  {
    return req<User[]>("/auth/users").catch(() =>
      [{ id:"1", email:"admin@nexus.local", role:"admin", totp_enabled:false }] as User[]
    );
  },
  async getAudit()  {
    return req<AuditEntry[]>("/pnl/audit").catch(() => [] as AuditEntry[]);
  },

  // Orchestrator
  async invokeOrchestrator(sym: string, provider: "anthropic" | "google") {
    await new Promise((r) => setTimeout(r, 350));
    const confidence = 0.55 + Math.random() * 0.42;
    const side       = Math.random() > 0.45 ? "buy" : "sell";
    const pLabel     = provider === "anthropic" ? "Claude 3.5 Sonnet" : "Gemini 1.5 Pro";
    return {
      decision: { sym, side: side as "buy"|"sell", confidence, reasoning: `${pLabel}: RSI=${(50+Math.random()*30).toFixed(1)}, momentum ${side==="buy"?"pozitif":"negatif"}. Güven: %${(confidence*100).toFixed(1)}.`, risk_ok: confidence > 0.65 },
      latency_ms: 1100 + Math.floor(Math.random() * 800),
      nodes: [
        { id:"market_data",       latency_ms: 38  + Math.floor(Math.random()*20) },
        { id:"llm_analysis",      latency_ms: 820 + Math.floor(Math.random()*500) },
        { id:"rust_risk",         latency_ms: 7   + Math.floor(Math.random()*10)  },
        { id:"telegram_approval", latency_ms: 0   },
        { id:"ccxt_execute",      latency_ms: 88  + Math.floor(Math.random()*60)  },
      ],
    };
  },

  // Telegram
  async sendTelegramApproval(_chatId: string, decision: { sym: string; side: string; confidence: number }) {
    await new Promise((r) => setTimeout(r, 300));
    return { ok: true, message_id: Math.floor(Math.random() * 99999) };
  },
  async getSystemSettings()            { return {}; },
  async updateSystemSettings(_d: unknown) { return {}; },

  // ── Config / Trade Mode ──────────────────────────────────────────────────
  async getConfig() {
    return req<{
      tradeMode: string; paperTrading: boolean; signalThreshold: number;
      maxConcurrentOrders: number; autoApproveBelow: number;
      defaultExchange: string; defaultProvider: string; updatedAt: number;
    }>("/config").catch(() => ({
      tradeMode: "semi_auto", paperTrading: true, signalThreshold: 0.8,
      maxConcurrentOrders: 5, autoApproveBelow: 0.65,
      defaultExchange: "okx", defaultProvider: "anthropic", updatedAt: Date.now(),
    }));
  },

  async setTradeMode(mode: "manual" | "semi_auto" | "full_auto") {
    return req<{ ok: boolean; prev: string; current: string; warning?: string }>(
      "/config/trade-mode",
      { method: "PATCH", body: JSON.stringify({ mode }) }
    ).catch(() => ({ ok: true as const, prev: mode, current: mode, warning: undefined }));
  },

  async patchConfig(data: Record<string, unknown>) {
    return req<Record<string, unknown>>("/config", {
      method: "PATCH", body: JSON.stringify(data),
    }).catch(() => data);
  },
};
