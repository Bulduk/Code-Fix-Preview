import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { ArrowUpRight, ArrowDownRight, Search, Wifi } from "lucide-react";

type Category   = "all" | "okx" | "major" | "layer2" | "defi" | "meme";
type MarketType = "all" | "spot" | "perp" | "futures" | "margin";

const CATS: { id: Category; label: string }[] = [
  { id: "all",    label: "Tümü"     },
  { id: "okx",    label: "OKX"      },
  { id: "major",  label: "Majörler" },
  { id: "layer2", label: "Layer 2"  },
  { id: "defi",   label: "DeFi"     },
  { id: "meme",   label: "Meme"     },
];

const MKT_TYPES: { id: MarketType; label: string; color: string }[] = [
  { id: "all",     label: "Tümü",    color: "" },
  { id: "spot",    label: "Spot",    color: "bg-sky-50 text-sky-700 border-sky-200"     },
  { id: "perp",    label: "Perp",    color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "futures", label: "Futures", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "margin",  label: "Marjin",  color: "bg-rose-50 text-rose-700 border-rose-200"  },
];

const SYM_CATS: Record<string, Category[]> = {
  BTCUSDT:    ["major"],  ETHUSDT:  ["major","defi"],
  SOLUSDT:    ["major"],  BNBUSDT:  ["major"],
  XRPUSDT:    ["major"],  ADAUSDT:  ["major"],
  DOGEUSDT:   ["meme"],   SHIBUSDT: ["meme"],
  LINKUSDT:   ["defi"],   AAVEUSDT: ["defi"],
  UNIUSDT:    ["defi"],   MATICUSDT:["layer2"],
  ARBUSDT:    ["layer2"], OPUSDT:   ["layer2"],
};

function guessMarket(sym: string): MarketType {
  if (sym.includes("-MARGIN"))  return "margin";
  if (sym.includes("-PERP"))    return "perp";
  if (sym.match(/-\d{6}$/))    return "futures";
  return "spot";
}

function baseSym(sym: string) {
  return sym.replace("-PERP","").replace("-MARGIN","").replace(/-\d{6}$/,"");
}

function rsiColor(rsi?: number) {
  if (!rsi) return "text-text-dim";
  return rsi >= 70 ? "text-down" : rsi <= 30 ? "text-up" : "text-text-dim";
}

type SortKey = "sym" | "px" | "change" | "vol" | "rsi";

