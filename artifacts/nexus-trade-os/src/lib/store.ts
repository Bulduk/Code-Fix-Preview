import { create } from "zustand";

export type Tick = {
  px: number; ts: number; change?: number;
  vol24h?: number; high24h?: number; low24h?: number; rsi?: number;
};
export type Signal = {
  id: string; strategy: string; ex: string; sym: string;
  side: "buy" | "sell"; strength: number; ts: number;
  reason?: string;
};
export type Position = {
  ex: string; sym: string; side: string; qty: number;
  entry: number; mark: number; pnl: number;
};
export type PnL = { equity: number; realized: number; unrealized: number };
export type Order = {
  id: string; ex: string; sym: string; side: string;
  type: string; qty: number; px: number; status: string; ts: number;
};
export type LangGraphNode = {
  id: string; label: string;
  status: "idle" | "running" | "done" | "error" | "waiting";
  latencyMs?: number;
};
export type OrchDecision = {
  id: string; sym: string; side: "buy" | "sell";
  confidence: number; reasoning: string; approved: boolean | null; ts: number;
};
export type TelegramApproval = {
  id: string; decision: OrchDecision; sentAt: number;
  respondedAt?: number; answer?: "approve" | "reject";
};
export type RiskConfig = {
  maxPositionPct: number; stopLossPct: number; takeProfitPct: number;
  maxDailyLossPct: number; maxOpenPositions: number; riskPerTradePct: number;
};
export type AssetBalance = { asset: string; free: number; locked: number; usdValue: number };
export type ExchangeBalance = {
  exchangeId: string; exchange: string; label: string; mode: string;
  totalUsd: number; assets: AssetBalance[];
  fetchedAt: number; error?: string;
};
export type TradeMode = "manual" | "semi_auto" | "full_auto";

export type SystemConfig = {
  targetLatencyMs: number;
  signalStrengthThreshold: number;
  paperTrading: boolean;
  defaultExchange: string;
  defaultProvider: string;
  okxWsEnabled: boolean;
  notificationsEnabled: boolean;
  autoApproveBelow: number;
  maxConcurrentOrders: number;
  logRetentionDays: number;
  firstRunDone: boolean;
  tradeMode: TradeMode;
};
export type Notification = {
  id: string; type: "signal" | "order" | "risk" | "info";
  title: string; body: string; ts: number; dismissed: boolean;
};

const SYSTEM_CONFIG_KEY = "nexus_system_config";

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  targetLatencyMs: 2800,
  signalStrengthThreshold: 0.80,
  paperTrading: true,
  defaultExchange: "okx",
  defaultProvider: "anthropic",
  okxWsEnabled: true,
  notificationsEnabled: true,
  autoApproveBelow: 0.65,
  maxConcurrentOrders: 5,
  logRetentionDays: 90,
  firstRunDone: false,
  tradeMode: "semi_auto",
};

