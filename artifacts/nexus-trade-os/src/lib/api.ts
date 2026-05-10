export type Exchange = {
  id: string; exchange: string; label: string; mode: string;
  is_active: boolean; ws_connected?: boolean; latency_ms?: number;
  api_key?: string; api_secret?: string; passphrase?: string;
};
export type Strategy = {
  id: string; name: string; kind: string; enabled: boolean;
  allocation: number; provider: string; model: string; exchange_id: string;
  code?: string;
  params: {
    timeframe?: string; stop_loss_pct?: number; take_profit_pct?: number;
    risk_per_trade_pct?: number; max_positions?: number;
    lookback?: number; z_score?: number; grid_levels?: number;
    [key: string]: unknown;
  };
};
export type User = { id: string; email: string; role: string; totp_enabled: boolean };
export type AuditEntry = { id: string; action: string; target: string; actor: string; ts: number };
export type Agent = {
  id: string; name: string;
  provider: "anthropic" | "google" | "openai" | "nautilus";
  model: string; role: string; active: boolean;
  exchange_ids: string[];
  agent_type: "llm" | "nautilus" | "rule";
};
export type PnLSnapshot = { ts: number; equity: number; realized: number; unrealized: number };
export type OrderRecord = {
  id: string; ex: string; sym: string; side: string;
  type: string; qty: number; px: number; status: string; ts: number;
};
export type OrchInvokeResult = {
  decision: { sym: string; side: "buy" | "sell"; confidence: number; reasoning: string; risk_ok: boolean };
  latency_ms: number;
  nodes: { id: string; latency_ms: number }[];
};

function uid() { return Math.random().toString(36).slice(2, 9); }
function delay(ms = 120) { return new Promise((r) => setTimeout(r, ms)); }

// ── Exchange Store ─────────────────────────────────────────────────────────
let exchangeStore: Exchange[] = [
  { id: "1", exchange: "binance", label: "main",  mode: "live",    is_active: true,  ws_connected: true,  latency_ms: 12 },
  { id: "2", exchange: "bybit",   label: "hedge",  mode: "testnet", is_active: true,  ws_connected: true,  latency_ms: 18 },
  { id: "3", exchange: "okx",     label: "main",   mode: "live",    is_active: true,  ws_connected: true,  latency_ms: 9  },
  { id: "4", exchange: "okx",     label: "paper",  mode: "paper",   is_active: true,  ws_connected: true,  latency_ms: 4  },
];

// ── Strategy Store ─────────────────────────────────────────────────────────
const DEFAULT_STRATEGY_CODE = `# Nexus Strateji Kodu — Python (FastAPI ortamında çalışır)
# CCXT Pro + Polars + LangGraph entegrasyonu

from nexus_sdk import Strategy, Signal, AgentIntent

class CustomStrategy(Strategy):
    name = "custom"
    
    async def on_tick(self, tick) -> Signal | None:
        rsi = await self.compute_rsi(tick.sym, period=14)
        if rsi < 30:
            return Signal(
                sym=tick.sym,
                side="buy",
                strength=0.85,
                reason=f"RSI aşırı satım: {rsi:.1f}"
            )
        if rsi > 70:
            return Signal(
                sym=tick.sym,
                side="sell", 
                strength=0.80,
                reason=f"RSI aşırı alım: {rsi:.1f}"
            )
        return None
    
    async def on_signal(self, signal: Signal) -> AgentIntent | None:
        return AgentIntent(
            sym=signal.sym,
            side=signal.side,
            qty=self.calc_position_size(signal.strength),
            sl_pct=self.params.stop_loss_pct,
            tp_pct=self.params.take_profit_pct,
        )
`;

