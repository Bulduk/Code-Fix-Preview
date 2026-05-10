import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { ExchangeBalance } from "@/lib/store";
import {
  TrendingUp, TrendingDown, Activity, Zap,
  ArrowUpRight, ArrowDownRight, Clock,
} from "lucide-react";
import { useMemo } from "react";

const WATCHLIST = [
  { key: "okx:BTCUSDT",    label: "BTC/USDT"  },
  { key: "okx:ETHUSDT",    label: "ETH/USDT"  },
  { key: "okx:SOLUSDT",    label: "SOL/USDT"  },
  { key: "binance:BNBUSDT", label: "BNB/USDT" },
  { key: "binance:XRPUSDT", label: "XRP/USDT" },
  { key: "binance:ARBUSDT", label: "ARB/USDT" },
  { key: "okx:MATICUSDT",  label: "MATIC/USDT"},
  { key: "binance:LINKUSDT",label: "LINK/USDT"},
];

const EX_COLORS: Record<string, string> = {
  okx: "bg-blue-600", binance: "bg-amber-500", bybit: "bg-purple-600",
};

export default function Home() {
  const { pnl, signals, ticks, positions, orders,
          exchangeBalances, setExchangeBalances, token } = useStore();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!token || exchangeBalances.length > 0) return;
    api.getExchangeBalances().then((b) => setExchangeBalances(b as ExchangeBalance[]));
  }, [token]);

  const topSignals    = useMemo(() => signals.filter((s) => s.strength >= 0.78).slice(0, 4), [signals]);
  const recentSignals = useMemo(() => signals.slice(0, 10), [signals]);
  const activePositions = Object.entries(positions);
  const recentOrders    = orders.slice(0, 3);

  const totalBalance = exchangeBalances.reduce((a, b) => a + b.totalUsd, 0);
  const equity       = pnl?.equity ?? 0;
  const realized     = pnl?.realized ?? 0;
  const unrealized   = pnl?.unrealized ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Dashboard</h1>
          <p className="text-xs text-text-dim">Nexus Trade OS · Canlı</p>
        </div>
        <span className="flex items-center gap-1 text-xs text-up">
          <span className="w-2 h-2 rounded-full bg-up animate-pulse" /> Canlı Feed
        </span>
      </div>

      {/* ── Equity + Bakiye Kartı ── */}
      <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-text-dim mb-1">Toplam Equity</div>
            <div className="text-3xl font-bold font-mono text-text">${equity.toFixed(2)}</div>
            <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
              <span className={`flex items-center gap-1 ${realized >= 0 ? "text-up" : "text-down"}`}>
                {realized >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {realized >= 0 ? "+" : ""}${realized.toFixed(2)} gerçekleşen
              </span>
              <span className={`flex items-center gap-1 ${unrealized >= 0 ? "text-up" : "text-down"}`}>
                {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)} açık
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-text-dim mb-0.5">Toplam Borsa Bakiyesi</div>
            <div className="text-xl font-bold font-mono text-text">${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <button onClick={() => navigate("/pnl")} className="text-xs text-accent hover:underline mt-0.5 inline-block">Detaylı P&L →</button>
          </div>
        </div>

        {/* Equity progress */}
        <div className="mt-3 h-1.5 bg-bg-soft rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent to-up rounded-full transition-all"
            style={{ width: `${Math.min(100, (equity / Math.max(totalBalance, 1)) * 100)}%` }} />
        </div>

        {/* Per-exchange balances */}
        {exchangeBalances.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {exchangeBalances.map((b) => (
              <div key={b.exchangeId}
                className="shrink-0 flex items-center gap-2 bg-bg-soft rounded-xl px-3 py-1.5 border border-line cursor-pointer hover:bg-line transition"
                onClick={() => navigate("/pnl")}>
                <div className={`w-5 h-5 rounded-md grid place-items-center text-[9px] font-bold text-white uppercase ${EX_COLORS[b.exchange] ?? "bg-text-dim"}`}>
                  {b.exchange.slice(0, 2)}
                </div>
                <div>
                  <div className="text-[10px] text-text-dim capitalize">{b.exchange}/{b.label}</div>
                  <div className="text-xs font-mono font-semibold text-text">${b.totalUsd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Güçlü Sinyaller ── */}
      {topSignals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={13} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">Güçlü Sinyaller</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-700 font-medium">{topSignals.length} aktif</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {topSignals.map((s) => (
              <div key={s.id} onClick={() => navigate(`/trade?ex=${s.ex}&sym=${s.sym}`)}
                className="flex items-center justify-between bg-white rounded-xl px-3 py-2 cursor-pointer hover:shadow-sm transition border border-amber-100">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {s.side.toUpperCase()}
                  </span>
                  <span className="font-mono text-sm font-semibold text-text">{s.sym}</span>
                  <span className="text-xs text-text-dim">{s.ex}</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.reason && <span className="text-xs text-text-dim hidden sm:inline truncate max-w-32">{s.reason}</span>}
                  <span className="text-xs font-bold text-amber-700">%{(s.strength * 100).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Watchlist ── */}
      <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
        <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
          <span className="text-sm font-semibold text-text">Watchlist</span>
          <button onClick={() => navigate("/markets")} className="text-xs text-accent hover:underline">Tümü →</button>
        </div>
        <div className="divide-y divide-line">
          {WATCHLIST.map(({ key, label }) => {
            const tick = ticks[key];
            if (!tick) return null;
            const up  = (tick.change ?? 0) >= 0;
            const sig = signals.find((s) => key === `${s.ex}:${s.sym}`);
            return (
              <div key={key} onClick={() => navigate(`/trade?ex=${key.split(":")[0]}&sym=${key.split(":")[1]}`)}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-soft cursor-pointer transition">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-bg-soft border border-line grid place-items-center text-[10px] font-bold text-text-dim">
                    {label.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text">{label}</div>
                    <div className="text-[10px] text-text-dim">{key.split(":")[0]}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sig && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sig.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {sig.side.toUpperCase()}
                    </span>
                  )}
                  {tick.rsi !== undefined && (
                    <span className={`text-[10px] font-mono ${tick.rsi > 65 ? "text-down" : tick.rsi < 35 ? "text-up" : "text-text-dim"}`}>
                      RSI {tick.rsi.toFixed(0)}
                    </span>
                  )}
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-text">
                      {tick.px < 1 ? tick.px.toFixed(4) : tick.px.toFixed(2)}
                    </div>
                    <div className={`text-[10px] flex items-center gap-0.5 justify-end ${up ? "text-up" : "text-down"}`}>
                      {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {up ? "+" : ""}{((tick.change ?? 0) * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Aktif Pozisyonlar */}
        <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <span className="text-sm font-semibold text-text">Aktif Pozisyonlar</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-bg-soft text-text-dim border border-line">{activePositions.length}</span>
          </div>
          <div className="divide-y divide-line">
            {activePositions.length === 0 && <div className="px-4 py-6 text-center text-text-dim text-xs">Açık pozisyon yok</div>}
            {activePositions.map(([key, pos]) => (
              <div key={key} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-text">{pos.sym}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pos.side === "long" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {pos.side.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">{pos.qty} × ${pos.entry.toFixed(2)} · {pos.ex}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-mono font-semibold ${pos.pnl >= 0 ? "text-up" : "text-down"}`}>
                    {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                  </div>
                  <div className="text-xs text-text-dim">Mark: ${pos.mark.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sinyal Akışı */}
        <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
          <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
            <Activity size={13} className="text-accent" />
            <span className="text-sm font-semibold text-text">Sinyal Akışı</span>
            <span className="ml-auto text-[10px] text-text-dim">{signals.length} toplam</span>
          </div>
          <div className="divide-y divide-line max-h-64 overflow-auto">
            {recentSignals.length === 0 && <div className="px-4 py-6 text-center text-text-dim text-xs">Sinyal bekleniyor...</div>}
            {recentSignals.map((s) => (
              <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text">{s.sym}</span>
                    <span className="text-[10px] text-text-dim">{s.ex}</span>
                    {s.strength >= 0.80 && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">HOT</span>}
                  </div>
                  {s.reason && <div className="text-[10px] text-text-dim mt-0.5 truncate max-w-40">{s.reason}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-1.5 bg-bg-soft rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.strength >= 0.80 ? "bg-amber-400" : s.side === "buy" ? "bg-up" : "bg-down"}`}
                      style={{ width: `${s.strength * 100}%` }} />
                  </div>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${s.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {s.side.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Son Emirler */}
      {recentOrders.length > 0 && (
        <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-text-dim" />
              <span className="text-sm font-semibold text-text">Son Emirler</span>
            </div>
            <button onClick={() => navigate("/trade")} className="text-xs text-accent hover:underline">Tümü →</button>
          </div>
          <div className="divide-y divide-line">
            {recentOrders.map((o) => (
              <div key={o.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${o.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {o.side.toUpperCase()}
                  </span>
                  <span className="font-mono font-medium text-text">{o.sym}</span>
                  <span className="text-xs text-text-dim">{o.ex} · {o.qty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text">${o.px.toFixed(2)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.status === "filled" ? "bg-green-100 text-green-700" : "bg-bg-soft text-text-dim"}`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
