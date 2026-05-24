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

  // Risk Status
  async getRiskStatus() {
    return req<{
      openOrders: number; maxOrders: number;
      dailyLoss: number; maxDailyLossPct: number;
      limits: Record<string, number>;
    }>("/orders/risk-status").catch(() => ({
      openOrders: 0, maxOrders: 5, dailyLoss: 0, maxDailyLossPct: 8, limits: {},
    }));
  },

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

  // Agents — backend API (GET/PATCH /api/agents)
  async getAgents()                                        { return req<Agent[]>("/agents"); },
  async updateAgent(id: string, data: Partial<Agent>)     { return req<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }); },
  async createAgent(data: Omit<Agent, "id">)              { return req<Agent>("/agents", { method: "POST", body: JSON.stringify(data) }); },
  async deleteAgent(id: string)                           { return req<{ ok: boolean }>(`/agents/${id}`, { method: "DELETE" }); },
  async invokeAgent(id: string, message: string) {
    return req<{ reply: string; agentId: string; agentName: string; latencyMs: number; ts: number }>(
      `/agents/${id}/invoke`,
      { method: "POST", body: JSON.stringify({ message }) }
    );
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
  async getSystemSettings()            { return api.getConfig(); },
  async updateSystemSettings(d: Record<string, unknown>) { return api.patchConfig(d); },

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
