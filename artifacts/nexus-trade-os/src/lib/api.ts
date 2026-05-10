// Mock API layer — replace with real fetch calls to /api/*

export type Exchange = {
  id: string; exchange: string; label: string; mode: string; is_active: boolean;
};
export type Strategy = {
  id: string; name: string; kind: string; enabled: boolean;
  allocation: number; params: Record<string, unknown>;
};
export type User = { id: string; email: string; role: string; totp_enabled: boolean };
export type AuditEntry = { id: string; action: string; target: string; actor: string; ts: number };
export type Agent = { id: string; name: string; provider: string; model: string };
export type PnLSnapshot = { ts: number; equity: number; realized: number; unrealized: number };
export type OrderRecord = {
  id: string; ex: string; sym: string; side: string;
  type: string; qty: number; px: number; status: string; ts: number;
};

let exchangeStore: Exchange[] = [
  { id: "1", exchange: "binance", label: "main", mode: "live", is_active: true },
  { id: "2", exchange: "bybit", label: "hedge", mode: "testnet", is_active: true },
];

let strategyStore: Strategy[] = [
  { id: "1", name: "BTC Scalper", kind: "scalping", enabled: true, allocation: 20, params: { timeframe: "1m" } },
  { id: "2", name: "ETH Momentum", kind: "momentum", enabled: false, allocation: 15, params: { lookback: 20 } },
  { id: "3", name: "SOL Mean Rev", kind: "meanreversion", enabled: true, allocation: 10, params: { zScore: 2 } },
];

let userStore: User[] = [
  { id: "1", email: "admin@nexus.local", role: "admin", totp_enabled: true },
  { id: "2", email: "trader@nexus.local", role: "trader", totp_enabled: false },
];

let auditStore: AuditEntry[] = [
  { id: "1", action: "LOGIN", target: "admin@nexus.local", actor: "admin@nexus.local", ts: Date.now() - 60000 },
  { id: "2", action: "STRATEGY_TOGGLE", target: "BTC Scalper", actor: "admin@nexus.local", ts: Date.now() - 120000 },
  { id: "3", action: "EXCHANGE_ADD", target: "bybit/hedge", actor: "admin@nexus.local", ts: Date.now() - 300000 },
  { id: "4", action: "ORDER_PLACE", target: "binance:BTCUSDT BUY 0.01", actor: "admin@nexus.local", ts: Date.now() - 600000 },
];

let agentStore: Agent[] = [
  { id: "1", name: "MarketAnalyst", provider: "openai", model: "gpt-4o" },
  { id: "2", name: "RiskGuard", provider: "anthropic", model: "claude-3-5-sonnet" },
];

let orderStore: OrderRecord[] = [
  { id: "o1", ex: "binance", sym: "BTCUSDT", side: "buy", type: "limit", qty: 0.01, px: 66000, status: "filled", ts: Date.now() - 900000 },
  { id: "o2", ex: "bybit", sym: "ETHUSDT", side: "sell", type: "market", qty: 0.2, px: 3510, status: "filled", ts: Date.now() - 1800000 },
];

let pnlSnapshots: PnLSnapshot[] = Array.from({ length: 30 }, (_, i) => ({
  ts: Date.now() - (29 - i) * 86400000,
  equity: 11000 + i * 50 + Math.sin(i) * 200,
  realized: 100 + i * 8,
  unrealized: -50 + i * 6 + Math.cos(i) * 80,
}));

function delay(ms = 120) { return new Promise((r) => setTimeout(r, ms)); }

export const api = {
  async login(email: string, _pw: string) {
    await delay();
    if (email.includes("admin")) return { token: "mock-token-admin", role: "admin" };
    if (email.includes("trader")) return { token: "mock-token-trader", role: "trader" };
    throw new Error("Invalid credentials");
  },

  async getExchanges() { await delay(); return [...exchangeStore]; },
  async createExchange(data: Omit<Exchange, "id">) {
    await delay();
    const ex: Exchange = { ...data, id: String(Date.now()), is_active: true };
    exchangeStore = [ex, ...exchangeStore];
    return ex;
  },
  async deleteExchange(id: string) { await delay(); exchangeStore = exchangeStore.filter((e) => e.id !== id); },

  async getStrategies() { await delay(); return [...strategyStore]; },
  async createStrategy(data: Omit<Strategy, "id">) {
    await delay();
    const s: Strategy = { ...data, id: String(Date.now()) };
    strategyStore = [...strategyStore, s];
    return s;
  },
  async updateStrategy(id: string, data: Partial<Strategy>) {
    await delay();
    strategyStore = strategyStore.map((s) => (s.id === id ? { ...s, ...data } : s));
    return strategyStore.find((s) => s.id === id)!;
  },

  async getUsers() { await delay(); return [...userStore]; },
  async getAudit() { await delay(); return [...auditStore]; },
  async getAgents() { await delay(); return [...agentStore]; },
  async invokeAgent(id: string, message: string) {
    await delay(1200);
    const agent = agentStore.find((a) => a.id === id);
    return {
      reply: `[${agent?.name}]: Analiz tamamlandı. "${message}" sorgunuza göre mevcut piyasa koşulları değerlendirildi. BTC momentum güçlü, risk/ödül oranı 1:2.4.`,
    };
  },

  async getPnLSnapshots() { await delay(); return [...pnlSnapshots]; },
  async purgePnL(before: number) {
    await delay();
    pnlSnapshots = pnlSnapshots.filter((p) => p.ts >= before);
  },

  async placeOrder(cmd: Partial<OrderRecord>) {
    await delay(300);
    const order: OrderRecord = {
      id: `o${Date.now()}`, ex: cmd.ex!, sym: cmd.sym!, side: cmd.side!,
      type: cmd.type!, qty: cmd.qty!, px: cmd.px ?? 0, status: "filled", ts: Date.now(),
    };
    orderStore = [order, ...orderStore];
    auditStore = [
      { id: String(Date.now()), action: "ORDER_PLACE", target: `${cmd.ex}:${cmd.sym} ${cmd.side?.toUpperCase()} ${cmd.qty}`, actor: "admin@nexus.local", ts: Date.now() },
      ...auditStore,
    ];
    return order;
  },
  async getOrders() { await delay(); return [...orderStore]; },
};
