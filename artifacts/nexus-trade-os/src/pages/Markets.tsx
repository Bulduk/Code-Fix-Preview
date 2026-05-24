import { useMemo, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";

type Tab = "spot" | "perp" | "futures" | "margin";
type SortKey = "px" | "change" | "vol" | "rsi";

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: "spot",    label: "Spot",     desc: "Anlık alım satım"  },
  { id: "perp",    label: "Sürekli",  desc: "Perpetual futures" },
  { id: "futures", label: "Vadeli",   desc: "Delivery futures"  },
  { id: "margin",  label: "Marjin",   desc: "Kaldıraçlı spot"  },
];

const SYM_CATS: Record<string, string> = {
  BTCUSDT: "major", ETHUSDT: "major", SOLUSDT: "major", BNBUSDT: "major",
  XRPUSDT: "major", ADAUSDT: "major", DOGEUSDT: "meme",  SHIBUSDT: "meme",
  LINKUSDT: "defi", AAVEUSDT: "defi", UNIUSDT: "defi",   MATICUSDT: "layer2",
  ARBUSDT: "layer2", OPUSDT: "layer2",
};

function baseSym(sym: string) {
  return sym.replace("-PERP", "").replace("-MARGIN", "").replace(/-\d{6}$/, "");
}
function guessTab(sym: string): Tab {
  if (sym.includes("-MARGIN")) return "margin";
  if (sym.includes("-PERP"))   return "perp";
  if (sym.match(/-\d{6}$/))   return "futures";
  return "spot";
}

