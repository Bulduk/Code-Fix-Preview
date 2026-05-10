import { useMemo } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function Markets() {
  const { ticks } = useStore();
  const [, navigate] = useLocation();

  const rows = useMemo(
    () =>
      Object.entries(ticks)
        .map(([key, v]) => {
          const [ex, sym] = key.split(":");
          return { key, ex, sym, ...v };
        })
        .sort((a, b) => a.key.localeCompare(b.key)),
    [ticks]
  );

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-text">Piyasalar</h1>
      <div className="bg-bg-elev border border-line rounded-xl overflow-hidden">
        <div className="px-3 py-2 text-xs text-text-dim grid grid-cols-4 border-b border-line bg-bg-soft">
          <span>Sembol</span>
          <span>Borsa</span>
          <span className="text-right">Fiyat</span>
          <span className="text-right">Değişim</span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const up = (r.change ?? 0) >= 0;
            return (
              <li
                key={r.key}
                className="grid grid-cols-4 px-3 py-2.5 text-sm items-center hover:bg-bg-soft cursor-pointer transition"
                onClick={() => navigate(`/trade?ex=${r.ex}&sym=${r.sym}`)}
              >
                <span className="font-medium text-text">{r.sym}</span>
                <span className="text-xs text-text-dim">{r.ex}</span>
                <span className="text-right font-mono text-text">
                  {r.px < 1 ? r.px.toFixed(4) : r.px.toFixed(2)}
                </span>
                <span className={`text-right flex items-center justify-end gap-0.5 text-xs font-medium ${up ? "text-up" : "text-down"}`}>
                  {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {up ? "+" : ""}{((r.change ?? 0) * 100).toFixed(2)}%
                </span>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-3 py-8 text-text-dim text-sm text-center">
              Piyasa verisi bekleniyor...
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
