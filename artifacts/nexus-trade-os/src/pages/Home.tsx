import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { ExchangeBalance } from "@/lib/store";
import {
  TrendingUp, TrendingDown, Activity, Zap,
  ArrowUpRight, ArrowDownRight, Clock, BarChart3,
  Shield, Bot, RefreshCw, DollarSign,
} from "lucide-react";

// Binance-first watchlist — sadece Binance çiftleri
const WATCHLIST = [
  { key: "binance:BTCUSDT",  label: "BTC/USDT"  },
  { key: "binance:ETHUSDT",  label: "ETH/USDT"  },
  { key: "binance:BNBUSDT",  label: "BNB/USDT"  },
  { key: "binance:SOLUSDT",  label: "SOL/USDT"  },
  { key: "binance:XRPUSDT",  label: "XRP/USDT"  },
  { key: "binance:ADAUSDT",  label: "ADA/USDT"  },
  { key: "binance:ARBUSDT",  label: "ARB/USDT"  },
  { key: "binance:LINKUSDT", label: "LINK/USDT" },
];

// Sabit sparkline — her render'da değişmez
function MiniSparkline({ change, rsi }: { change: number; rsi?: number }) {
  const up = change >= 0;
  // Deterministik nokta üretimi (change değerine göre sabit)
  const seed = Math.abs(change * 1000) % 7;
  const pts = Array.from({ length: 14 }, (_, i) => {
    const noise = Math.sin(i * seed + 1) * 3;
    return 18 - (i / 13) * change * 80 + noise;
  }).reverse();
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const norm = (v: number) => ((v - min) / (max - min || 1)) * 24;
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i / 13) * 80},${24 - norm(v)}`).join(" ");
  return (
    <div className="flex items-center gap-1.5">
      <svg viewBox="0 0 80 26" className="w-14 h-4.5" preserveAspectRatio="none">
        <path d={d} fill="none" stroke={up ? "#22c55e" : "#ef4444"} strokeWidth="1.5" />
      </svg>
      {rsi !== undefined && (
        <span className={`text-[9px] font-mono ${rsi > 70 ? "text-down" : rsi < 30 ? "text-up" : "text-text-dim"}`}>
          {rsi.toFixed(0)}
        </span>
      )}
    </div>
  );
}

// Piyasa özeti kartı
function MarketSummary({ ticks }: { ticks: ReturnType<typeof useStore>["ticks"] }) {
  const btc = ticks["binance:BTCUSDT"];
  const eth = ticks["binance:ETHUSDT"];
  const bnb = ticks["binance:BNBUSDT"];

  const items = [
    { label: "BTC Dom.", value: "52.4%", up: true },
    { label: "Fear & Greed", value: "68 Açgözlü", up: true },
    { label: "BTC", value: btc ? `$${btc.px.toFixed(0)}` : "—", up: (btc?.change ?? 0) >= 0 },
    { label: "ETH", value: eth ? `$${eth.px.toFixed(0)}` : "—", up: (eth?.change ?? 0) >= 0 },
    { label: "BNB", value: bnb ? `$${bnb.px.toFixed(1)}` : "—", up: (bnb?.change ?? 0) >= 0 },
  ];

  return (
    <div className="bg-bg-elev border border-line rounded-2xl p-3 shadow-card">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={12} className="text-accent" />
        <span className="text-xs font-semibold text-text">Piyasa Özeti</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {items.map((item) => (
          <div key={item.label} className="shrink-0 bg-bg-soft rounded-xl px-3 py-1.5 text-center border border-line">
            <div className={`text-xs font-bold font-mono ${item.up ? "text-up" : "text-down"}`}>{item.value}</div>
            <div className="text-[10px] text-text-dim mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { pnl, signals, ticks, positions, orders,
          exchangeBalances, setExchangeBalances, token, pnlHistory } = useStore();
  const [, navigate] = useLocation();
  const [refreshing, setRefreshing] = useState(false);

  const loadBalances = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const b = await api.getExchangeBalances();
      setExchangeBalances(b as ExchangeBalance[]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token || exchangeBalances.length > 0) return;
    loadBalances();
  }, [token]);

  const topSignals    = useMemo(() => signals.filter((s) => s.strength >= 0.78).slice(0, 4), [signals]);
  const recentSignals = useMemo(() => signals.slice(0, 8), [signals]);
  const activePositions = Object.entries(positions);
  const recentOrders    = orders.slice(0, 3);

  // Sadece Binance bakiyesi göster
  const binanceBalance = exchangeBalances.find((b) => b.exchange === "binance");
  const binanceFutures = exchangeBalances.find((b) => b.exchange === "binance" && b.label?.toLowerCase().includes("futures"));
  const totalBalance   = exchangeBalances.reduce((a, b) => a + b.totalUsd, 0);
  const equity         = pnl?.equity ?? 0;
  const realized       = pnl?.realized ?? 0;
  const unrealized     = pnl?.unrealized ?? 0;

  // Bugünkü PnL (son 24h)
  const todayPnl = useMemo(() => {
    const pts = pnlHistory.slice(-10).map((p) => p.equity);
    if (pts.length < 2) return null;
    const first = pts[0]!;
    const last  = pts[pts.length - 1]!;
    return { delta: last - first, pct: first > 0 ? ((last - first) / first) * 100 : 0, up: last >= first };
  }, [pnlHistory]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Dashboard</h1>
          <p className="text-xs text-text-dim">Binance · Canlı Veri</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-up font-medium">
            <span className="w-2 h-2 rounded-full bg-up animate-pulse" /> Canlı
          </span>
          <button
            onClick={loadBalances}
            disabled={refreshing}
            className="p-1.5 rounded-lg border border-line bg-bg-elev text-text-dim hover:bg-bg-soft transition disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Toplam Bakiye Kartı (Binance tarzı) ── */}
      <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-text-dim mb-1">Toplam Bakiye</div>
            <div className="text-3xl font-bold font-mono text-text">
              ${equity.toFixed(2)}
              <span className="text-sm font-normal text-text-dim ml-1">USDT</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {todayPnl && (
                <span className={`flex items-center gap-1 text-sm font-semibold ${todayPnl.up ? "text-up" : "text-down"}`}>
                  {todayPnl.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {todayPnl.up ? "+" : ""}{todayPnl.delta.toFixed(2)} ({todayPnl.up ? "+" : ""}{todayPnl.pct.toFixed(2)}%)
                </span>
              )}
              <span className="text-xs text-text-dim">Bugün</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
              <span className={`flex items-center gap-1 ${realized >= 0 ? "text-up" : "text-down"}`}>
                {realized >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {realized >= 0 ? "+" : ""}${realized.toFixed(2)} gerçekleşen
              </span>
              <span className={`${unrealized >= 0 ? "text-up" : "text-down"}`}>
                {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)} açık
              </span>
            </div>
          </div>
          {/* Hızlı işlem butonları */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/trade")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-up text-white text-sm font-semibold hover:brightness-110 transition"
            >
              <TrendingUp size={14} /> Hızlı Al
            </button>
            <button
              onClick={() => navigate("/trade")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-down text-white text-sm font-semibold hover:brightness-110 transition"
            >
              <TrendingDown size={14} /> Hızlı Sat
            </button>
          </div>
        </div>

        {/* Equity progress bar */}
        <div className="mt-3 h-1.5 bg-bg-soft rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-up rounded-full transition-all"
            style={{ width: `${Math.min(100, (equity / Math.max(totalBalance, 1)) * 100)}%` }}
          />
        </div>

        {/* Binance Spot + Futures bakiye */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-bg-soft rounded-xl px-3 py-2 border border-line">
            <div className="text-[10px] text-text-dim">Binance Spot</div>
            <div className="text-sm font-bold font-mono text-text mt-0.5">
              ${(binanceBalance?.totalUsd ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-bg-soft rounded-xl px-3 py-2 border border-line">
            <div className="text-[10px] text-text-dim">Futures Bakiye</div>
            <div className="text-sm font-bold font-mono text-text mt-0.5">
              ${(binanceFutures?.totalUsd ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Hızlı Erişim ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Piyasalar", icon: BarChart3,  href: "/markets", color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "Portföy",   icon: DollarSign, href: "/pnl",     color: "text-green-600",  bg: "bg-green-50"  },
          { label: "Risk",      icon: Shield,     href: "/risk",    color: "text-amber-600",  bg: "bg-amber-50"  },
          { label: "Ajanlar",   icon: Bot,        href: "/agents",  color: "text-purple-600", bg: "bg-purple-50" },
        ].map((item) => (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={`${item.bg} border border-line rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:shadow-sm transition`}
          >
            <item.icon size={18} className={item.color} />
            <span className="text-xs font-medium text-text">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Piyasa Özeti ── */}
      <MarketSummary ticks={ticks} />

      {/* ── Güçlü Sinyaller ── */}
      {topSignals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={13} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">Güçlü Sinyaller</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-700 font-medium">
              {topSignals.length} aktif
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {topSignals.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/trade?sym=${s.sym}`)}
                className="flex items-center justify-between bg-white rounded-xl px-3 py-2 cursor-pointer hover:shadow-sm transition border border-amber-100"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      s.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {s.side.toUpperCase()}
                  </span>
                  <span className="font-mono text-sm font-semibold text-text">{s.sym}</span>
                  <span className="text-xs text-text-dim">{s.ex}</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.reason && (
                    <span className="text-xs text-text-dim hidden sm:inline truncate max-w-32">{s.reason}</span>
                  )}
                  <span className="text-xs font-bold text-amber-700">%{(s.strength * 100).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Favori Çiftler (Binance) ── */}
      <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
        <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">Favori Çiftler</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-medium">
              Binance
            </span>
          </div>
          <button onClick={() => navigate("/markets")} className="text-xs text-accent hover:underline">
            Tümü →
          </button>
        </div>
        <div className="divide-y divide-line">
          {WATCHLIST.map(({ key, label }) => {
            const tick = ticks[key];
            if (!tick) return null;
            const up  = (tick.change ?? 0) >= 0;
            const sig = signals.find((s) => `${s.ex}:${s.sym}` === key);
            return (
              <div
                key={key}
                onClick={() => navigate(`/trade?sym=${key.split(":")[1]}`)}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-soft cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 grid place-items-center text-[10px] font-bold text-amber-700">
                    {label.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text">{label}</div>
                    <div className="text-[10px] text-text-dim">Binance Spot</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sig && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        sig.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {sig.side.toUpperCase()}
                    </span>
                  )}
                  <MiniSparkline change={tick.change ?? 0} rsi={tick.rsi} />
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-text">
                      {tick.px < 1 ? tick.px.toFixed(4) : tick.px.toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] flex items-center gap-0.5 justify-end ${up ? "text-up" : "text-down"}`}
                    >
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
            <span className="text-xs px-2 py-0.5 rounded-full bg-bg-soft text-text-dim border border-line">
              {activePositions.length}
            </span>
          </div>
          <div className="divide-y divide-line">
            {activePositions.length === 0 && (
              <div className="px-4 py-6 text-center text-text-dim text-xs">Açık pozisyon yok</div>
            )}
            {activePositions.map(([key, pos]) => (
              <div key={key} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-text">{pos.sym}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        pos.side === "long" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {pos.side.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {pos.qty} × ${pos.entry.toFixed(2)} · {pos.ex}
                  </div>
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

        {/* Sinyal Akışı (kompakt) */}
        <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
          <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
            <Activity size={13} className="text-accent" />
            <span className="text-sm font-semibold text-text">Sinyal Akışı</span>
            <span className="ml-auto text-[10px] text-text-dim">{signals.length} toplam</span>
          </div>
          <div className="divide-y divide-line max-h-52 overflow-auto">
            {recentSignals.length === 0 && (
              <div className="px-4 py-6 text-center text-text-dim text-xs">Sinyal bekleniyor...</div>
            )}
            {recentSignals.map((s) => (
              <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text">{s.sym}</span>
                    <span className="text-[10px] text-text-dim">{s.ex}</span>
                    {s.strength >= 0.80 && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">HOT</span>
                    )}
                  </div>
                  {s.reason && (
                    <div className="text-[10px] text-text-dim mt-0.5 truncate max-w-40">{s.reason}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-1.5 bg-bg-soft rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s.strength >= 0.80 ? "bg-amber-400" : s.side === "buy" ? "bg-up" : "bg-down"
                      }`}
                      style={{ width: `${s.strength * 100}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      s.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
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
            <button onClick={() => navigate("/trade")} className="text-xs text-accent hover:underline">
              Tümü →
            </button>
          </div>
          <div className="divide-y divide-line">
            {recentOrders.map((o) => (
              <div key={o.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      o.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {o.side.toUpperCase()}
                  </span>
                  <span className="font-mono font-medium text-text">{o.sym}</span>
                  <span className="text-xs text-text-dim">{o.exchange} · {o.qty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text">${o.px.toFixed(2)}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      o.status === "filled" ? "bg-green-100 text-green-700" : "bg-bg-soft text-text-dim"
                    }`}
                  >
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