export default function Markets() {
  const { ticks, signals, okxConnected } = useStore();
  const [, navigate]   = useLocation();
  const [cat,   setCat]   = useState<Category>("all");
  const [mkt,   setMkt]   = useState<MarketType>("all");
  const [search,setSearch] = useState("");
  const [sort,  setSort]   = useState<SortKey>("vol");
  const [asc,   setAsc]    = useState(false);

  const rows = useMemo(() => {
    let list = Object.entries(ticks).map(([key, v]) => {
      const [ex, sym] = key.split(":");
      const market    = guessMarket(sym);
      const base      = baseSym(sym);
      const sig       = signals.find((s) => s.ex === ex && s.sym === sym);
      return { key, ex, sym, base, market, ...v, sig };
    });

    if (cat !== "all") {
      if (cat === "okx") list = list.filter((r) => r.ex === "okx");
      else list = list.filter((r) => (SYM_CATS[baseSym(r.sym)] ?? []).includes(cat));
    }
    if (mkt !== "all") list = list.filter((r) => r.market === mkt);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.sym.toLowerCase().includes(q) || r.ex.includes(q));
    }

    list.sort((a, b) => {
      if (sort === "sym") return asc ? a.sym.localeCompare(b.sym) : b.sym.localeCompare(a.sym);
      const va = sort === "px" ? a.px : sort === "change" ? (a.change ?? 0) : sort === "vol" ? (a.vol24h ?? 0) : (a.rsi ?? 50);
      const vb = sort === "px" ? b.px : sort === "change" ? (b.change ?? 0) : sort === "vol" ? (b.vol24h ?? 0) : (b.rsi ?? 50);
      return asc ? va - vb : vb - va;
    });

    return list;
  }, [ticks, signals, cat, mkt, search, sort, asc]);

  const toggleSort = (k: SortKey) => { if (sort === k) setAsc((v) => !v); else { setSort(k); setAsc(false); } };
  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)}
      className={`flex items-center gap-0.5 hover:text-text transition text-xs ${sort === k ? "text-accent font-semibold" : "text-text-dim"}`}>
      {label}{sort === k && <span className="text-[9px]">{asc ? "↑" : "↓"}</span>}
    </button>
  );

  const mktCounts = useMemo(() => {
    const cnt: Record<string, number> = { all: 0, spot: 0, perp: 0, futures: 0, margin: 0 };
    Object.keys(ticks).forEach((key) => {
      const sym = key.split(":")[1];
      const m   = guessMarket(sym);
      cnt[m]++;
      cnt.all++;
    });
    return cnt;
  }, [ticks]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-text">Piyasalar</h1>
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <span>{rows.length} çift</span>
            {okxConnected && (
              <span className="flex items-center gap-1 text-up">
                <Wifi size={10} /> OKX WS Canlı
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="BTC, ETH, SOL..."
            className="bg-bg-elev border border-line rounded-xl pl-8 pr-3 py-2 text-sm text-text outline-none focus:border-accent w-44" />
        </div>
      </div>

      {/* Market Type Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {MKT_TYPES.map((m) => (
          <button key={m.id} onClick={() => setMkt(m.id)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition border ${
              mkt === m.id
                ? m.id === "all" ? "bg-text text-bg border-transparent" : `${m.color} border-transparent shadow-sm`
                : "bg-bg-elev border-line text-text-dim hover:text-text hover:bg-bg-soft"
            }`}>
            {m.label}
            {mktCounts[m.id] > 0 && (
              <span className="ml-1 opacity-60 text-[10px]">{mktCounts[m.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {CATS.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition border ${
              cat === c.id
                ? "bg-accent text-white border-transparent"
                : "bg-bg-elev border-line text-text-dim hover:text-text hover:bg-bg-soft"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-line bg-bg-soft">
                <th className="text-left px-4 py-2.5"><SortBtn k="sym" label="Sembol" /></th>
                <th className="text-left px-2 py-2.5 text-xs text-text-dim font-medium">Borsa</th>
                <th className="text-left px-2 py-2.5 text-xs text-text-dim font-medium">Tip</th>
                <th className="text-right px-2 py-2.5"><SortBtn k="px" label="Fiyat" /></th>
                <th className="text-right px-2 py-2.5"><SortBtn k="change" label="24h %" /></th>
                <th className="text-right px-2 py-2.5"><SortBtn k="vol" label="Hacim" /></th>
                <th className="text-right px-2 py-2.5"><SortBtn k="rsi" label="RSI" /></th>
                <th className="text-right px-4 py-2.5 text-xs text-text-dim font-medium">Sinyal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-text-dim text-sm">
                  {search ? "Sonuç bulunamadı" : "Piyasa verisi bekleniyor..."}
                </td></tr>
              )}
              {rows.map((r) => {
                const up  = (r.change ?? 0) >= 0;
                const mktInfo = MKT_TYPES.find((m) => m.id === r.market);
                return (
                  <tr key={r.key} onClick={() => navigate(`/trade?ex=${r.ex}&sym=${r.sym}`)}
                    className="hover:bg-bg-soft cursor-pointer transition">
                    {/* Symbol */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-bg-soft border border-line grid place-items-center text-[9px] font-bold text-text-dim shrink-0">
                          {r.base.slice(0, 2)}
                        </div>
                        <span className="text-sm font-semibold text-text">
                          {r.base}<span className="text-text-dim font-normal text-xs">/USDT</span>
                          {r.market !== "spot" && (
                            <span className="text-[9px] text-text-dim ml-1 opacity-70">
                              {r.sym.includes("-PERP") ? "PERP" : r.sym.match(/-\d{6}$/) ? "FUT" : r.sym.includes("-MARGIN") ? "MGN" : ""}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    {/* Exchange */}
                    <td className="px-2 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        r.ex === "okx" ? "bg-blue-50 text-blue-700" :
                        r.ex === "binance" ? "bg-amber-50 text-amber-700" : "bg-purple-50 text-purple-700"
                      }`}>{r.ex}</span>
                    </td>
                    {/* Market type */}
                    <td className="px-2 py-2.5">
                      {mktInfo && mktInfo.id !== "all" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${mktInfo.color}`}>
                          {mktInfo.label}
                        </span>
                      )}
                    </td>
                    {/* Price */}
                    <td className="px-2 py-2.5 text-right font-mono font-semibold text-text text-sm">
                      {r.px < 0.01 ? r.px.toFixed(6) : r.px < 1 ? r.px.toFixed(4) : r.px.toFixed(2)}
                    </td>
                    {/* Change */}
                    <td className={`px-2 py-2.5 text-right text-xs font-semibold ${up ? "text-up" : "text-down"}`}>
                      <span className="flex items-center justify-end gap-0.5">
                        {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {up ? "+" : ""}{((r.change ?? 0) * 100).toFixed(2)}%
                      </span>
                    </td>
                    {/* Volume */}
                    <td className="px-2 py-2.5 text-right text-xs text-text-dim">
                      {r.vol24h ? `$${(r.vol24h / 1e6).toFixed(0)}M` : "—"}
                    </td>
                    {/* RSI */}
                    <td className={`px-2 py-2.5 text-right text-xs font-mono font-medium ${rsiColor(r.rsi)}`}>
                      {r.rsi?.toFixed(0) ?? "—"}
                    </td>
                    {/* Signal */}
                    <td className="px-4 py-2.5 text-right">
                      {r.sig ? (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          r.sig.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {r.sig.side.toUpperCase()} {(r.sig.strength * 100).toFixed(0)}%
                        </span>
                      ) : <span className="text-[10px] text-text-dim">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-text-dim px-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-100" /> RSI&lt;30 Aşırı Satım</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-100" /> RSI&gt;70 Aşırı Alım</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-100" /> PERP = Sürekli Vadeli</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-100" /> FUT = Vadeli İşlem</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-100" /> MGN = Marjin</span>
      </div>
    </div>
  );
}
