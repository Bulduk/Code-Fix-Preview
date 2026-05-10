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
};

export type Order = {
  id: string; ex: string; sym: string; side: string;
  type: string; qty: number; px: number; status: string; ts: number;
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
}));