let strategyStore: Strategy[] = [
  {
    id: "1", name: "BTC Scalper", kind: "scalping", enabled: true,
    allocation: 20, provider: "anthropic", model: "claude-3-5-sonnet-20241022",
    exchange_id: "3", code: DEFAULT_STRATEGY_CODE,
    params: { timeframe: "1m", stop_loss_pct: 1.5, take_profit_pct: 3.0, risk_per_trade_pct: 1.0, max_positions: 3 },
  },
  {
    id: "2", name: "ETH Momentum", kind: "momentum", enabled: false,
    allocation: 15, provider: "google", model: "gemini-1.5-pro",
    exchange_id: "2", code: DEFAULT_STRATEGY_CODE,
    params: { timeframe: "15m", stop_loss_pct: 2.0, take_profit_pct: 5.0, risk_per_trade_pct: 0.8, lookback: 20 },
  },
  {
    id: "3", name: "SOL Mean Rev", kind: "meanreversion", enabled: true,
    allocation: 10, provider: "anthropic", model: "claude-3-5-haiku-20241022",
    exchange_id: "1", code: DEFAULT_STRATEGY_CODE,
    params: { timeframe: "5m", stop_loss_pct: 1.0, take_profit_pct: 2.5, risk_per_trade_pct: 0.5, z_score: 2.0 },
  },
  {
    id: "4", name: "BTC/ETH Grid", kind: "grid", enabled: false,
    allocation: 25, provider: "openai", model: "gpt-4o",
    exchange_id: "2", code: DEFAULT_STRATEGY_CODE,
    params: { timeframe: "1h", stop_loss_pct: 5.0, take_profit_pct: 10.0, risk_per_trade_pct: 2.0, grid_levels: 10 },
  },
];

// ── Agent Store ─────────────────────────────────────────────────────────────
let agentStore: Agent[] = [
  {
    id: "1", name: "MarketAnalyst", provider: "anthropic",
    model: "claude-3-5-sonnet-20241022", agent_type: "llm",
    role: "Piyasa analizi ve sinyal üretimi — BTC/ETH uzmanı",
    active: true, exchange_ids: ["1", "3"],
  },
  {
    id: "2", name: "RiskGuard", provider: "anthropic",
    model: "claude-3-5-haiku-20241022", agent_type: "llm",
    role: "Risk limiti denetimi ve pozisyon boyutlama",
    active: true, exchange_ids: ["1", "2", "3"],
  },
  {
    id: "3", name: "GeminiScanner", provider: "google",
    model: "gemini-1.5-pro", agent_type: "llm",
    role: "Çoklu borsa sentiment taraması",
    active: false, exchange_ids: ["3"],
  },
  {
    id: "4", name: "NautilusAgent", provider: "nautilus",
    model: "nautilus-v1", agent_type: "nautilus",
    role: "API gerektirmez — paper trading & backtesting (AgentIntent protokolü)",
    active: true, exchange_ids: [],
  },
];

let userStore: User[] = [
  { id: "1", email: "admin@nexus.local", role: "admin", totp_enabled: true },
  { id: "2", email: "trader@nexus.local", role: "trader", totp_enabled: false },
];

let auditStore: AuditEntry[] = [
  { id: "1", action: "LOGIN",           target: "admin@nexus.local",            actor: "admin@nexus.local", ts: Date.now() - 60000    },
  { id: "2", action: "STRATEGY_TOGGLE", target: "BTC Scalper",                  actor: "admin@nexus.local", ts: Date.now() - 120000   },
  { id: "3", action: "OKX_CONNECTED",   target: "okx/main live ws",             actor: "system",            ts: Date.now() - 180000   },
  { id: "4", action: "ORDER_PLACE",     target: "okx:BTCUSDT BUY 0.01",        actor: "admin@nexus.local", ts: Date.now() - 600000   },
  { id: "5", action: "RISK_UPDATE",     target: "stopLoss=2%",                  actor: "admin@nexus.local", ts: Date.now() - 900000   },
  { id: "6", action: "NAUTILUS_RUN",    target: "NautilusAgent paper BTCUSDT", actor: "system",            ts: Date.now() - 1200000  },
];

let orderStore: OrderRecord[] = [
  { id: "o1", ex: "okx",     sym: "BTCUSDT", side: "buy",  type: "limit",  qty: 0.01, px: 67100, status: "filled",    ts: Date.now() - 900000  },
  { id: "o2", ex: "binance", sym: "ETHUSDT", side: "sell", type: "market", qty: 0.2,  px: 3510,  status: "filled",    ts: Date.now() - 1800000 },
  { id: "o3", ex: "bybit",   sym: "SOLUSDT", side: "buy",  type: "limit",  qty: 2.5,  px: 175,   status: "cancelled", ts: Date.now() - 3600000 },
];

