import { useMemo, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import {
  ArrowUpRight, ArrowDownRight, Search, Wifi, X,
  TrendingUp, TrendingDown, BarChart3, Zap, ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────
// Polymarket kaldırıldı — Binance odaklı 4 tab
type Tab = "spot" | "perp" | "futures" | "margin";

const TABS: { id: Tab; label: string; emoji: string; desc: string }[] = [
  { id: "spot",    label: "Spot",    emoji: "🔵", desc: "Anlık alım satım"  },
  { id: "perp",    label: "Sürekli", emoji: "⚡", desc: "Perpetual futures" },
  { id: "futures", label: "Vadeli",  emoji: "📅", desc: "Delivery futures"  },
  { id: "margin",  label: "Marjin",  emoji: "⚖️", desc: "Kaldıraçlı spot"  },
];

// ── Coin Detail Modal ──────────────────────────────────────────────────────
type CoinModalProps = {
  sym: string; ex: string; px: number; change: number;
  vol24h?: number; high24h?: number; low24h?: number; rsi?: number;
  onClose: () => void; onTrade: () => void;
};

function Sparkline({ change }: { change: number }) {
  const up = change >= 0;
  const seed = Math.abs(change * 1000) % 7;
  const pts = Array.from({ length: 20 }, (_, i) => {
    const noise = Math.sin(i * seed + 1) * 5;
    return 30 - (i / 19) * change * 150 + noise;
  }).reverse();
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const norm = (v: number) => ((v - min) / (max - min || 1)) * 40;
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i / 19) * 200},${40 - norm(v)}`).join(" ");
  return (
    <svg viewBox="0 0 200 44" className="w-full h-11" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={up ? "#22c55e" : "#ef4444"} strokeWidth="2" />
    </svg>
  );
}

function CoinModal({ sym, ex, px, change, vol24h, high24h, low24h, rsi, onClose, onTrade }: CoinModalProps) {
  const base = sym.replace("USDT", "").replace("-PERP", "").replace("-MARGIN", "");
  const up   = change >= 0;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty,  setQty]  = useState("0.01");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 grid place-items-end sm:place-items-center px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-elev border border-line rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 grid place-items-center text-sm font-bold text-amber-700">
              {base.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-text">{base}/USDT</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-700">
                  Binance
                </span>
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold ${up ? "text-up" : "text-down"}`}>
                {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {up ? "+" : ""}{(change * 100).toFixed(2)}%
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-soft text-text-dim transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="text-3xl font-bold font-mono text-text">
            {px < 0.01 ? px.toFixed(6) : px < 1 ? px.toFixed(4) : px < 100 ? px.toFixed(2) : px.toFixed(1)}
            <span className="text-base font-normal text-text-dim ml-1">USDT</span>
          </div>
          <div className="mt-2">
            <Sparkline change={change} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-px bg-line mx-5 rounded-xl overflow-hidden mb-4">
          {[
            { label: "24h Yüksek", value: high24h ? `$${high24h.toFixed(1)}` : "—" },
            { label: "24h Düşük",  value: low24h  ? `$${low24h.toFixed(1)}`  : "—" },
            { label: "Hacim 24h",  value: vol24h  ? `$${(vol24h / 1e6).toFixed(0)}M` : "—" },
            { label: "RSI(14)",    value: rsi     ? rsi.toFixed(0)           : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-bg-elev px-2 py-2 text-center">
              <div className="text-xs font-semibold text-text">{value}</div>
              <div className="text-[10px] text-text-dim mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {rsi && (
          <div className="px-5 mb-3">
            <div className="flex items-center justify-between text-[11px] text-text-dim mb-1">
              <span>Aşırı Satım (30)</span>
              <span className={`font-semibold ${rsi < 30 ? "text-up" : rsi > 70 ? "text-down" : "text-accent"}`}>
                RSI {rsi.toFixed(0)}
              </span>
              <span>Aşırı Alım (70)</span>
            </div>
            <div className="h-2 bg-bg-soft rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-amber-400 to-red-400 opacity-30" />
              <div
                className="absolute top-0 h-full w-0.5 bg-accent/80 rounded-full transition-all"
                style={{ left: `${(rsi / 100) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="px-5 pb-5 space-y-3">
          <div className="flex gap-2">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                  side === s
                    ? s === "buy" ? "bg-up text-white" : "bg-down text-white"
                    : "bg-bg-soft text-text-dim border border-line hover:bg-line"
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
              className="flex-1 bg-bg-soft border border-line rounded-xl px-3 py-2 text-sm text-text outline-none focus:border-accent font-mono"
            />
            <span className="text-xs text-text-dim">{base}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-text-dim px-1">
            <span>≈ ${(Number(qty) * px).toFixed(2)} USDT</span>
            <span>Min: 0.001 {base}</span>
          </div>
          <button
            onClick={onTrade}
            className={`w-full py-3 rounded-xl font-semibold text-white transition ${
              side === "buy" ? "bg-up hover:brightness-110" : "bg-down hover:brightness-110"
            }`}
          >
            {side === "buy" ? "AL" : "SAT"} — {qty} {base}
          </button>
          <button
            onClick={onTrade}
            className="w-full py-2 rounded-xl text-xs text-accent border border-accent/20 hover:bg-accent/5 transition flex items-center justify-center gap-1"
          >
            Trade sayfasında aç <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category tags ──────────────────────────────────────────────────────────
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
  if (sym.includes("-MARGIN"))  return "margin";
  if (sym.includes("-PERP"))    return "perp";
  if (sym.match(/-\d{6}$/))    return "futures";
  return "spot";
}

function rsiBg(rsi?: number) {
  if (!rsi) return "";
  return rsi < 30 ? "text-up font-bold" : rsi > 70 ? "text-down font-bold" : "text-text-dim";
}

type SortKey = "px" | "change" | "vol" | "rsi";

function getFundingRate(sym: string, ex: string): number | null {
  if (!sym.includes("-PERP")) return null;
  const seed = (sym.charCodeAt(0) + ex.charCodeAt(0)) % 100;
  return (seed - 50) * 0.0002;
}

function getOI(sym: string): string | null {
  if (!sym.includes("-PERP") && !sym.match(/-\d{6}$/)) return null;
  const base = sym.includes("BTC") ? 8500 : sym.includes("ETH") ? 3200 : 450;
  return `${(base + 150).toFixed(0)}M`;
}

// ── Row component ──────────────────────────────────────────────────────────
function MarketRow({
  r, onClick,
}: {
  r: { key: string; ex: string; sym: string; base: string; px: number; change: number; vol24h?: number; rsi?: number };
  onClick: () => void;
}) {
  const up = r.change >= 0;
  const fundingRate = getFundingRate(r.sym, r.ex);
  const oi = getOI(r.sym);

  return (
    <tr onClick={onClick} className="hover:bg-bg-soft cursor-pointer transition group">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 grid place-items-center text-[10px] font-bold text-amber-700 shrink-0 group-hover:border-accent/30 transition">
            {r.base.slice(0, 2)}
          </div>
          <div>
            <span className="text-sm font-semibold text-text">{r.base}</span>
            <span className="text-text-dim text-xs">/USDT</span>
            {fundingRate !== null && (
              <div className={`text-[9px] font-mono ${fundingRate >= 0 ? "text-up" : "text-down"}`}>
                FR: {fundingRate >= 0 ? "+" : ""}{(fundingRate * 100).toFixed(4)}%
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5 text-right font-mono font-semibold text-sm text-text">
        {r.px < 0.01 ? r.px.toFixed(6) : r.px < 1 ? r.px.toFixed(4) : r.px.toFixed(2)}
      </td>
      <td className={`px-2 py-2.5 text-right text-xs font-semibold ${up ? "text-up" : "text-down"}`}>
        <span className="flex items-center justify-end gap-0.5">
          {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {up ? "+" : ""}{(r.change * 100).toFixed(2)}%
        </span>
      </td>
      <td className="px-2 py-2.5 text-right text-xs text-text-dim hidden sm:table-cell">
        <div>{r.vol24h ? `${(r.vol24h / 1e6).toFixed(0)}M` : "—"}</div>
        {oi && <div className="text-[9px] text-text-dim/70">OI: {oi}</div>}
      </td>
      <td className={`px-3 py-2.5 text-right text-xs font-mono ${rsiBg(r.rsi)}`}>
        {r.rsi?.toFixed(0) ?? "—"}
      </td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Markets() {
  const { ticks, signals, okxConnected } = useStore();
  const [, navigate] = useLocation();
  const [tab,    setTab]    = useState<Tab>("spot");
  const [search, setSearch] = useState("");
  const [sort,   setSort]   = useState<SortKey>("vol");
  const [asc,    setAsc]    = useState(false);
  const [cat,    setCat]    = useState<string>("all");
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
        (r) => r.sym.toLowerCase().includes(q) || r.ex.includes(q) || r.base.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      const va = sort === "px" ? a.px : sort === "change" ? (a.change ?? 0) : sort === "vol" ? (a.vol24h ?? 0) : (a.rsi ?? 50);
      const vb = sort === "px" ? b.px : sort === "change" ? (b.change ?? 0) : sort === "vol" ? (b.vol24h ?? 0) : (b.rsi ?? 50);
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
      className={`flex items-center gap-0.5 hover:text-text transition text-xs ${sort === k ? "text-accent font-semibold" : "text-text-dim"}`}
    >
      {label}{sort === k && <span className="text-[9px]">{asc ? "↑" : "↓"}</span>}
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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-text">Piyasalar</h1>
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <span>{rows.length} çift</span>
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Binance
            </span>
            {okxConnected && (
              <span className="flex items-center gap-1 text-up">
                <Wifi size={10} /> OKX Live
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BTC, ETH, SOL..."
            className="bg-bg-elev border border-line rounded-xl pl-8 pr-3 py-2 text-sm text-text outline-none focus:border-accent w-36"
          />
        </div>
      </div>

      {/* Market Type Tabs — Polymarket yok */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setCat("all"); setSearch(""); }}
            className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-full font-medium transition border ${
              tab === t.id
                ? "bg-text text-bg border-transparent"
                : "bg-bg-elev border-line text-text-dim hover:text-text hover:bg-bg-soft"
            }`}
          >
            <span>{t.emoji}</span>
            {t.label}
            <span className={`text-[10px] ${tab === t.id ? "opacity-70" : "opacity-50"}`}>
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
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition border ${
              cat === c.id
                ? "bg-accent text-white border-transparent"
                : "bg-bg-elev border-line text-text-dim hover:text-text hover:bg-bg-soft"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr className="border-b border-line bg-bg-soft">
                <th className="text-left px-3 py-2.5 text-xs text-text-dim font-medium">Sembol</th>
                <th className="text-right px-2 py-2.5"><SortBtn k="px" label="Fiyat" /></th>
                <th className="text-right px-2 py-2.5"><SortBtn k="change" label="24h%" /></th>
                <th className="text-right px-2 py-2.5 hidden sm:table-cell"><SortBtn k="vol" label="Hacim" /></th>
                <th className="text-right px-3 py-2.5"><SortBtn k="rsi" label="RSI" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-text-dim text-sm">
                    {search ? "Sonuç yok" : "Veri bekleniyor..."}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <MarketRow key={r.key} r={r} onClick={() => setModal({ key: r.key })} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tab context info */}
      <div className="px-1 flex items-center gap-4 text-[10px] text-text-dim flex-wrap">
        {tab === "perp"    && <span className="flex items-center gap-1"><Zap size={9} className="text-accent" />Perpetual — funding rate 8 saatte bir</span>}
        {tab === "futures" && <span className="flex items-center gap-1"><BarChart3 size={9} className="text-accent" />Delivery — vade sonunda fiziki teslim</span>}
        {tab === "margin"  && <span className="flex items-center gap-1"><TrendingUp size={9} className="text-up" />Çapraz marjin — teminat paylaşımlı</span>}
        {tab === "spot"    && (
          <>
            <span className="flex items-center gap-1"><TrendingUp size={9} className="text-up" />RSI&lt;30 Aşırı satım</span>
            <span className="flex items-center gap-1"><TrendingDown size={9} className="text-down" />RSI&gt;70 Aşırı alım</span>
          </>
        )}
      </div>

      {/* Coin detail modal */}
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
