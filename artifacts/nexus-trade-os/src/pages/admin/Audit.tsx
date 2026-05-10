import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, AuditEntry } from "@/lib/api";
import { RefreshCw } from "lucide-react";

export default function Audit() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const data = await api.getAudit().catch(() => []);
    setList(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const ACTION_COLORS: Record<string, string> = {
    LOGIN: "text-accent",
    ORDER_PLACE: "text-up",
    STRATEGY_TOGGLE: "text-blue-400",
    EXCHANGE_ADD: "text-purple-400",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Audit Log</h1>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-elev border border-line text-sm text-text-dim hover:text-text transition">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Yenile
        </button>
      </div>
      <div className="bg-bg-elev border border-line rounded-xl divide-y divide-line">
        {list.map((a) => (
          <div key={a.id} className="px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-mono font-medium ${ACTION_COLORS[a.action] ?? "text-text"}`}>
                {a.action}
              </span>
              <span className="text-[10px] text-text-dim font-mono">
                {new Date(a.ts).toLocaleString("tr-TR")}
              </span>
            </div>
            <div className="text-xs text-text-dim mt-0.5">{a.target}</div>
            <div className="text-[10px] text-text-dim">by {a.actor}</div>
          </div>
        ))}
        {list.length === 0 && <div className="px-3 py-8 text-text-dim text-sm text-center">Kayıt yok</div>}
      </div>
    </div>
  );
}
