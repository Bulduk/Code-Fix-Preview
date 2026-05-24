import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { TrendingUp, TrendingDown, RefreshCw, X, Loader2, Shield } from "lucide-react";

type FuturesPosition = {
  symbol: string; side: "long" | "short"; size: number;
  entryPrice: number; markPrice: number; liquidationPrice: number;
  leverage: number; unrealizedPnl: number; realizedPnl: number;
  marginType: string; notional: number; percentage: number;
  exchangeId: string;
};

export default function Positions() {
  const token = useStore((s) => s.token);
  const [positions, setPositions] = useState<FuturesPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/futures/positions", {
        headers: { Authorization: `Bearer ${localStorage.getItem("tok")}` },
      });
      const data = await res.json() as FuturesPosition[];
      setPositions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const closePosition = async (pos: FuturesPosition) => {
    if (!confirm(`${pos.symbol} pozisyonunu kapat?`)) return;
    setClosing(`${pos.exchangeId}:${pos.symbol}`);
    try {
      await fetch(`/api/futures/${pos.exchangeId}/close-position`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("tok")}`,
        },
        body: JSON.stringify({ symbol: pos.symbol }),
      });
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setClosing(null);
    }
  };

  const totalUnrealized = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const totalNotional = positions.reduce((s, p) => s + p.notional, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Pozisyonlar</h1>
          <p className="text-xs text-text-dim">Binance Futures · Gerçek zamanlı</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line text-sm text-text-dim hover:bg-bg-soft transition">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Yenile
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-elev border border-line rounded-xl p-3 shadow-card">
          <div className="text-xs text-text-dim">Açık Pozisyon</div>
          <div className="text-xl font-bold text-text mt-0.5">{positions.length}</div>
        </div>
        <div className={`rounded-xl p-3 border shadow-card ${totalUnrealized >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="text-xs text-text-dim">Gerçekleşmemiş K/Z</div>
          <div className={`text-xl font-bold font-mono mt-0.5 ${totalUnrealized >= 0 ? "text-up" : "text-down"}`}>
            {totalUnrealized >= 0 ? "+" : ""}${totalUnrealized.toFixed(2)}
          </div>
        </div>
        <div className="bg-bg-elev border border-line rounded-xl p-3 shadow-card">
          <div className="text-xs text-text-dim">Toplam Notional</div>
          <div className="text-xl font-bold font-mono text-text mt-0.5">${totalNotional.toFixed(0)}</div>
        </div>
      </div>

      {error && <div className="text-sm text-down bg-down/10 rounded-xl px-3 py-2">{error}</div>}

      {/* Positions list */}
      <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
        {positions.length === 0 ? (
          <div className="px-4 py-12 text-center text-text-dim text-sm">
            {loading ? "Yükleniyor..." : "Açık pozisyon yok"}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {positions.map((pos) => {
              const key = `${pos.exchangeId}:${pos.symbol}`;
              const isLong = pos.side === "long";
              const pnlPct = pos.percentage;
              const isClosing = closing === key;

              return (
                <div key={key} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl grid place-items-center text-white text-xs font-bold ${isLong ? "bg-up" : "bg-down"}`}>
                        {isLong ? "L" : "S"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-text">{pos.symbol}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isLong ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {pos.side.toUpperCase()}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-soft text-text-dim border border-line">
                            {pos.leverage}x
                          </span>
                          <span className="text-[10px] text-text-dim capitalize">{pos.marginType}</span>
                        </div>
                        <div className="text-xs text-text-dim mt-0.5">
                          {pos.size} @ ${pos.entryPrice.toFixed(2)} · Notional: ${pos.notional.toFixed(0)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`text-sm font-mono font-bold ${pos.unrealizedPnl >= 0 ? "text-up" : "text-down"}`}>
                          {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toFixed(2)}
                        </div>
                        <div className={`text-xs ${pnlPct >= 0 ? "text-up" : "text-down"}`}>
                          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                        </div>
                      </div>
                      <button
                        onClick={() => closePosition(pos)}
                        disabled={isClosing}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-text-dim hover:text-down transition disabled:opacity-50"
                        title="Pozisyonu kapat"
                      >
                        {isClosing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Price info */}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-text-dim">Mark: </span>
                      <span className="font-mono text-text">${pos.markPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-text-dim">Liq: </span>
                      <span className="font-mono text-down">${pos.liquidationPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-text-dim">Entry: </span>
                      <span className="font-mono text-text">${pos.entryPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Liquidation distance */}
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-text-dim mb-1">
                      <span>Entry</span>
                      <span className="text-down">Liq: ${pos.liquidationPrice.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-bg-soft rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLong ? "bg-up" : "bg-down"}`}
                        style={{
                          width: `${Math.min(100, Math.max(0,
                            isLong
                              ? ((pos.markPrice - pos.liquidationPrice) / (pos.entryPrice - pos.liquidationPrice)) * 100
                              : ((pos.liquidationPrice - pos.markPrice) / (pos.liquidationPrice - pos.entryPrice)) * 100
                          ))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
