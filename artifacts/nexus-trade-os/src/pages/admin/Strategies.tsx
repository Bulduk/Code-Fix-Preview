import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Strategy } from "@/lib/api";
import { Plus, ToggleLeft, ToggleRight, Sliders } from "lucide-react";

const KINDS = ["scalping","meanreversion","momentum","breakout","grid","marketmaking","dca","trendfollowing","arbitrage"];

export default function Strategies() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<Strategy[]>([]);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("scalping");
  const [open, setOpen] = useState(false);

  const load = () => { if (token) api.getStrategies().then(setList); };
  useEffect(() => { load(); }, [token]);

  const toggle = async (s: Strategy) => {
    await api.updateStrategy(s.id, { enabled: !s.enabled });
    load();
  };

  const create = async () => {
    if (!newName.trim()) return;
    await api.createStrategy({ name: newName, kind: newKind, enabled: false, allocation: 0, params: {} });
    setNewName(""); setOpen(false); load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Stratejiler</h1>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-[#0b0e11] text-sm font-medium hover:bg-accent/90 transition"
        >
          <Plus size={14} /> Yeni
        </button>
      </div>

      <div className="bg-bg-elev border border-line rounded-xl divide-y divide-line">
        {list.map((s) => (
          <div key={s.id} className="px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bg-soft grid place-items-center">
                <Sliders size={13} className="text-text-dim" />
              </div>
              <div>
                <div className="text-sm font-medium text-text">{s.name}</div>
                <div className="text-xs text-text-dim">{s.kind} · Tahsis: %{s.allocation}</div>
              </div>
            </div>
            <button
              onClick={() => toggle(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition ${
                s.enabled ? "bg-up/20 text-up hover:bg-up/30" : "bg-bg-soft text-text-dim hover:bg-line"
              }`}
            >
              {s.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {s.enabled ? "ON" : "OFF"}
            </button>
          </div>
        ))}
        {list.length === 0 && <div className="px-3 py-8 text-text-dim text-sm text-center">Strateji yok</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center px-4" onClick={() => setOpen(false)}>
          <div className="bg-bg-elev border border-line rounded-xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-text">Yeni Strateji</h2>
            <div>
              <label className="text-xs text-text-dim">Strateji adı</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                     className="w-full bg-bg-soft px-3 py-2 rounded mt-1 text-sm text-text outline-none" placeholder="BTC Scalper" />
            </div>
            <div>
              <label className="text-xs text-text-dim">Tip</label>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value)}
                      className="w-full bg-bg-soft px-3 py-2 rounded mt-1 text-sm text-text outline-none">
                {KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            <button onClick={create} className="w-full py-2.5 rounded bg-accent text-[#0b0e11] font-semibold">Oluştur</button>
          </div>
        </div>
      )}
    </div>
  );
}
