export type Exchange = {
  id: string; exchange: string; label: string; mode: string;
  is_active: boolean; ws_connected?: boolean; latency_ms?: number;
};
export type Strategy = {
  id: string; name: string; kind: string; enabled: boolean;
  allocation: number; provider: string; model: string;
  exchange_id: string;
  params: {
    timeframe?: string;
    stop_loss_pct?: number;
    take_profit_pct?: number;
    risk_per_trade_pct?: number;
    max_positions?: number;
    lookback?: number;
    z_score?: number;
    grid_levels?: number;
    [key: string]: unknown;
  };
};
export type User = { id: string; email: string; role: string; totp_enabled: boolean };
export type AuditEntry = { id: string; action: string; target: string; actor: string; ts: number };
export type Agent = {
  id: string; name: string; provider: "anthropic" | "google" | "openai";
  model: string; role: string; active: boolean;
};
export type PnLSnapshot = { ts: number; equity: number; realized: number; unrealized: number };
export type OrderRecord = {
  id: string; ex: string; sym: string; side: string;
  type: string; qty: number; px: number; status: string; ts: number;
};

export type OrchInvokeResult = {
  decision: {
    sym: string; side: "buy" | "sell"; confidence: number;
    reasoning: string; risk_ok: boolean;
  };
  latency_ms: number;
  nodes: { id: string; latency_ms: number }[];
};

let exchangeStore: Exchange[] = [
  { id: "1", exchange: "binance", label: "main", mode: "live", is_active: true, ws_connected: true, latency_ms: 12 },
  { id: "2", exchange: "bybit", label: "hedge", mode: "testnet", is_active: true, ws_connected: true, latency_ms: 18 },
  { id: "3", exchange: "okx", label: "alt", mode: "paper", is_active: false, ws_connected: false, latency_ms: 0 },
];

let strategyStore: Strategy[] = [
  {
    id: "1", name: "BTC Scalper", kind: "scalping", enabled: true,
    allocation: 20, provider: "anthropic", model: "claude-3-5-sonnet-20241022",
    exchange_id: "1",
    params: { timeframe: "1m", stop_loss_pct: 1.5, take_profit_pct: 3.0, risk_per_trade_pct: 1.0, max_positions: 3 },
  },
  {
    id: "2", name: "ETH Momentum", kind: "momentum", enabled: false,
    allocation: 15, provider: "google", model: "gemini-1.5-pro",
    exchange_id: "2",
    params: { timeframe: "15m", stop_loss_pct: 2.0, take_profit_pct: 5.0, risk_per_trade_pct: 0.8, lookback: 20 },
  },
  {
    id: "3", name: "SOL Mean Rev", kind: "meanreversion", enabled: true,
    allocation: 10, provider: "anthropic", model: "claude-3-5-haiku-20241022",
    exchange_id: "1",
    params: { timeframe: "5m", stop_loss_pct: 1.0, take_profit_pct: 2.5, risk_per_trade_pct: 0.5, z_score: 2.0 },
  },
  {
    id: "4", name: "BTC/ETH Grid", kind: "grid", enabled: false,
    allocation: 25, provider: "openai", model: "gpt-4o",
    exchange_id: "2",
    params: { timeframe: "1h", stop_loss_pct: 5.0, take_profit_pct: 10.0, risk_per_trade_pct: 2.0, grid_levels: 10 },
  },
];

let userStore: User[] = [
  { id: "1", email: "admin@nexus.local", role: "admin", totp_enabled: true },
  { id: "2", email: "trader@nexus.local", role: "trader", totp_enabled: false },
  { id: "3", email: "viewer@nexus.local", role: "viewer", totp_enabled: false },
];

let auditStore: AuditEntry[] = [
  { id: "1", action: "LOGIN", target: "admin@nexus.local", actor: "admin@nexus.local", ts: Date.now() - 60000 },
  { id: "2", action: "STRATEGY_TOGGLE", target: "BTC Scalper", actor: "admin@nexus.local", ts: Date.now() - 120000 },
  { id: "3", action: "EXCHANGE_ADD", target: "bybit/hedge", actor: "admin@nexus.local", ts: Date.now() - 300000 },
  { id: "4", action: "ORDER_PLACE", target: "binance:BTCUSDT BUY 0.01", actor: "admin@nexus.local", ts: Date.now() - 600000 },
  { id: "5", action: "RISK_UPDATE", target: "stopLoss=2%", actor: "admin@nexus.local", ts: Date.now() - 900000 },
  { id: "6", action: "ORCH_RUN", target: "Hello Trade Flow", actor: "system", ts: Date.now() - 1200000 },
];