let pnlSnapshots: PnLSnapshot[] = Array.from({ length: 30 }, (_, i) => ({
  ts: Date.now() - (29 - i) * 86400000,
  equity: 11000 + i * 55 + Math.sin(i) * 200,
  realized: 100 + i * 8.5,
  unrealized: -50 + i * 6 + Math.cos(i) * 80,
}));

const ANALYSIS_TEMPLATES = [
  (sym: string, p: string) => `[${p}] ${sym}: RSI(14)=${(55 + Math.random() * 20).toFixed(1)}, MACD pozitif crossover. Hacim %${(150 + Math.random() * 200).toFixed(0)} artış. Risk/Ödül: 1:${(1.8 + Math.random()).toFixed(1)}. Öneri: BUY, SL:%1.5, TP:%3.`,
  (sym: string, p: string) => `[${p}] ${sym}: Fibonacci %61.8 destek tuttu. Direnç kırılımı bekleniyor. Güven: %${(70 + Math.random() * 20).toFixed(0)}. Hedef: +%${(3 + Math.random() * 5).toFixed(1)}.`,
  (sym: string, p: string) => `[${p}] ${sym}: Volatilite spike — ATR normalin ${(1.8 + Math.random()).toFixed(1)}x üstünde. Pozisyon boyutu %50 düşürüldü. Var olan pozisyonlar korunuyor.`,
  (sym: string, p: string) => `[${p}] ${sym}: Piyasa yapısı kırıldı. Yüksek hacimli sat. SELL sinyali aktif. Hedef destek: $${(Math.random() * 1000).toFixed(0)}.`,
];

const NAUTILUS_REPLIES = [
  (sym: string) => `[NautilusAgent] ${sym} backtesting tamamlandı. 90 günlük simülasyon: Win rate %${(55 + Math.random() * 20).toFixed(1)}, Sharpe ratio: ${(1.2 + Math.random()).toFixed(2)}, Max drawdown: %${(8 + Math.random() * 5).toFixed(1)}. AgentIntent oluşturuldu — paper işlem için hazır.`,
  (sym: string) => `[NautilusAgent] ${sym} paper order yerleştirildi. OrderBook simülasyonu: Fill probability %${(85 + Math.random() * 10).toFixed(0)}, Expected slippage: ${(0.01 + Math.random() * 0.05).toFixed(3)}%. Log: position_tracker.db`,
  (sym: string) => `[NautilusAgent] AgentIntent doğrulandı. Risk engine: OK (conf>0.65). Nautilus DataEngine tick: ${sym} — entry_px hesaplandı, SL/TP otomatik.`,
];

