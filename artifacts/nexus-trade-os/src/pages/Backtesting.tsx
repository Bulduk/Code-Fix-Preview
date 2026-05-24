import { useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown, Play, Loader2, BarChart3, Target, Shield } from "lucide-react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "LINKUSDT"];
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];
const STRATEGIES = ["ema_trend", "rsi_pullback", "breakout", "scalping", "meanreversion", "momentum"];

type BacktestResult = {
  symbol: string; timeframe: string; startDate: string; endDate: string;
  initialBalance: number; finalBalance: number; totalReturn: number; totalReturnPct: number;
  totalTrades: number; winningTrades: number; losingTrades: number; winRate: number;
  avgWin: number; avgLoss: number; profitFactor: number;
  maxDrawdown: number; maxDrawdownPct: number;
  sharpeRatio: number; sortinoRatio: number; calmarRatio: number;
  equityCurve: Array<{ ts: number; equity: number; drawdown: number }>;
  monthlyReturns: Record<string, number>;
};

function StatCard({ label, value, sub, color = "text-text" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-bg-elev border border-line rounded-xl p-3 shadow-card">
      <div className="text-xs text-text-dim">{label}</div>
      <div className={`text-lg font-bold font-mono mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Backtesting() {
  const token = useStore((s) => s.token);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [strategy, setStrategy] = useState("ema_trend");
  const [initialBalance, setInitialBalance] = useState(10000);
  const [stopLoss, setStopLoss] = useState(2);
  const [takeProfit, setTakeProfit] = useState(4);
  const [riskPerTrade, setRiskPerTrade] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");
  const [walkForward, setWalkForward] = useState(false);

  const run = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const endpoint = walkForward ? "/backtest/walk-forward" : "/backtest/run";
      const res = await fetch(`/api${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("tok")}`,
        },
        body: JSON.stringify({
          symbol, timeframe, strategyKind: strategy,
          initialBalance, stopLossPct: stopLoss,
          takeProfitPct: takeProfit, riskPerTradePct: riskPerTrade,
          limit: 500,
        }),
      });
      const data = await res.json() as BacktestResult;
      if (!res.ok) throw new Error((data as unknown as { error: string }).error);
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const equityMax = result ? Math.max(...result.equityCurve.map((e) => e.equity)) : 0;
  const equityMin = result ? Math.min(...result.equityCurve.map((e) => e.equity)) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-text">Backtesting</h1>
        <p className="text-xs text-text-dim">Historical strategy simulation · Equity curves · Sharpe ratio · Walk-forward</p>
      </div>

      {/* Config */}
      <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-text-dim">Sembol</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none">
              {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-dim">Zaman Dilimi</label>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none">
              {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-dim">Strateji</label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none">
              {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-dim">Başlangıç Bakiye ($)</label>
            <input type="number" value={initialBalance} onChange={(e) => setInitialBalance(Number(e.target.value))}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none" />
          </div>
          <div>
            <label className="text-xs text-text-dim">Stop-Loss (%)</label>
            <input type="number" step="0.1" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none" />
          </div>
          <div>
            <label className="text-xs text-text-dim">Take-Profit (%)</label>
            <input type="number" step="0.1" value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none" />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
            <input type="checkbox" checked={walkForward} onChange={(e) => setWalkForward(e.target.checked)}
              className="accent-amber-500 w-4 h-4" />
            Walk-Forward Analizi
          </label>
          <button onClick={run} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50 ml-auto">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Çalışıyor...</> : <><Play size={14} /> Backtest Başlat</>}
          </button>
        </div>

        {error && <div className="mt-3 text-sm text-down bg-down/10 rounded-xl px-3 py-2">{error}</div>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Toplam Getiri"
              value={`${result.totalReturnPct >= 0 ? "+" : ""}${result.totalReturnPct.toFixed(2)}%`}
              sub={`$${result.totalReturn.toFixed(2)}`}
              color={result.totalReturnPct >= 0 ? "text-up" : "text-down"}
            />
            <StatCard
              label="Win Rate"
              value={`${(result.winRate * 100).toFixed(1)}%`}
              sub={`${result.winningTrades}W / ${result.losingTrades}L`}
              color={result.winRate >= 0.5 ? "text-up" : "text-down"}
            />
            <StatCard
              label="Sharpe Ratio"
              value={result.sharpeRatio.toFixed(2)}
              sub="Yıllıklandırılmış"
              color={result.sharpeRatio >= 1 ? "text-up" : result.sharpeRatio >= 0 ? "text-accent" : "text-down"}
            />
            <StatCard
              label="Max Drawdown"
              value={`-${result.maxDrawdownPct.toFixed(2)}%`}
              sub={`$${result.maxDrawdown.toFixed(2)}`}
              color="text-down"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Toplam İşlem" value={String(result.totalTrades)} />
            <StatCard label="Profit Factor" value={result.profitFactor.toFixed(2)}
              color={result.profitFactor >= 1.5 ? "text-up" : result.profitFactor >= 1 ? "text-accent" : "text-down"} />
            <StatCard label="Sortino Ratio" value={result.sortinoRatio.toFixed(2)} />
            <StatCard label="Calmar Ratio" value={result.calmarRatio.toFixed(2)} />
          </div>

          {/* Equity Curve */}
          <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-accent" />
              <span className="text-sm font-semibold text-text">Equity Curve</span>
              <span className="ml-auto text-xs text-text-dim">
                {result.startDate.slice(0, 10)} → {result.endDate.slice(0, 10)}
              </span>
            </div>
            <div className="relative h-40 bg-bg-soft rounded-xl overflow-hidden">
              <svg viewBox={`0 0 ${result.equityCurve.length} 100`} className="w-full h-full" preserveAspectRatio="none">
                {/* Equity line */}
                <polyline
                  points={result.equityCurve.map((p, i) => {
                    const x = i;
                    const y = 100 - ((p.equity - equityMin) / (equityMax - equityMin || 1)) * 90 - 5;
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="none"
                  stroke={result.totalReturnPct >= 0 ? "#16a34a" : "#dc2626"}
                  strokeWidth="0.5"
                />
                {/* Fill */}
                <polygon
                  points={[
                    ...result.equityCurve.map((p, i) => {
                      const x = i;
                      const y = 100 - ((p.equity - equityMin) / (equityMax - equityMin || 1)) * 90 - 5;
                      return `${x},${y}`;
                    }),
                    `${result.equityCurve.length - 1},100`,
                    `0,100`,
                  ].join(" ")}
                  fill={result.totalReturnPct >= 0 ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)"}
                />
              </svg>
              <div className="absolute top-2 left-3 text-xs font-mono text-text-dim">
                ${equityMax.toFixed(0)}
              </div>
              <div className="absolute bottom-2 left-3 text-xs font-mono text-text-dim">
                ${equityMin.toFixed(0)}
              </div>
            </div>
          </div>

          {/* Monthly Returns */}
          {Object.keys(result.monthlyReturns).length > 0 && (
            <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
              <div className="text-sm font-semibold text-text mb-3">Aylık Getiriler</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.monthlyReturns).sort().map(([month, pnl]) => (
                  <div key={month} className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold ${
                    pnl >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {month}: {pnl >= 0 ? "+" : ""}${pnl.toFixed(0)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