let agentStore: Agent[] = [
  { id: "1", name: "MarketAnalyst", provider: "anthropic", model: "claude-3-5-sonnet-20241022", role: "Piyasa analizi ve sinyal üretimi", active: true },
  { id: "2", name: "RiskGuard", provider: "anthropic", model: "claude-3-5-haiku-20241022", role: "Risk limiti denetimi ve pozisyon boyutlama", active: true },
  { id: "3", name: "GeminiScanner", provider: "google", model: "gemini-1.5-pro", role: "Çoklu borsa sentiment taraması", active: false },
  { id: "4", name: "GPTAdvisor", provider: "openai", model: "gpt-4o", role: "Makro ekonomi yorumlama", active: false },
];

let orderStore: OrderRecord[] = [
  { id: "o1", ex: "binance", sym: "BTCUSDT", side: "buy", type: "limit", qty: 0.01, px: 66000, status: "filled", ts: Date.now() - 900000 },
  { id: "o2", ex: "bybit", sym: "ETHUSDT", side: "sell", type: "market", qty: 0.2, px: 3510, status: "filled", ts: Date.now() - 1800000 },
  { id: "o3", ex: "binance", sym: "SOLUSDT", side: "buy", type: "limit", qty: 2.5, px: 148, status: "cancelled", ts: Date.now() - 3600000 },
];

let pnlSnapshots: PnLSnapshot[] = Array.from({ length: 30 }, (_, i) => ({
  ts: Date.now() - (29 - i) * 86400000,
  equity: 11000 + i * 50 + Math.sin(i) * 200,
  realized: 100 + i * 8,
  unrealized: -50 + i * 6 + Math.cos(i) * 80,
}));

function delay(ms = 120) { return new Promise((r) => setTimeout(r, ms)); }
function uid() { return Math.random().toString(36).slice(2, 9); }

const ANALYSIS_TEMPLATES = [
  (sym: string, provider: string) =>
    `[${provider.toUpperCase()}] ${sym} analizi tamamlandı. RSI(14)=67.3, üst BB'ye yakın. Kısa vadeli momentum pozitif ancak aşırı alım bölgesine giriyor. Risk/ödül oranı: 1:2.4. Öneri: BUY — kademeli giriş, SL: %1.5, TP: %3.0`,
  (sym: string, provider: string) =>
    `[${provider.toUpperCase()}] ${sym}: 4h grafik kırılma sinyali. Hacim %340 artış, MACD pozitif crossover. Sentiment analizi: %74 boğa. Önerilen pozisyon: LONG, risk %0.8/işlem. Likidite: yüksek.`,
  (sym: string, provider: string) =>
    `[${provider.toUpperCase()}] ${sym} volatilite spike tespit. BB genişliyor, ATR normalin 2.1x. Yüksek riskli ortam — pozisyon boyutu %50 düşürüldü. Var olan pozisyonlar korunuyor, yeni giriş önerilmiyor.`,
  (sym: string, provider: string) =>
    `[${provider.toUpperCase()}] ${sym}: Destek seviyesi $test. Fibonacci %61.8 geri çekilme tamamlandı. Önceki destek direnç dönüşümü. Agresif giriş için uygun — SL: %2, TP1: %4, TP2: %8.`,
];

