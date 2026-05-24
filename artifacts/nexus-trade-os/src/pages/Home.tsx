import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { ExchangeBalance } from "@/lib/store";

const WATCHLIST = [
  { key: "binance:BTCUSDT",  label: "BTC/USDT",  base: "BTC"  },
  { key: "binance:ETHUSDT",  label: "ETH/USDT",  base: "ETH"  },
  { key: "binance:BNBUSDT",  label: "BNB/USDT",  base: "BNB"  },
  { key: "binance:SOLUSDT",  label: "SOL/USDT",  base: "SOL"  },
  { key: "binance:XRPUSDT",  label: "XRP/USDT",  base: "XRP"  },
  { key: "binance:ADAUSDT",  label: "ADA/USDT",  base: "ADA"  },
  { key: "binance:ARBUSDT",  label: "ARB/USDT",  base: "ARB"  },
  { key: "binance:LINKUSDT", label: "LINK/USDT", base: "LINK" },
];

function MiniSparkline({ change }: { change: number }) {
  const up   = change >= 0;
  const seed = Math.abs(change * 1000) % 7;
  const pts  = Array.from({ length: 14 }, (_, i) => {
    const noise = Math.sin(i * seed + 1) * 3;
    return 18 - (i / 13) * change * 80 + noise;
  }).reverse();
  const min  = Math.min(...pts);
  const max  = Math.max(...pts);
  const norm = (v: number) => ((v - min) / (max - min || 1)) * 20;
  const d    = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i / 13) * 72},${20 - norm(v)}`).join(" ");
  return (
    <svg viewBox="0 0 72 22" className="w-14 h-4" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={up ? "#0ecb81" : "#f6465d"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ label, value, sub, up, prefix = "" }: {
  label: string; value: string; sub?: string; up?: boolean; prefix?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-[var(--color-text-dim)] mb-1.5 font-medium uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-black font-num ${
        up === undefined ? "text-[var(--color-text)]"
        : up ? "text-[var(--color-up)]" : "text-[var(--color-down)]"
      }`}>
        {prefix}{value}
      </div>
      {sub && <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{sub}</div>}
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
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    if (!token || exchangeBalances.length > 0) return;
    loadBalances();
  }, [token]);

  const topSignals      = useMemo(() => signals.filter((s) => s.strength >= 0.78).slice(0, 5), [signals]);
  const recentSignals   = useMemo(() => signals.slice(0, 10), [signals]);
  const activePositions = Object.entries(positions);
  const recentOrders    = orders.slice(0, 5);

  const equity     = pnl?.equity     ?? 0;
  const realized   = pnl?.realized   ?? 0;
  const unrealized = pnl?.unrealized ?? 0;

  const todayPnl = useMemo(() => {
    const pts = pnlHistory.slice(-10).map((p) => p.equity);
    if (pts.length < 2) return null;
    const first = pts[0]!;
    const last  = pts[pts.length - 1]!;
    return { delta: last - first, pct: first > 0 ? ((last - first) / first) * 100 : 0, up: last >= first };
  }, [pnlHistory]);

  const btcTick = ticks["binance:BTCUSDT"];
  const ethTick = ticks["binance:ETHUSDT"];

  return (
    <div className="space-y-4">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--color-text)]">Dashboard</h1>
          <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
            Binance · {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-soft)] border border-[var(--color-line)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] animate-pulse" />
            <span className="text-[10px] font-semibold text-[var(--color-up)]">Canlı</span>
          </div>
          <button
            onClick={loadBalances}
            disabled={refreshing}
            className="p-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)] transition disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className={refreshing ? "animate-spin" : ""}>
              <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <polyline points="14,2 14,8 8,8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Toplam Bakiye"
          value={`$${equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="USDT eşdeğeri"
        />
        <StatCard
          label="Bugünkü K/Z"
          value={todayPnl ? `${todayPnl.up ? "+" : ""}$${Math.abs(todayPnl.delta).toFixed(2)}` : "—"}
          sub={todayPnl ? `${todayPnl.up ? "+" : ""}${todayPnl.pct.toFixed(2)}%` : undefined}
          up={todayPnl?.up}
        />
        <StatCard
          label="Gerçekleşen K/Z"
          value={`${realized >= 0 ? "+" : ""}$${Math.abs(realized).toFixed(2)}`}
          sub="Kapalı pozisyonlar"
          up={realized >= 0}
        />
        <StatCard
          label="Açık Pozisyonlar"
          value={String(activePositions.length)}
          sub={`${unrealized >= 0 ? "+" : ""}$${unrealized.toFixed(2)} açık K/Z`}
          up={unrealized >= 0}
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left: Watchlist ── */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-line)]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--color-text)]">Favori Çiftler</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 font-semibold">
                Binance
              </span>
            </div>
            <button onClick={() => navigate("/markets")} className="text-xs text-[var(--color-accent)] hover:underline font-medium">
              Tümünü Gör →
            </button>
          </div>

          {/* Table header */}
          <div className="grid px-4 py-2 text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider border-b border-[var(--color-line)]"
            style={{ gridTemplateColumns: "1fr 100px 80px 60px 80px" }}>
            <span>Sembol</span>
            <span className="text-right">Fiyat</span>
            <span className="text-right">24s %</span>
            <span className="text-right hidden sm:block">RSI</span>
            <span className="text-right">Grafik</span>
          </div>

          <div className="divide-y divide-[var(--color-line)]">
            {WATCHLIST.map(({ key, label, base }) => {
              const tick = ticks[key];
              if (!tick) return (
                <div key={key} className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: "1fr 100px 80px 60px 80px" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-soft)] border border-[var(--color-line)] animate-pulse" />
                    <div className="h-3 w-20 bg-[var(--color-bg-soft)] rounded animate-pulse" />
                  </div>
                </div>
              );
              const up  = (tick.change ?? 0) >= 0;
              const sig = signals.find((s) => `${s.ex}:${s.sym}` === key);
              return (
                <div
                  key={key}
                  onClick={() => navigate(`/trade?sym=${key.split(":")[1]}`)}
                  className="grid px-4 py-2.5 items-center cursor-pointer hover:bg-[var(--color-bg-soft)] transition group"
                  style={{ gridTemplateColumns: "1fr 100px 80px 60px 80px" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-soft)] border border-[var(--color-line)] grid place-items-center text-[10px] font-black text-[var(--color-accent)] shrink-0 group-hover:border-[var(--color-accent)]/30 transition">
                      {base.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--color-text)]">{label}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-[var(--color-text-muted)]">Binance Spot</span>
                        {sig && (
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                            sig.side === "buy" ? "badge-up" : "badge-down"
                          }`}>
                            {sig.side.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-num font-bold text-sm text-[var(--color-text)]">
                    {tick.px < 1 ? tick.px.toFixed(4) : tick.px.toFixed(2)}
                  </div>
                  <div className={`text-right text-xs font-bold font-num ${up ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
                    {up ? "+" : ""}{((tick.change ?? 0) * 100).toFixed(2)}%
                  </div>
                  <div className={`text-right text-xs font-num hidden sm:block ${
                    tick.rsi && tick.rsi > 70 ? "text-[var(--color-down)]"
                    : tick.rsi && tick.rsi < 30 ? "text-[var(--color-up)]"
                    : "text-[var(--color-text-dim)]"
                  }`}>
                    {tick.rsi?.toFixed(0) ?? "—"}
                  </div>
                  <div className="flex justify-end">
                    <MiniSparkline change={tick.change ?? 0} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Signal Feed + Quick Actions ── */}
        <div className="space-y-4">

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate("/trade")}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-[var(--color-up)]/10 border border-[var(--color-up)]/20 text-[var(--color-up)] hover:bg-[var(--color-up)]/20 transition font-semibold text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <polyline points="2,12 6,7 9,9 14,3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="11,3 14,3 14,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Hızlı Al
            </button>
            <button
              onClick={() => navigate("/trade")}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-[var(--color-down)]/10 border border-[var(--color-down)]/20 text-[var(--color-down)] hover:bg-[var(--color-down)]/20 transition font-semibold text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <polyline points="2,4 6,9 9,7 14,13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="11,13 14,13 14,10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Hızlı Sat
            </button>
          </div>

          {/* Market Summary */}
          <div className="card p-4">
            <div className="text-xs font-bold text-[var(--color-text)] mb-3">Piyasa Özeti</div>
            <div className="space-y-2.5">
              {[
                { label: "BTC Dominance", value: "52.4%", up: true },
                { label: "Fear & Greed",  value: "68 — Açgözlü", up: true },
                { label: "BTC",  value: btcTick ? `$${btcTick.px.toFixed(0)}` : "—", up: (btcTick?.change ?? 0) >= 0 },
                { label: "ETH",  value: ethTick ? `$${ethTick.px.toFixed(0)}` : "—", up: (ethTick?.change ?? 0) >= 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-dim)]">{item.label}</span>
                  <span className={`text-xs font-bold font-num ${item.up ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Signal Feed */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-line)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                <span className="text-sm font-bold text-[var(--color-text)]">Sinyal Akışı</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)]">{signals.length} toplam</span>
            </div>
            <div className="divide-y divide-[var(--color-line)] max-h-56 overflow-auto">
              {recentSignals.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-[var(--color-text-dim)]">Sinyal bekleniyor...</div>
              )}
              {recentSignals.map((s) => (
                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--color-bg-soft)] transition">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[var(--color-text)]">{s.sym}</span>
                      {s.strength >= 0.80 && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold border border-[var(--color-accent)]/20">HOT</span>
                      )}
                    </div>
                    {s.reason && (
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate max-w-32">{s.reason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1 bg-[var(--color-bg-soft)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.side === "buy" ? "bg-[var(--color-up)]" : "bg-[var(--color-down)]"}`}
                        style={{ width: `${s.strength * 100}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      s.side === "buy" ? "badge-up" : "badge-down"
                    }`}>
                      {s.side.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Strong Signals Banner ── */}
      {topSignals.length > 0 && (
        <div className="card border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <polyline points="9,1 4,9 8,9 7,15 12,7 8,7 9,1" stroke="#f0b90b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-bold text-[var(--color-accent)]">Güçlü Sinyaller</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/20">
              {topSignals.length} aktif
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {topSignals.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/trade?sym=${s.sym}`)}
                className="flex items-center justify-between bg-[var(--color-bg-elev)] rounded-xl px-3 py-2.5 cursor-pointer hover:bg-[var(--color-bg-soft)] transition border border-[var(--color-line)]"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    s.side === "buy" ? "badge-up" : "badge-down"
                  }`}>
                    {s.side.toUpperCase()}
                  </span>
                  <span className="font-num text-sm font-bold text-[var(--color-text)]">{s.sym}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{s.ex}</span>
                </div>
                <span className="text-xs font-bold text-[var(--color-accent)] font-num">
                  {(s.strength * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom Grid: Positions + Orders ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Active Positions */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-line)]">
            <span className="text-sm font-bold text-[var(--color-text)]">Aktif Pozisyonlar</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] border border-[var(--color-line)] font-semibold">
              {activePositions.length}
            </span>
          </div>
          <div className="divide-y divide-[var(--color-line)]">
            {activePositions.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-[var(--color-text-dim)]">
                <div className="text-2xl mb-2">📊</div>
                Açık pozisyon yok
              </div>
            )}
            {activePositions.map(([key, pos]) => (
              <div key={key} className="px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-soft)] transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-num text-[var(--color-text)]">{pos.sym}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      pos.side === "long" ? "badge-up" : "badge-down"
                    }`}>
                      {pos.side.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 font-num">
                    {pos.qty} × ${pos.entry.toFixed(2)} · {pos.ex}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold font-num ${pos.pnl >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
                    {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] font-num">Mark: ${pos.mark.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-line)]">
            <span className="text-sm font-bold text-[var(--color-text)]">Son Emirler</span>
            <button onClick={() => navigate("/trade")} className="text-xs text-[var(--color-accent)] hover:underline font-medium">
              Tümü →
            </button>
          </div>
          <div className="divide-y divide-[var(--color-line)]">
            {recentOrders.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-[var(--color-text-dim)]">
                <div className="text-2xl mb-2">📋</div>
                Emir geçmişi yok
              </div>
            )}
            {recentOrders.map((o) => (
              <div key={o.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--color-bg-soft)] transition">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    o.side === "buy" ? "badge-up" : "badge-down"
                  }`}>
                    {o.side.toUpperCase()}
                  </span>
                  <div>
                    <div className="text-xs font-bold font-num text-[var(--color-text)]">{o.sym}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{o.ex} · {o.qty}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-num font-semibold text-[var(--color-text)]">${o.px.toFixed(2)}</div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                    o.status === "filled" ? "badge-up"
                    : o.status === "open" ? "bg-[var(--color-accent2)]/10 text-[var(--color-accent2)] border border-[var(--color-accent2)]/20"
                    : "badge-neutral"
                  }`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Nav Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Piyasalar",  href: "/markets", emoji: "📈", desc: "Tüm çiftler" },
          { label: "Portföy",    href: "/pnl",     emoji: "💰", desc: "K/Z analizi" },
          { label: "Risk",       href: "/risk",    emoji: "🛡️", desc: "Risk yönetimi" },
          { label: "AI Ajanlar", href: "/agents",  emoji: "🤖", desc: "Ajan yönetimi" },
        ].map((item) => (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className="card p-4 flex flex-col items-start gap-2 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-bg-soft)] transition text-left group"
          >
            <span className="text-2xl">{item.emoji}</span>
            <div>
              <div className="text-sm font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition">{item.label}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