export const api = {
  async login(email: string, _pw: string) {
    await delay();
    if (email.includes("admin")) return { token: "mock-token-admin", role: "admin" };
    if (email.includes("trader")) return { token: "mock-token-trader", role: "trader" };
    throw new Error("Geçersiz kimlik bilgileri");
  },

  // Exchange
  async getExchanges() { await delay(); return [...exchangeStore]; },
  async createExchange(data: Omit<Exchange, "id" | "ws_connected" | "latency_ms">) {
    await delay();
    const ex: Exchange = { ...data, id: uid(), is_active: true, ws_connected: false, latency_ms: 0 };
    exchangeStore = [ex, ...exchangeStore];
    auditStore = [{ id: uid(), action: "EXCHANGE_ADD", target: `${data.exchange}/${data.label}`, actor: "admin@nexus.local", ts: Date.now() }, ...auditStore];
    return ex;
  },
  async updateExchange(id: string, data: Partial<Exchange>) {
    await delay();
    exchangeStore = exchangeStore.map((e) => (e.id === id ? { ...e, ...data } : e));
    auditStore = [{ id: uid(), action: "EXCHANGE_EDIT", target: exchangeStore.find((e) => e.id === id)?.label ?? id, actor: "admin@nexus.local", ts: Date.now() }, ...auditStore];
    return exchangeStore.find((e) => e.id === id)!;
  },
  async deleteExchange(id: string) {
    await delay();
    auditStore = [{ id: uid(), action: "EXCHANGE_DELETE", target: exchangeStore.find((e) => e.id === id)?.label ?? id, actor: "admin@nexus.local", ts: Date.now() }, ...auditStore];
    exchangeStore = exchangeStore.filter((e) => e.id !== id);
  },
  async testExchangeConnection(id: string) {
    await delay(700 + Math.random() * 400);
    const latency = Math.floor(Math.random() * 35) + 5;
    exchangeStore = exchangeStore.map((e) => e.id === id ? { ...e, ws_connected: true, latency_ms: latency } : e);
    return { ok: true, latency_ms: latency };
  },

  // Strategy
  async getStrategies() { await delay(); return [...strategyStore]; },
  async createStrategy(data: Omit<Strategy, "id">) {
    await delay();
    const s: Strategy = { ...data, id: uid(), code: data.code ?? DEFAULT_STRATEGY_CODE };
    strategyStore = [...strategyStore, s];
    return s;
  },
  async updateStrategy(id: string, data: Partial<Strategy>) {
    await delay();
    strategyStore = strategyStore.map((s) => (s.id === id ? { ...s, ...data } : s));
    auditStore = [{ id: uid(), action: "STRATEGY_UPDATE", target: strategyStore.find((s) => s.id === id)?.name ?? id, actor: "admin@nexus.local", ts: Date.now() }, ...auditStore];
    return strategyStore.find((s) => s.id === id)!;
  },
  async deleteStrategy(id: string) {
    await delay();
    strategyStore = strategyStore.filter((s) => s.id !== id);
  },

  // User / Audit
  async getUsers() { await delay(); return [...userStore]; },
  async getAudit() { await delay(); return [...auditStore]; },

  // Agent
  async getAgents() { await delay(); return [...agentStore]; },
  async updateAgent(id: string, data: Partial<Agent>) {
    await delay();
    agentStore = agentStore.map((a) => (a.id === id ? { ...a, ...data } : a));
    return agentStore.find((a) => a.id === id)!;
  },
  async invokeAgent(id: string, message: string) {
    const agent = agentStore.find((a) => a.id === id);
    const isNautilus = agent?.agent_type === "nautilus";
    await delay(isNautilus ? 800 : 1400 + Math.random() * 600);
    const sym = message.match(/\b(BTC|ETH|SOL|BNB|XRP|DOGE|ADA|LINK|MATIC|ARB)\b/i)?.[1]?.toUpperCase() ?? "BTC";
    if (isNautilus) {
      const tmpl = NAUTILUS_REPLIES[Math.floor(Math.random() * NAUTILUS_REPLIES.length)];
      return { reply: tmpl(sym + "USDT") };
    }
    const providerName = agent?.provider === "anthropic" ? "Claude" : agent?.provider === "google" ? "Gemini" : "GPT";
    const tmpl = ANALYSIS_TEMPLATES[Math.floor(Math.random() * ANALYSIS_TEMPLATES.length)];
    return { reply: tmpl(sym + "USDT", providerName) };
  },

  // PnL
  async getPnLSnapshots() { await delay(); return [...pnlSnapshots]; },
  async purgePnL(before: number) { await delay(); pnlSnapshots = pnlSnapshots.filter((p) => p.ts >= before); },

  // Orders
  async placeOrder(cmd: Partial<OrderRecord>) {
    await delay(280);
    const order: OrderRecord = {
      id: `o${uid()}`, ex: cmd.ex!, sym: cmd.sym!, side: cmd.side!,
      type: cmd.type!, qty: cmd.qty!, px: cmd.px ?? 0, status: "filled", ts: Date.now(),
    };
    orderStore = [order, ...orderStore];
    auditStore = [{ id: uid(), action: "ORDER_PLACE", target: `${cmd.ex}:${cmd.sym} ${cmd.side?.toUpperCase()} ${cmd.qty}`, actor: "admin@nexus.local", ts: Date.now() }, ...auditStore];
    return order;
  },
  async getOrders() { await delay(); return [...orderStore]; },

  // Orchestrator
  async invokeOrchestrator(sym: string, provider: "anthropic" | "google") {
    const start = Date.now();
    await delay(350);
    const confidence = 0.55 + Math.random() * 0.42;
    const side = Math.random() > 0.45 ? "buy" : "sell";
    const providerName = provider === "anthropic" ? "Claude 3.5 Sonnet" : "Gemini 1.5 Pro";
    return {
      decision: {
        sym, side: side as "buy" | "sell", confidence,
        reasoning: `${providerName}: RSI=${( 50 + Math.random() * 30).toFixed(1)}, momentum ${side === "buy" ? "pozitif" : "negatif"}. Güven: %${(confidence * 100).toFixed(1)}.`,
        risk_ok: confidence > 0.65,
      },
      latency_ms: Date.now() - start + Math.floor(Math.random() * 800 + 1100),
      nodes: [
        { id: "market_data",       latency_ms: 38 + Math.floor(Math.random() * 20) },
        { id: "llm_analysis",      latency_ms: 820 + Math.floor(Math.random() * 500) },
        { id: "rust_risk",         latency_ms: 7  + Math.floor(Math.random() * 10)  },
        { id: "telegram_approval", latency_ms: 0  },
        { id: "ccxt_execute",      latency_ms: 88 + Math.floor(Math.random() * 60)  },
      ],
    };
  },

  // Exchange Balances (mock — gerçek VPS'te CCXT Pro ile dolar)
  async getExchangeBalances() {
    await delay(600);
    const now = Date.now();
    return [
      {
        exchangeId: "1", exchange: "binance", label: "main", mode: "live",
        totalUsd: 5240.18, fetchedAt: now,
        assets: [
          { asset: "USDT",  free: 3180.44, locked: 120.00, usdValue: 3300.44 },
          { asset: "BTC",   free: 0.03,    locked: 0.02,   usdValue: 3368.04 * 0.05 },
          { asset: "ETH",   free: 0.50,    locked: 0.00,   usdValue: 1760.00 },
          { asset: "SOL",   free: 2.00,    locked: 0.00,   usdValue: 355.80  },
          { asset: "BNB",   free: 0.80,    locked: 0.00,   usdValue: 484.00  },
        ],
      },
      {
        exchangeId: "2", exchange: "bybit", label: "hedge", mode: "testnet",
        totalUsd: 3180.55, fetchedAt: now,
        assets: [
          { asset: "USDT",  free: 2500.00, locked: 200.00, usdValue: 2700.00 },
          { asset: "SOL",   free: 2.50,    locked: 0.00,   usdValue: 444.75  },
          { asset: "XRP",   free: 58.00,   locked: 0.00,   usdValue: 36.25   },
        ],
      },
      {
        exchangeId: "3", exchange: "okx", label: "main", mode: "live",
        totalUsd: 4029.63, fetchedAt: now,
        assets: [
          { asset: "USDT",  free: 2900.00, locked: 500.00, usdValue: 3400.00 },
          { asset: "BTC",   free: 0.00,    locked: 0.01,   usdValue: 674.22  },
          { asset: "ETH",   free: 0.05,    locked: 0.00,   usdValue: 176.05  },
          { asset: "SOL",   free: 1.60,    locked: 0.00,   usdValue: 284.64  },
        ],
      },
      {
        exchangeId: "4", exchange: "okx", label: "paper", mode: "paper",
        totalUsd: 10000.00, fetchedAt: now,
        assets: [
          { asset: "USDT",  free: 10000.00, locked: 0.00, usdValue: 10000.00 },
        ],
      },
    ];
  },

  async refreshExchangeBalance(exchangeId: string) {
    await delay(800 + Math.random() * 400);
    const bases = { "1": 5240, "2": 3180, "3": 4029, "4": 10000 } as Record<string, number>;
    const base  = bases[exchangeId] ?? 1000;
    const drift = (Math.random() - 0.48) * 50;
    return { exchangeId, totalUsd: base + drift, fetchedAt: Date.now() };
  },

  async sendTelegramApproval(chatId: string, decision: { sym: string; side: string; confidence: number }) {
    await delay(500);
    auditStore = [{ id: uid(), action: "TELEGRAM_SENT", target: `${decision.sym} ${decision.side.toUpperCase()} (${(decision.confidence * 100).toFixed(0)}%)`, actor: "system", ts: Date.now() }, ...auditStore];
    return { ok: true, message_id: Math.floor(Math.random() * 99999) };
  },
};