export const api = {
  async login(email: string, _pw: string) {
    await delay();
    if (email.includes("admin")) return { token: "mock-token-admin", role: "admin" };
    if (email.includes("trader")) return { token: "mock-token-trader", role: "trader" };
    throw new Error("Geçersiz kimlik bilgileri");
  },

  async getExchanges() { await delay(); return [...exchangeStore]; },
  async createExchange(data: Omit<Exchange, "id" | "ws_connected" | "latency_ms">) {
    await delay();
    const ex: Exchange = { ...data, id: uid(), is_active: true, ws_connected: false, latency_ms: 0 };
    exchangeStore = [ex, ...exchangeStore];
    return ex;
  },
  async updateExchange(id: string, data: Partial<Exchange>) {
    await delay();
    exchangeStore = exchangeStore.map((e) => (e.id === id ? { ...e, ...data } : e));
    return exchangeStore.find((e) => e.id === id)!;
  },
  async deleteExchange(id: string) { await delay(); exchangeStore = exchangeStore.filter((e) => e.id !== id); },
  async testExchangeConnection(id: string) {
    await delay(800);
    const latency = Math.floor(Math.random() * 40) + 8;
    exchangeStore = exchangeStore.map((e) =>
      e.id === id ? { ...e, ws_connected: true, latency_ms: latency } : e
    );
    return { ok: true, latency_ms: latency };
  },

  async getStrategies() { await delay(); return [...strategyStore]; },
  async createStrategy(data: Omit<Strategy, "id">) {
    await delay();
    const s: Strategy = { ...data, id: uid() };
    strategyStore = [...strategyStore, s];
    return s;
  },
  async updateStrategy(id: string, data: Partial<Strategy>) {
    await delay();
    strategyStore = strategyStore.map((s) => (s.id === id ? { ...s, ...data } : s));
    auditStore = [
      { id: uid(), action: "STRATEGY_UPDATE", target: strategyStore.find((s) => s.id === id)?.name ?? id, actor: "admin@nexus.local", ts: Date.now() },
      ...auditStore,
    ];
    return strategyStore.find((s) => s.id === id)!;
  },
  async deleteStrategy(id: string) { await delay(); strategyStore = strategyStore.filter((s) => s.id !== id); },

  async getUsers() { await delay(); return [...userStore]; },
  async getAudit() { await delay(); return [...auditStore]; },

  async getAgents() { await delay(); return [...agentStore]; },
  async updateAgent(id: string, data: Partial<Agent>) {
    await delay();
    agentStore = agentStore.map((a) => (a.id === id ? { ...a, ...data } : a));
    return agentStore.find((a) => a.id === id)!;
  },
  async invokeAgent(id: string, message: string) {
    await delay(1400 + Math.random() * 600);
    const agent = agentStore.find((a) => a.id === id);
    const sym = message.match(/\b(BTC|ETH|SOL|BNB|XRP)\b/i)?.[1]?.toUpperCase() ?? "BTC";
    const tmpl = ANALYSIS_TEMPLATES[Math.floor(Math.random() * ANALYSIS_TEMPLATES.length)];
    const providerName = agent?.provider === "anthropic" ? "Claude" : agent?.provider === "google" ? "Gemini" : "GPT";
    return { reply: tmpl(sym + "USDT", providerName) };
  },

  async getPnLSnapshots() { await delay(); return [...pnlSnapshots]; },
  async purgePnL(before: number) {
    await delay();
    pnlSnapshots = pnlSnapshots.filter((p) => p.ts >= before);
  },

  async placeOrder(cmd: Partial<OrderRecord>) {
    await delay(300);
    const order: OrderRecord = {
      id: `o${uid()}`, ex: cmd.ex!, sym: cmd.sym!, side: cmd.side!,
      type: cmd.type!, qty: cmd.qty!, px: cmd.px ?? 0, status: "filled", ts: Date.now(),
    };
    orderStore = [order, ...orderStore];
    auditStore = [
      { id: uid(), action: "ORDER_PLACE", target: `${cmd.ex}:${cmd.sym} ${cmd.side?.toUpperCase()} ${cmd.qty}`, actor: "admin@nexus.local", ts: Date.now() },
      ...auditStore,
    ];
    return order;
  },
  async getOrders() { await delay(); return [...orderStore]; },

  async invokeOrchestrator(sym: string, provider: "anthropic" | "google"): Promise<OrchInvokeResult> {
    const start = Date.now();
    await delay(400);
    const confidence = 0.55 + Math.random() * 0.4;
    const side = Math.random() > 0.45 ? "buy" : "sell";
    const providerName = provider === "anthropic" ? "Claude 3.5 Sonnet" : "Gemini 1.5 Pro";
    return {
      decision: {
        sym,
        side,
        confidence,
        reasoning: `${providerName}: ${sym} teknik ve sentiment analizi — RSI: ${(55 + Math.random() * 25).toFixed(1)}, momentum ${side === "buy" ? "pozitif" : "negatif"}. Risk hesabı Rust katmanında doğrulandı. Güven: %${(confidence * 100).toFixed(1)}.`,
        risk_ok: confidence > 0.65,
      },
      latency_ms: Date.now() - start + Math.floor(Math.random() * 800 + 1200),
      nodes: [
        { id: "market_data", latency_ms: 42 },
        { id: "llm_analysis", latency_ms: 890 + Math.floor(Math.random() * 400) },
        { id: "rust_risk", latency_ms: 8 + Math.floor(Math.random() * 12) },
        { id: "telegram_approval", latency_ms: 0 },
        { id: "ccxt_execute", latency_ms: 95 + Math.floor(Math.random() * 60) },
      ],
    };
  },

  async sendTelegramApproval(chatId: string, decision: { sym: string; side: string; confidence: number }) {
    await delay(600);
    auditStore = [
      { id: uid(), action: "TELEGRAM_SENT", target: `${decision.sym} ${decision.side.toUpperCase()} (${(decision.confidence * 100).toFixed(0)}%)`, actor: "system", ts: Date.now() },
      ...auditStore,
    ];
    return { ok: true, message_id: Math.floor(Math.random() * 99999) };
  },
};
