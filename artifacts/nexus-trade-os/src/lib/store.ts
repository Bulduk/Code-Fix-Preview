import { create } from "zustand";

export type Tick = { px: number; ts: number; change?: number };
export type Signal = {
  id: string; strategy: string; ex: string; sym: string;
  side: "buy" | "sell"; strength: number; ts: number;
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
  id: string;
  label: string;
  status: "idle" | "running" | "done" | "error" | "waiting";
  latencyMs?: number;
};

export type OrchDecision = {
  id: string;
  sym: string;
  side: "buy" | "sell";
  confidence: number;
  reasoning: string;
  approved: boolean | null;
  ts: number;
};

export type TelegramApproval = {
  id: string;
  decision: OrchDecision;
  sentAt: number;
  respondedAt?: number;
  answer?: "approve" | "reject";
};

export type RiskConfig = {
  maxPositionPct: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  riskPerTradePct: number;
};

type Store = {
  token: string | null;
  role: string | null;
  setAuth: (t: string, r: string) => void;
  logout: () => void;

  ticks: Record<string, Tick>;
  positions: Record<string, Position>;
  pnl: PnL | null;
  signals: Signal[];
  orders: Order[];
  applyEvent: (ev: Record<string, unknown>) => void;

  orchRunning: boolean;
  orchNodes: LangGraphNode[];
  orchDecisions: OrchDecision[];
  orchLatencyMs: number;
  setOrchRunning: (v: boolean) => void;
  setOrchNodes: (nodes: LangGraphNode[]) => void;
  addOrchDecision: (d: OrchDecision) => void;
  setOrchLatency: (ms: number) => void;

  telegramEnabled: boolean;
  telegramChatId: string;
  pendingApprovals: TelegramApproval[];
  setTelegramEnabled: (v: boolean) => void;
  setTelegramChatId: (id: string) => void;
  addPendingApproval: (a: TelegramApproval) => void;
  resolveApproval: (id: string, answer: "approve" | "reject") => void;

  riskConfig: RiskConfig;
  setRiskConfig: (cfg: Partial<RiskConfig>) => void;
};

const DEFAULT_NODES: LangGraphNode[] = [
  { id: "market_data", label: "Market Data", status: "idle" },
  { id: "llm_analysis", label: "LLM Analysis", status: "idle" },
  { id: "rust_risk", label: "Risk Check (Rust)", status: "idle" },
  { id: "telegram_approval", label: "Telegram Onay", status: "idle" },
  { id: "ccxt_execute", label: "CCXT Execute", status: "idle" },
];

const DEFAULT_RISK: RiskConfig = {
  maxPositionPct: 5,
  stopLossPct: 2,
  takeProfitPct: 4,
  maxDailyLossPct: 8,
  maxOpenPositions: 5,
  riskPerTradePct: 1,
};

export const useStore = create<Store>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("tok") : null,
  role: typeof window !== "undefined" ? localStorage.getItem("role") : null,
  setAuth: (t, r) => {
    localStorage.setItem("tok", t);
    localStorage.setItem("role", r);
    set({ token: t, role: r });
  },
  logout: () => {
    localStorage.removeItem("tok");
    localStorage.removeItem("role");
    set({ token: null, role: null });
  },

  ticks: {},
  positions: {},
  pnl: null,
  signals: [],
  orders: [],

  applyEvent: (ev) =>
    set((s) => {
      if (ev.t === "tick") {
        const key = `${ev.ex}:${ev.sym}`;
        const prev = s.ticks[key];
        const change = prev ? ((ev.px as number) - prev.px) / prev.px : 0;
        return { ticks: { ...s.ticks, [key]: { px: ev.px as number, ts: ev.ts as number, change } } };
      }
      if (ev.t === "position") {
        const key = `${ev.ex}:${ev.sym}`;
        return { positions: { ...s.positions, [key]: ev as unknown as Position } };
      }
      if (ev.t === "pnl") {
        return { pnl: { equity: ev.equity as number, realized: ev.realized as number, unrealized: ev.unrealized as number } };
      }
      if (ev.t === "signal") {
        return { signals: [ev as unknown as Signal, ...s.signals].slice(0, 200) };
      }
      if (ev.t === "order") {
        return { orders: [ev as unknown as Order, ...s.orders].slice(0, 100) };
      }
      return s;
    }),

  orchRunning: false,
  orchNodes: DEFAULT_NODES,
  orchDecisions: [],
  orchLatencyMs: 0,
  setOrchRunning: (v) => set({ orchRunning: v }),
  setOrchNodes: (nodes) => set({ orchNodes: nodes }),
  addOrchDecision: (d) => set((s) => ({ orchDecisions: [d, ...s.orchDecisions].slice(0, 50) })),
  setOrchLatency: (ms) => set({ orchLatencyMs: ms }),

  telegramEnabled: false,
  telegramChatId: "",
  pendingApprovals: [],
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
}));