function loadSystemConfig(): SystemConfig {
  try {
    const raw = localStorage.getItem(SYSTEM_CONFIG_KEY);
    if (raw) return { ...DEFAULT_SYSTEM_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SYSTEM_CONFIG };
}

function saveSystemConfig(cfg: SystemConfig) {
  try { localStorage.setItem(SYSTEM_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
}

const DEFAULT_RISK: RiskConfig = {
  maxPositionPct: 5, stopLossPct: 2, takeProfitPct: 4,
  maxDailyLossPct: 8, maxOpenPositions: 5, riskPerTradePct: 1,
};

const DEFAULT_NODES: LangGraphNode[] = [
  { id: "market_data",       label: "Piyasa Verisi",         status: "idle" },
  { id: "llm_analysis",      label: "AI Analiz (Claude)",    status: "idle" },
  { id: "rust_risk",         label: "Risk Kontrolü",         status: "idle" },
  { id: "telegram_approval", label: "Onay Bekliyor",         status: "idle" },
  { id: "ccxt_execute",      label: "Emir Gönder (Binance)", status: "idle" },
];

type Store = {
  token: string | null; role: string | null;
  setAuth: (t: string, r: string) => void;
  logout: () => void;

  ticks: Record<string, Tick>;
  positions: Record<string, Position>;
  pnl: PnL | null;
  signals: Signal[];
  orders: Order[];
  applyEvent: (ev: Record<string, unknown>) => void;

  strongSignal: Signal | null;
  dismissStrongSignal: () => void;
  notifications: Notification[];
  addNotification: (n: Omit<Notification, "id" | "ts" | "dismissed">) => void;
  dismissNotification: (id: string) => void;

  orchRunning: boolean; orchNodes: LangGraphNode[];
  orchDecisions: OrchDecision[]; orchLatencyMs: number;
  setOrchRunning: (v: boolean) => void;
  setOrchNodes: (nodes: LangGraphNode[]) => void;
  addOrchDecision: (d: OrchDecision) => void;
  setOrchLatency: (ms: number) => void;

  telegramEnabled: boolean; telegramChatId: string;
  pendingApprovals: TelegramApproval[];
  setTelegramEnabled: (v: boolean) => void;
  setTelegramChatId: (id: string) => void;
  addPendingApproval: (a: TelegramApproval) => void;
  resolveApproval: (id: string, answer: "approve" | "reject") => void;

  riskConfig: RiskConfig;
  setRiskConfig: (cfg: Partial<RiskConfig>) => void;

  systemConfig: SystemConfig;
  setSystemConfig: (cfg: Partial<SystemConfig>) => void;
  markFirstRunDone: () => void;

  okxConnected: boolean;
  setOkxConnected: (v: boolean) => void;

  exchangeBalances: ExchangeBalance[];
  setExchangeBalances: (b: ExchangeBalance[]) => void;
  updateExchangeBalance: (b: ExchangeBalance) => void;

  pnlHistory: Array<{ ts: number; equity: number; realized: number; unrealized: number }>;
  pushPnlHistory: (snap: { ts: number; equity: number; realized: number; unrealized: number }) => void;
};

export const useStore = create<Store>((set, get) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("tok") : null,
  role: typeof window !== "undefined" ? localStorage.getItem("role") : null,
  setAuth: (t, r) => {
    localStorage.setItem("tok", t); localStorage.setItem("role", r);
    set({ token: t, role: r });
  },
  logout: () => {
    localStorage.removeItem("tok"); localStorage.removeItem("role");
    set({ token: null, role: null });
  },

  ticks: {}, positions: {}, pnl: null, signals: [], orders: [],

  applyEvent: (ev) =>
    set((s) => {
      if (ev.t === "tick") {
        const key = `${ev.ex}:${ev.sym}`;
        const prev = s.ticks[key];
        const newPx = ev.px as number;
        const change = prev ? (newPx - prev.px) / prev.px : 0;
        const rsi = prev?.rsi !== undefined
          ? Math.min(90, Math.max(10, prev.rsi + (change > 0 ? 1.2 : -1.2) * Math.random()))
          : 45 + Math.random() * 20;
        return {
          ticks: {
            ...s.ticks,
            [key]: {
              px: newPx, ts: ev.ts as number, change,
              vol24h: (ev.vol24h as number) ?? prev?.vol24h ?? Math.random() * 1e9,
              high24h: (ev.high24h as number) ?? prev?.high24h ?? newPx * 1.02,
              low24h: (ev.low24h as number) ?? prev?.low24h ?? newPx * 0.98,
              rsi: Number(rsi.toFixed(1)),
            },
          },
        };
      }
      if (ev.t === "position") {
        const key = `${ev.ex}:${ev.sym}`;
        return { positions: { ...s.positions, [key]: ev as unknown as Position } };
      }
      if (ev.t === "pnl") {
        return { pnl: { equity: ev.equity as number, realized: ev.realized as number, unrealized: ev.unrealized as number } };
      }
      if (ev.t === "signal") {
        const sig = ev as unknown as Signal;
        const threshold = s.systemConfig.signalStrengthThreshold;
        const newSignals = [sig, ...s.signals].slice(0, 200);
        const isStrong = sig.strength >= threshold;
        const newStrong = isStrong ? sig : s.strongSignal;
        let newNotifications = s.notifications;
        if (isStrong && s.systemConfig.notificationsEnabled) {
          const notif: Notification = {
            id: `n${Date.now()}`, type: "signal",
            title: `Güçlü Sinyal: ${sig.sym}`,
            body: `${sig.side.toUpperCase()} — güven %${(sig.strength * 100).toFixed(0)} · ${sig.ex}`,
            ts: Date.now(), dismissed: false,
          };
          newNotifications = [notif, ...s.notifications].slice(0, 20);
        }
        return { signals: newSignals, strongSignal: newStrong, notifications: newNotifications };
      }
      if (ev.t === "order") {
        return { orders: [ev as unknown as Order, ...s.orders].slice(0, 100) };
      }
      return s;
    }),

  strongSignal: null,
  dismissStrongSignal: () => set({ strongSignal: null }),
  notifications: [],
  addNotification: (n) => set((s) => ({
    notifications: [
      { ...n, id: `n${Date.now()}`, ts: Date.now(), dismissed: false },
      ...s.notifications,
    ].slice(0, 20),
  })),
  dismissNotification: (id) => set((s) => ({
    notifications: s.notifications.map((n) => n.id === id ? { ...n, dismissed: true } : n),
  })),

  orchRunning: false, orchNodes: DEFAULT_NODES, orchDecisions: [], orchLatencyMs: 0,
  setOrchRunning: (v) => set({ orchRunning: v }),
  setOrchNodes: (nodes) => set({ orchNodes: nodes }),
  addOrchDecision: (d) => set((s) => ({ orchDecisions: [d, ...s.orchDecisions].slice(0, 50) })),
  setOrchLatency: (ms) => set({ orchLatencyMs: ms }),

  telegramEnabled: false, telegramChatId: "", pendingApprovals: [],
  setTelegramEnabled: (v) => set({ telegramEnabled: v }),
  setTelegramChatId: (id) => set({ telegramChatId: id }),
  addPendingApproval: (a) => set((s) => ({ pendingApprovals: [a, ...s.pendingApprovals].slice(0, 20) })),
  resolveApproval: (id, answer) =>
    set((s) => ({
      pendingApprovals: s.pendingApprovals.map((a) =>
        a.id === id ? { ...a, answer, respondedAt: Date.now() } : a
      ),
    })),

  riskConfig: DEFAULT_RISK,
  setRiskConfig: (cfg) => set((s) => ({ riskConfig: { ...s.riskConfig, ...cfg } })),

  systemConfig: typeof window !== "undefined" ? loadSystemConfig() : DEFAULT_SYSTEM_CONFIG,
  setSystemConfig: (cfg) => {
    set((s) => {
      const next = { ...s.systemConfig, ...cfg };
      saveSystemConfig(next);
      return { systemConfig: next };
    });
  },
  markFirstRunDone: () => {
    set((s) => {
      const next = { ...s.systemConfig, firstRunDone: true };
      saveSystemConfig(next);
      return { systemConfig: next };
    });
  },

  okxConnected: false,
  setOkxConnected: (v) => set({ okxConnected: v }),

  exchangeBalances: [],
  setExchangeBalances: (b) => set({ exchangeBalances: b }),
  updateExchangeBalance: (b) =>
    set((s) => ({
      exchangeBalances: s.exchangeBalances.some((x) => x.exchangeId === b.exchangeId)
        ? s.exchangeBalances.map((x) => x.exchangeId === b.exchangeId ? b : x)
        : [...s.exchangeBalances, b],
    })),

  pnlHistory: [],
  pushPnlHistory: (snap) =>
    set((s) => ({ pnlHistory: [...s.pnlHistory, snap].slice(-1440) })), // max 24h @ 1min
}));
