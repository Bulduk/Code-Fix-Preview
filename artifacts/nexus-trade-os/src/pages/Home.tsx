import { useStore } from "@/lib/store";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

export default function Home() {
  const { pnl, signals, ticks } = useStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Dashboard</h1>
        <div className="flex items-center gap-1.5 text-xs text-up">
          <span className="w-2 h-2 rounded-full bg-up animate-pulse" />
          Canlı
        </div>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <MetricCard title="Equity" value={pnl?.equity ?? 0} prefix="$" />
        <MetricCard title="Realized" value={pnl?.realized ?? 0} prefix="$" />
        <MetricCard title="Unrealized" value={pnl?.unrealized ?? 0} prefix="$" />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-bg-elev border border-line rounded-xl p-3">
          <div className="text-text-dim text-xs mb-2 flex items-center gap-1">
            <Activity size={12} /> Canlı Sinyaller
          </div>
          <ul className="divide-y divide-line max-h-[38vh] overflow-auto">
            {signals.slice(0, 40).map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-text">{s.strategy}</span>
                  <span className="text-text-dim text-xs ml-1">· {s.ex}:{s.sym}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-dim">{(s.strength * 100).toFixed(0)}%</span>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      s.side === "buy" ? "bg-up/20 text-up" : "bg-down/20 text-down"
                    }`}
                  >
                    {s.side.toUpperCase()}
                  </span>
                </div>
              </li>
            ))}
            {signals.length === 0 && (
              <li className="py-8 text-text-dim text-sm text-center">
                Sinyal bekleniyor...
              </li>
            )}
          </ul>
        </div>

        <div className="bg-bg-elev border border-line rounded-xl p-3">
          <div className="text-text-dim text-xs mb-2">Tick Akışı</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ticks)
              .slice(0, 12)
              .map(([k, v]) => (
                <TickCell key={k} label={k} tick={v} />
              ))}
            {Object.keys(ticks).length === 0 && (
              <div className="col-span-2 py-8 text-text-dim text-sm text-center">
                Veri bekleniyor...
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value, prefix = "" }: { title: string; value: number; prefix?: string }) {
  const positive = value >= 0;
  return (
    <div className="bg-bg-elev border border-line rounded-xl p-3">
      <div className="text-text-dim text-xs mb-1 flex items-center gap-1">
        {positive ? <TrendingUp size={11} className="text-up" /> : <TrendingDown size={11} className="text-down" />}
        {title}
      </div>
      <div className={`text-lg font-mono font-semibold ${positive ? "text-up" : "text-down"}`}>
        {prefix}{Math.abs(value).toFixed(2)}
      </div>
    </div>
  );
}

function TickCell({ label, tick }: { label: string; tick: { px: number; change?: number } }) {
  const up = (tick.change ?? 0) >= 0;
  return (
    <div className="bg-bg-soft rounded px-2 py-1.5 flex justify-between items-center">
      <span className="text-xs text-text-dim truncate max-w-[60%]">{label.split(":")[1] ?? label}</span>
      <div className="text-right">
        <div className={`text-xs font-mono font-medium ${up ? "text-up" : "text-down"}`}>
          {tick.px < 1 ? tick.px.toFixed(4) : tick.px.toFixed(2)}
        </div>
        {tick.change !== undefined && (
          <div className={`text-[10px] ${up ? "text-up" : "text-down"}`}>
            {up ? "+" : ""}{(tick.change * 100).toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}
