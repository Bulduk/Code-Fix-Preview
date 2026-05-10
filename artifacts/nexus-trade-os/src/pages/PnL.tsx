import { useEffect, useState } from "react";
import { api, PnLSnapshot } from "@/lib/api";
import { useStore } from "@/lib/store";
import { TrendingUp, TrendingDown, Download, Trash2 } from "lucide-react";

export default function PnL() {
  const token = useStore((s) => s.token);
  const livePnL = useStore((s) => s.pnl);
  const [rows, setRows] = useState<PnLSnapshot[]>([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!token) return;
    api.getPnLSnapshots().then(setRows);
  };

  useEffect(() => { load(); }, [token]);

  const exportFile = (fmt: "csv" | "json") => {
    if (fmt === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "pnl.json"; a.click();
    } else {
      const header = "ts,equity,realized,unrealized";
      const lines = rows.map((r) => `${r.ts},${r.equity},${r.realized},${r.unrealized}`);
      const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "pnl.csv"; a.click();
    }
  };

  const purge = async () => {
    if (!confirm(`${retentionDays} günden eski PnL kayıtları silinecek. Onayla?`)) return;
    setLoading(true);
    const before = Date.now() - retentionDays * 86400000;
    await api.purgePnL(before);
    await load();
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-text">PnL</h1>

      {livePnL && (
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Equity", val: livePnL.equity },
            { label: "Realized", val: livePnL.realized },
            { label: "Unrealized", val: livePnL.unrealized },
          ].map(({ label, val }) => (
            <div key={label} className="bg-bg-elev border border-line rounded-xl p-3">
              <div className="text-text-dim text-xs mb-1">{label}</div>
              <div className={`text-base font-mono font-semibold flex items-center gap-1 ${val >= 0 ? "text-up" : "text-down"}`}>
                {val >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                ${Math.abs(val).toFixed(2)}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="bg-bg-elev border border-line rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <button onClick={() => exportFile("csv")} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-soft text-sm text-text hover:bg-line transition">
          <Download size={13} /> CSV
        </button>
        <button onClick={() => exportFile("json")} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-soft text-sm text-text hover:bg-line transition">
          <Download size={13} /> JSON
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-text-dim text-xs">Sakla (gün)</span>
          <input
            type="number" min={1} value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="w-16 bg-bg-soft px-2 py-1 rounded text-sm text-text outline-none"
          />
          <button
            onClick={purge}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-down/80 text-[#0b0e11] text-sm disabled:opacity-60"
          >
            <Trash2 size={12} /> Temizle
          </button>
        </div>
      </div>

      <div className="bg-bg-elev border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-text-dim">
            <tr>
              <th className="text-left px-3 py-2">Zaman</th>
              <th className="text-right px-3 py-2">Equity</th>
              <th className="text-right px-3 py-2">Realized</th>
              <th className="text-right px-3 py-2">Unrealized</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line hover:bg-bg-soft">
                <td className="px-3 py-1.5 font-mono text-xs text-text-dim">
                  {new Date(r.ts).toLocaleDateString("tr-TR")}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">${(+r.equity).toFixed(2)}</td>
                <td className={`px-3 py-1.5 text-right font-mono ${r.realized >= 0 ? "text-up" : "text-down"}`}>
                  {r.realized >= 0 ? "+" : ""}{(+r.realized).toFixed(2)}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${r.unrealized >= 0 ? "text-up" : "text-down"}`}>
                  {r.unrealized >= 0 ? "+" : ""}{(+r.unrealized).toFixed(2)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-text-dim">Kayıt yok</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
