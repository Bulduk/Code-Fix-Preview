import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore, ExchangeBalance } from "@/lib/store";
import {
  TrendingUp, TrendingDown, Download, Trash2,
  RefreshCw, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

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

export default function PnL() {
  const token        = useStore((s) => s.token);
  const livePnL      = useStore((s) => s.pnl);
  const { exchangeBalances, setExchangeBalances } = useStore();

  const [rows,          setRows]          = useState<Array<{ ts: number; equity: number; realized: number; unrealized: number }>>([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [loading,       setLoading]       = useState(false);
  const [refreshing,    setRefreshing]    = useState<Record<string, boolean>>({});
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({});

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
