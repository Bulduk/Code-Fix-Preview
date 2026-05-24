import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useStore, ExchangeBalance } from "@/lib/store";
import {
  TrendingUp, TrendingDown, Download, Trash2,
  RefreshCw, Loader2, ChevronDown, ChevronUp, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

const EX_COLORS: Record<string, string> = {
  okx:     "bg-blue-600",
  binance: "bg-amber-500",
  bybit:   "bg-purple-600",
};
const MODE_COLORS: Record<string, string> = {
  live:    "bg-green-100 text-green-700",
  testnet: "bg-amber-100 text-amber-700",
  paper:   "bg-blue-100 text-blue-700",
};

type SnapRow = { ts: number; equity: number; realized: number; unrealized: number };

// Custom tooltip for the chart
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-elev border border-line rounded-xl px-3 py-2 shadow-lg text-xs">
      <div className="text-text-dim mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-text-dim capitalize">{p.name}:</span>
          <span className="font-mono font-semibold text-text">${p.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function PnL() {
  const token        = useStore((s) => s.token);
  const livePnL      = useStore((s) => s.pnl);
  const pnlHistory   = useStore((s) => s.pnlHistory);
  const pushPnlHistory = useStore((s) => s.pushPnlHistory);
  const { exchangeBalances, setExchangeBalances } = useStore();

  const [rows,          setRows]          = useState<SnapRow[]>([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [loading,       setLoading]       = useState(false);
  const [refreshing,    setRefreshing]    = useState<Record<string, boolean>>({});
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({});
  const [chartRange,    setChartRange]    = useState<"1h" | "24h" | "7d" | "all">("24h");

  const loadAll = async () => {
    if (!token) return;
    const [snaps, balances] = await Promise.all([
      api.getPnLSnapshots(),
      api.getExchangeBalances(),
    ]);
    setRows(snaps);
    setExchangeBalances(balances as ExchangeBalance[]);
  };

  useEffect(() => { loadAll(); }, [token]);

  // Push live PnL into history every 30s
  useEffect(() => {
    if (!livePnL) return;
    const interval = setInterval(() => {
      pushPnlHistory({ ts: Date.now(), equity: livePnL.equity, realized: livePnL.realized, unrealized: livePnL.unrealized });
    }, 30000);
    // Push immediately
    pushPnlHistory({ ts: Date.now(), equity: livePnL.equity, realized: livePnL.realized, unrealized: livePnL.unrealized });
    return () => clearInterval(interval);
  }, [livePnL?.equity]);

  const totalBalance = exchangeBalances.reduce((a, b) => a + b.totalUsd, 0);
  const liveBalances = exchangeBalances.filter((b) => b.mode === "live");
  const liveTotal    = liveBalances.reduce((a, b) => a + b.totalUsd, 0);

  const refreshBalance = async (id: string) => {
    setRefreshing((r) => ({ ...r, [id]: true }));
    const result = await api.refreshExchangeBalance(id);
    setExchangeBalances(
      exchangeBalances.map((b) =>
        b.exchangeId === id ? { ...b, totalUsd: result.totalUsd, fetchedAt: result.fetchedAt } : b
      )
    );
    setRefreshing((r) => ({ ...r, [id]: false }));
  };

  const exportFile = (fmt: "csv" | "json") => {
    if (fmt === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "pnl.json" });
      a.click();
    } else {
      const lines = rows.map((r) => `${r.ts},${r.equity},${r.realized},${r.unrealized}`);
      const blob  = new Blob([["ts,equity,realized,unrealized", ...lines].join("\n")], { type: "text/csv" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "pnl.csv" });
      a.click();
    }
  };

  const purge = async () => {
    if (!confirm(`${retentionDays} günden eski PnL kayıtları silinecek. Onayla?`)) return;
    setLoading(true);
    await api.purgePnL(Date.now() - retentionDays * 86400000);
    await loadAll();
    setLoading(false);
  };

  const realized   = livePnL?.realized   ?? 0;
  const unrealized = livePnL?.unrealized ?? 0;
  const totalPnl   = realized + unrealized;

  // Build chart data — combine server snapshots + live history
  const chartData = useMemo(() => {
    const now = Date.now();
    const cutoff = chartRange === "1h"  ? now - 3600000
                 : chartRange === "24h" ? now - 86400000
                 : chartRange === "7d"  ? now - 7 * 86400000
                 : 0;

    // Merge server rows + live history, deduplicate by ts bucket (1min)
    const allPoints: SnapRow[] = [
      ...rows.filter((r) => r.ts >= cutoff),
      ...pnlHistory.filter((r) => r.ts >= cutoff),
    ].sort((a, b) => a.ts - b.ts);

    // Deduplicate by 1-minute buckets
    const seen = new Set<number>();
    return allPoints
      .filter((r) => {
        const bucket = Math.floor(r.ts / 60000);
        if (seen.has(bucket)) return false;
        seen.add(bucket);
        return true;
      })
      .map((r) => ({
        time: new Date(r.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        equity: Number(r.equity.toFixed(2)),
        realized: Number(r.realized.toFixed(2)),
        unrealized: Number(r.unrealized.toFixed(2)),
      }));
  }, [rows, pnlHistory, chartRange]);

  const equityStart = chartData[0]?.equity ?? 0;
  const equityEnd   = chartData[chartData.length - 1]?.equity ?? 0;
  const equityDelta = equityEnd - equityStart;
  const equityUp    = equityDelta >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Kâr / Zarar</h1>
          <p className="text-xs text-text-dim">Bağlı borsalar · Gerçek bakiye + P&L</p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line text-sm text-text-dim hover:bg-bg-soft transition">
          <RefreshCw size={13} /> Yenile
        </button>
      </div>

      {/* ── Toplam Özet ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Toplam Bakiye" value={totalBalance} prefix="$" big />
        <SummaryCard label="Canlı Bakiye"  value={liveTotal}   prefix="$" />
        <SummaryCard label="Gerçekleşen K/Z" value={realized}  prefix="$" showSign />
        <SummaryCard label="Gerçekleşmemiş"  value={unrealized} prefix="$" showSign />
      </div>

      {/* ── Toplam P&L Özet Kartı ── */}
      <div className={`rounded-2xl p-4 border shadow-card ${totalPnl >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-text-dim">Toplam Kâr / Zarar</div>
            <div className={`text-2xl font-bold font-mono mt-0.5 ${totalPnl >= 0 ? "text-green-700" : "text-red-700"}`}>
              {totalPnl >= 0 ? "+" : "−"}${Math.abs(totalPnl).toFixed(2)}
            </div>
            <div className="text-xs mt-1 text-text-dim">
              Gerçekleşen: <span className={realized >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{realized >= 0 ? "+" : ""}${realized.toFixed(2)}</span>
              &nbsp;·&nbsp;
              Gerçekleşmemiş: <span className={unrealized >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}</span>
            </div>
          </div>
          <div className={`w-12 h-12 rounded-full grid place-items-center ${totalPnl >= 0 ? "bg-green-100" : "bg-red-100"}`}>
            {totalPnl >= 0
              ? <TrendingUp size={22} className="text-green-600" />
              : <TrendingDown size={22} className="text-red-600" />}
          </div>
        </div>
      </div>

      {/* ── Equity Chart ── */}
      <div className="bg-bg-elev border border-line rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-accent" />
            <span className="text-sm font-bold text-text">Equity Grafiği</span>
            {chartData.length > 1 && (
              <span className={`text-xs font-semibold ${equityUp ? "text-up" : "text-down"}`}>
                {equityUp ? "+" : ""}{equityDelta.toFixed(2)} ({equityUp ? "+" : ""}{equityStart > 0 ? ((equityDelta / equityStart) * 100).toFixed(2) : "0"}%)
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {(["1h", "24h", "7d", "all"] as const).map((r) => (
              <button key={r} onClick={() => setChartRange(r)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${chartRange === r ? "bg-accent text-white" : "bg-bg-soft text-text-dim hover:bg-line border border-line"}`}>
                {r === "all" ? "Tümü" : r}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {chartData.length < 2 ? (
            <div className="h-48 flex items-center justify-center text-text-dim text-sm">
              <div className="text-center">
                <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                <div>Grafik için veri bekleniyor...</div>
                <div className="text-xs mt-1 opacity-60">Sistem çalışırken otomatik dolar</div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={equityUp ? "#16a34a" : "#dc2626"} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={equityUp ? "#16a34a" : "#dc2626"} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="realizedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#dde2ea" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} width={60} />
                <Tooltip content={<ChartTooltip />} />
                {equityStart > 0 && <ReferenceLine y={equityStart} stroke="#64748b" strokeDasharray="4 4" strokeWidth={1} />}
                <Area type="monotone" dataKey="equity" name="equity" stroke={equityUp ? "#16a34a" : "#dc2626"} strokeWidth={2} fill="url(#equityGrad)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="realized" name="gerçekleşen" stroke="#d97706" strokeWidth={1.5} fill="url(#realizedGrad)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Borsa Bakiyeleri ── */}
      <div className="bg-bg-elev border border-line rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <span className="text-sm font-bold text-text">Borsa Bakiyeleri</span>
          <span className="text-xs text-text-dim">{exchangeBalances.length} hesap</span>
        </div>

        {exchangeBalances.length === 0 && (
          <div className="px-4 py-8 text-center text-text-dim text-sm">Bakiye yükleniyor...</div>
        )}

        {exchangeBalances.map((bal) => {
          const isExpanded = expanded[bal.exchangeId];
          return (
            <div key={bal.exchangeId} className="border-b border-line last:border-0">
              {/* Exchange row */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl grid place-items-center text-white text-xs font-bold uppercase shrink-0 ${EX_COLORS[bal.exchange] ?? "bg-text-dim"}`}>
                  {bal.exchange.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text capitalize">{bal.exchange} / {bal.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${MODE_COLORS[bal.mode] ?? "bg-bg-soft text-text-dim"}`}>{bal.mode}</span>
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {new Date(bal.fetchedAt).toLocaleTimeString("tr-TR")} · {bal.assets.length} varlık
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-text">${bal.totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-text-dim">toplam USD</div>
                  </div>
                  <button
                    onClick={() => refreshBalance(bal.exchangeId)}
                    disabled={!!refreshing[bal.exchangeId]}
                    className="p-1.5 rounded-lg hover:bg-bg-soft text-text-dim transition disabled:opacity-50"
                  >
                    {refreshing[bal.exchangeId]
                      ? <Loader2 size={13} className="animate-spin" />
                      : <RefreshCw size={13} />}
                  </button>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [bal.exchangeId]: !e[bal.exchangeId] }))}
                    className="p-1.5 rounded-lg hover:bg-bg-soft text-text-dim transition"
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Asset breakdown */}
              {isExpanded && (
                <div className="px-4 pb-3">
                  <div className="bg-bg-soft rounded-xl overflow-hidden border border-line">
                    <div className="grid px-3 py-1.5 text-[10px] text-text-dim font-medium border-b border-line"
                         style={{ gridTemplateColumns: "80px 1fr 1fr 1fr" }}>
                      <span>Varlık</span><span className="text-right">Serbest</span>
                      <span className="text-right">Kilitli</span><span className="text-right">USD Değer</span>
                    </div>
                    {bal.assets.length === 0 && (
                      <div className="px-3 py-3 text-xs text-text-dim text-center">API key eklenmemiş — paper mod</div>
                    )}
                    {bal.assets.map((a) => (
                      <div key={a.asset} className="grid px-3 py-1.5 text-xs border-b border-line/50 last:border-0 items-center"
                           style={{ gridTemplateColumns: "80px 1fr 1fr 1fr" }}>
                        <span className="font-semibold text-text">{a.asset}</span>
                        <span className="text-right font-mono text-text">{a.free.toLocaleString("en-US", { maximumFractionDigits: 6 })}</span>
                        <span className="text-right font-mono text-text-dim">{a.locked > 0 ? a.locked.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"}</span>
                        <span className="text-right font-mono font-medium text-text">${a.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    {/* Allocation bar */}
                    {bal.assets.length > 0 && bal.totalUsd > 0 && (
                      <div className="px-3 py-2 border-t border-line">
                        <div className="flex gap-1 h-2">
                          {bal.assets.map((a) => (
                            <div
                              key={a.asset}
                              title={`${a.asset}: $${a.usdValue.toFixed(2)}`}
                              className="rounded-full"
                              style={{
                                width: `${(a.usdValue / bal.totalUsd) * 100}%`,
                                backgroundColor: a.asset === "USDT" ? "#94a3b8" :
                                  a.asset === "BTC" ? "#f59e0b" :
                                  a.asset === "ETH" ? "#6366f1" :
                                  a.asset === "SOL" ? "#8b5cf6" : "#10b981",
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {bal.assets.map((a) => (
                            <span key={a.asset} className="text-[9px] text-text-dim flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ backgroundColor: a.asset === "USDT" ? "#94a3b8" : a.asset === "BTC" ? "#f59e0b" : a.asset === "ETH" ? "#6366f1" : a.asset === "SOL" ? "#8b5cf6" : "#10b981" }} />
                              {a.asset} {((a.usdValue / bal.totalUsd) * 100).toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Dışa Aktar / Temizle ── */}
      <div className="bg-bg-elev border border-line rounded-2xl p-3 flex flex-wrap gap-2 items-center shadow-card">
        <button onClick={() => exportFile("csv")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-soft text-sm text-text hover:bg-line transition border border-line">
          <Download size={13} /> CSV
        </button>
        <button onClick={() => exportFile("json")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-soft text-sm text-text hover:bg-line transition border border-line">
          <Download size={13} /> JSON
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-text-dim text-xs">Sakla (gün)</span>
          <input type="number" min={1} value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="w-16 bg-bg-soft px-2 py-1 rounded-lg text-sm text-text outline-none border border-line" />
          <button onClick={purge} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-down/10 text-down text-sm border border-down/20 hover:bg-down/20 transition disabled:opacity-60">
            <Trash2 size={12} /> Temizle
          </button>
        </div>
      </div>

      {/* ── Geçmiş Tablo ── */}
      <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
        <div className="px-4 py-2.5 border-b border-line text-sm font-bold text-text">P&L Geçmişi</div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-soft text-text-dim text-xs">
              <tr>
                <th className="text-left px-4 py-2">Tarih</th>
                <th className="text-right px-4 py-2">Equity</th>
                <th className="text-right px-4 py-2">Gerçekleşen</th>
                <th className="text-right px-4 py-2">Gerçekleşmemiş</th>
                <th className="text-right px-4 py-2">Toplam K/Z</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const total = r.realized + r.unrealized;
                return (
                  <tr key={i} className="border-t border-line hover:bg-bg-soft transition">
                    <td className="px-4 py-2 font-mono text-xs text-text-dim">
                      {new Date(r.ts).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-text">
                      ${Number(r.equity).toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${r.realized >= 0 ? "text-up" : "text-down"}`}>
                      {r.realized >= 0 ? "+" : ""}${Number(r.realized).toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${r.unrealized >= 0 ? "text-up" : "text-down"}`}>
                      {r.unrealized >= 0 ? "+" : ""}${Number(r.unrealized).toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${total >= 0 ? "text-up" : "text-down"}`}>
                      {total >= 0 ? "+" : ""}${total.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-text-dim">Kayıt yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, prefix = "", big, showSign }: {
  label: string; value: number; prefix?: string; big?: boolean; showSign?: boolean;
}) {
  const pos = value >= 0;
  return (
    <div className="bg-bg-elev border border-line rounded-2xl p-3 shadow-card">
      <div className="text-xs text-text-dim mb-1">{label}</div>
      <div className={`font-bold font-mono ${big ? "text-xl" : "text-base"} ${showSign ? (pos ? "text-up" : "text-down") : "text-text"}`}>
        {showSign && !pos ? "−" : ""}{prefix}{Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      {showSign && (
        <div className={`flex items-center gap-1 mt-0.5 text-xs ${pos ? "text-up" : "text-down"}`}>
          {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {pos ? "Kâr" : "Zarar"}
        </div>
      )}
    </div>
  );
}