function MiniSparkline({ change }: { change: number }) {
  const up   = change >= 0;
  const seed = Math.abs(change * 1000) % 7;
  const pts  = Array.from({ length: 14 }, (_, i) => {
    const noise = Math.sin(i * seed + 1) * 3;
    return 18 - (i / 13) * change * 80 + noise;
  }).reverse();
  const min  = Math.min(...pts);
  const max  = Math.max(...pts);
  const norm = (v: number) => ((v - min) / (max - min || 1)) * 18;
  const d    = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i / 13) * 64},${18 - norm(v)}`).join(" ");
  return (
    <svg viewBox="0 0 64 20" className="w-12 h-3.5" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={up ? "#0ecb81" : "#f6465d"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Coin Detail Modal ──────────────────────────────────────────────────────
function CoinModal({
  sym, ex, px, change, vol24h, high24h, low24h, rsi,
  onClose, onTrade,
}: {
  sym: string; ex: string; px: number; change: number;
  vol24h?: number; high24h?: number; low24h?: number; rsi?: number;
  onClose: () => void; onTrade: () => void;
}) {
  const base = sym.replace("USDT", "").replace("-PERP", "").replace("-MARGIN", "");
  const up   = change >= 0;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty,  setQty]  = useState("0.01");

  // Sparkline
  const seed = Math.abs(change * 1000) % 7;
  const pts  = Array.from({ length: 24 }, (_, i) => {
    const noise = Math.sin(i * seed + 1) * 5;
    return 40 - (i / 23) * change * 200 + noise;
  }).reverse();
  const min  = Math.min(...pts);
  const max  = Math.max(...pts);
  const norm = (v: number) => ((v - min) / (max - min || 1)) * 48;
  const d    = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i / 23) * 280},${48 - norm(v)}`).join(" ");

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-end sm:place-items-center px-0 sm:px-4" onClick={onClose}>
      <div
        className="bg-[var(--color-bg-elev)] border border-[var(--color-line)] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--color-line)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-soft)] border border-[var(--color-line)] grid place-items-center text-sm font-black text-[var(--color-accent)]">
              {base.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--color-text)]">{base}/USDT</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                  {ex.toUpperCase()}
                </span>
              </div>
              <div className={`text-xs font-bold font-num ${up ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
                {up ? "+" : ""}{(change * 100).toFixed(2)}%
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] transition">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Price + Chart */}
        <div className="px-5 pt-4 pb-2">
          <div className="text-3xl font-black font-num text-[var(--color-text)]">
            {px < 0.01 ? px.toFixed(6) : px < 1 ? px.toFixed(4) : px < 100 ? px.toFixed(2) : px.toFixed(1)}
            <span className="text-sm font-normal text-[var(--color-text-dim)] ml-1">USDT</span>
          </div>
          <div className="mt-3">
            <svg viewBox="0 0 280 52" className="w-full h-12" preserveAspectRatio="none">
              <defs>
                <linearGradient id="modalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={up ? "#0ecb81" : "#f6465d"} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={up ? "#0ecb81" : "#f6465d"} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={d + ` L${280},52 L0,52 Z`} fill="url(#modalGrad)" />
              <path d={d} fill="none" stroke={up ? "#0ecb81" : "#f6465d"} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-px bg-[var(--color-line)] mx-5 rounded-xl overflow-hidden mb-4">
          {[
            { label: "24h Yüksek", value: high24h ? `$${high24h.toFixed(1)}` : "—" },
            { label: "24h Düşük",  value: low24h  ? `$${low24h.toFixed(1)}`  : "—" },
            { label: "Hacim 24h",  value: vol24h  ? `$${(vol24h / 1e6).toFixed(0)}M` : "—" },
            { label: "RSI(14)",    value: rsi     ? rsi.toFixed(0) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--color-bg-elev)] px-2 py-2.5 text-center">
              <div className="text-xs font-bold font-num text-[var(--color-text)]">{value}</div>
              <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* RSI bar */}
        {rsi && (
          <div className="px-5 mb-4">
            <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mb-1.5">
              <span>Aşırı Satım (30)</span>
              <span className={`font-bold font-num ${rsi < 30 ? "text-[var(--color-up)]" : rsi > 70 ? "text-[var(--color-down)]" : "text-[var(--color-accent)]"}`}>
                RSI {rsi.toFixed(0)}
              </span>
              <span>Aşırı Alım (70)</span>
            </div>
            <div className="h-1.5 bg-[var(--color-bg-soft)] rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0ecb81] via-[#f0b90b] to-[#f6465d] opacity-25 rounded-full" />
              <div
                className="absolute top-0 h-full w-0.5 bg-white/80 rounded-full transition-all"
                style={{ left: `${(rsi / 100) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Trade form */}
        <div className="px-5 pb-5 space-y-3">
          <div className="flex gap-2">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  side === s
                    ? s === "buy"
                      ? "bg-[var(--color-up)] text-white shadow-[0_4px_12px_rgba(14,203,129,0.3)]"
                      : "bg-[var(--color-down)] text-white shadow-[0_4px_12px_rgba(246,70,93,0.3)]"
                    : "bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] border border-[var(--color-line)] hover:bg-[var(--color-line)]"
                }`}
              >
                {s === "buy" ? "AL" : "SAT"}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              step="0.001"
              className="flex-1 bg-[var(--color-bg-soft)] border border-[var(--color-line)] rounded-xl px-3 py-2.5 text-sm text-[var(--color-text)] font-num"
            />
            <span className="text-xs text-[var(--color-text-dim)] font-semibold">{base}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] px-1">
            <span>≈ <span className="font-num font-semibold text-[var(--color-text)]">${(Number(qty) * px).toFixed(2)}</span> USDT</span>
            <span>Min: 0.001 {base}</span>
          </div>
          <button
            onClick={onTrade}
            className={`w-full py-3 rounded-xl font-bold text-white transition ${
              side === "buy"
                ? "bg-[var(--color-up)] hover:brightness-110 shadow-[0_4px_16px_rgba(14,203,129,0.25)]"
                : "bg-[var(--color-down)] hover:brightness-110 shadow-[0_4px_16px_rgba(246,70,93,0.25)]"
            }`}
          >
            {side === "buy" ? "AL" : "SAT"} — {qty} {base}
          </button>
          <button
            onClick={onTrade}
            className="w-full py-2 rounded-xl text-xs text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/5 transition"
          >
            Trade sayfasında aç →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Markets() {
  const { ticks, signals: allSignals, okxConnected } = useStore();
  const [, navigate] = useLocation();
  const [tab,    setTab]    = useState<Tab>("spot");
  const [search, setSearch] = useState("");
  const [sort,   setSort]   = useState<SortKey>("vol");
  const [asc,    setAsc]    = useState(false);
  const [cat,    setCat]    = useState("all");
  const [modal,  setModal]  = useState<{ key: string } | null>(null);

  const toggleSort = useCallback((k: SortKey) => {
    setSort((s) => {
      if (s === k) { setAsc((v) => !v); return s; }
      setAsc(false);
      return k;
    });
  }, []);

  const { rows, counts } = useMemo(() => {
    const all = Object.entries(ticks).map(([key, v]) => {
      const [ex, sym] = key.split(":");
      const base      = baseSym(sym ?? "");
      return {
        key, ex: ex ?? "", sym: sym ?? "", base,
        tabType: guessTab(sym ?? ""),
        ...v,
        change: v.change ?? 0,
        cat: SYM_CATS[baseSym(sym ?? "")] ?? "other",
      };
    });

    const counts: Record<Tab, number> = { spot: 0, perp: 0, futures: 0, margin: 0 };
    all.forEach((r) => { if (r.tabType in counts) counts[r.tabType as Tab]++; });

    let filtered = all.filter((r) => r.tabType === tab);
    if (cat !== "all") filtered = filtered.filter((r) => r.cat === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) => r.sym.toLowerCase().includes(q) || r.base.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      const va = sort === "px" ? a.px : sort === "change" ? a.change : sort === "vol" ? (a.vol24h ?? 0) : (a.rsi ?? 50);
      const vb = sort === "px" ? b.px : sort === "change" ? b.change : sort === "vol" ? (b.vol24h ?? 0) : (b.rsi ?? 50);
      return asc ? va - vb : vb - va;
    });

    return { rows: filtered, counts };
  }, [ticks, tab, cat, search, sort, asc]);

  const modalData = modal
    ? (() => {
        const [ex, sym] = modal.key.split(":");
        const tick = ticks[modal.key];
        if (!tick) return null;
        return { sym: sym ?? "", ex: ex ?? "", ...tick, change: tick.change ?? 0 };
      })()
    : null;

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-0.5 text-[11px] font-semibold transition ${
        sort === k ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)]"
      }`}
    >
      {label}
      {sort === k && <span className="text-[9px] ml-0.5">{asc ? "↑" : "↓"}</span>}
    </button>
  );

  const CATS = [
    { id: "all",    label: "Tümü"  },
    { id: "major",  label: "Majör" },
    { id: "defi",   label: "DeFi"  },
    { id: "layer2", label: "L2"    },
    { id: "meme",   label: "Meme"  },
  ];

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-[var(--color-text)]">Piyasalar</h1>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)] mt-0.5">
            <span className="font-num">{rows.length} çift</span>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className="flex items-center gap-1 text-[var(--color-accent)] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              Binance
            </span>
            {okxConnected && (

              <span className="flex items-center gap-1 text-[var(--color-up)] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] animate-pulse" />
                OKX Live
              </span>
            )}
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BTC, ETH, SOL..."
            className="bg-[var(--color-bg-elev)] border border-[var(--color-line)] rounded-xl pl-8 pr-3 py-2 text-sm text-[var(--color-text)] w-40 placeholder-[var(--color-text-muted)]"
          />
        </div>
      </div>

      {/* Market Type Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setCat("all"); setSearch(""); }}
            className={`shrink-0 flex items-center gap-2 text-xs px-4 py-2 rounded-xl font-semibold transition border ${
              tab === t.id
                ? "bg-[var(--color-accent)] text-black border-transparent shadow-[0_2px_8px_rgba(240,185,11,0.3)]"
                : "bg-[var(--color-bg-elev)] border-[var(--color-line)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-soft)]"
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-num ${tab === t.id ? "opacity-70" : "opacity-50"}`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
              cat === c.id
                ? "bg-[var(--color-bg-soft)] border-[var(--color-accent)]/40 text-[var(--color-text)]"
                : "bg-[var(--color-bg-elev)] border-[var(--color-line)] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] hover:bg-[var(--color-bg-soft)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-bg-soft)]">
                <th className="text-left px-4 py-3 text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">Sembol</th>
                <th className="text-right px-3 py-3"><SortBtn k="px" label="Fiyat" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="change" label="24s %" /></th>
                <th className="text-right px-3 py-3 hidden sm:table-cell"><SortBtn k="vol" label="Hacim" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="rsi" label="RSI" /></th>
                <th className="text-right px-4 py-3 text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider hidden sm:table-cell">Grafik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[var(--color-text-dim)] text-sm">
                    <div className="text-3xl mb-3">📊</div>
                    {search ? "Sonuç bulunamadı" : "Veri bekleniyor..."}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const up  = r.change >= 0;
                const sig = allSignals.find(
                  (s) => s.sym === r.sym && s.ex === r.ex
                );
                return (
                  <tr
                    key={r.key}
                    onClick={() => setModal({ key: r.key })}
                    className="hover:bg-[var(--color-bg-soft)] cursor-pointer transition group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-soft)] border border-[var(--color-line)] grid place-items-center text-[10px] font-black text-[var(--color-accent)] shrink-0 group-hover:border-[var(--color-accent)]/30 transition">
                          {r.base.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[var(--color-text)]">{r.base}</span>
                            <span className="text-[var(--color-text-muted)] text-xs">/USDT</span>
                            {sig && (
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                sig.side === "buy" ? "badge-up" : "badge-down"
                              }`}>
                                {sig.side.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-[var(--color-text-muted)]">{r.ex}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-num font-bold text-sm text-[var(--color-text)]">
                      {r.px < 0.01 ? r.px.toFixed(6) : r.px < 1 ? r.px.toFixed(4) : r.px.toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-right text-xs font-bold font-num ${up ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
                      {up ? "+" : ""}{(r.change * 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-[var(--color-text-dim)] font-num hidden sm:table-cell">
                      {r.vol24h ? `$${(r.vol24h / 1e6).toFixed(0)}M` : "—"}
                    </td>
                    <td className={`px-3 py-3 text-right text-xs font-num font-semibold ${
                      r.rsi && r.rsi < 30 ? "text-[var(--color-up)]"
                      : r.rsi && r.rsi > 70 ? "text-[var(--color-down)]"
                      : "text-[var(--color-text-dim)]"
                    }`}>
                      {r.rsi?.toFixed(0) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="flex justify-end">
                        <MiniSparkline change={r.change} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context info */}
      <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-muted)] flex-wrap px-1">
        {tab === "perp"    && <span>⚡ Perpetual — funding rate 8 saatte bir</span>}
        {tab === "futures" && <span>📅 Delivery — vade sonunda fiziki teslim</span>}
        {tab === "margin"  && <span>⚖️ Çapraz marjin — teminat paylaşımlı</span>}
        {tab === "spot"    && (
          <>
            <span className="text-[var(--color-up)]">● RSI &lt; 30 Aşırı satım</span>
            <span className="text-[var(--color-down)]">● RSI &gt; 70 Aşırı alım</span>
          </>
        )}
      </div>

      {/* Modal */}
      {modalData && (
        <CoinModal
          {...modalData}
          onClose={() => setModal(null)}
          onTrade={() => {
            navigate(`/trade?sym=${modalData.sym}`);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
