import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Strategy } from "@/lib/api";
import { Plus, ToggleLeft, ToggleRight, Sliders, Trash2, X, ChevronRight } from "lucide-react";

const KINDS = ["scalping","meanreversion","momentum","breakout","grid","marketmaking","dca","trendfollowing","arbitrage"];
const TIMEFRAMES = ["1m","3m","5m","15m","30m","1h","2h","4h","1d"];
const PROVIDERS: Record<string, { label: string; models: string[] }> = {
  anthropic: { label: "Claude", models: ["claude-3-5-sonnet-20241022","claude-3-5-haiku-20241022","claude-3-opus-20240229"] },
  google: { label: "Gemini", models: ["gemini-1.5-pro","gemini-1.5-flash","gemini-2.0-flash"] },
  openai: { label: "GPT", models: ["gpt-4o","gpt-4o-mini","gpt-4-turbo"] },
};
const KIND_EXTRA: Record<string, string[]> = {
  meanreversion: ["z_score"],
  grid: ["grid_levels"],
  momentum: ["lookback"],
  breakout: ["lookback"],
  dca: ["lookback"],
};

function NumField({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-text-dim">{label}{unit ? ` (${unit})` : ""}</label>
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent"
      />
    </div>
  );
}

function StrategyModal({
  strategy, onClose, onSave,
}: {
  strategy: Strategy | null;
  onClose: () => void;
  onSave: (data: Partial<Strategy>) => Promise<void>;
}) {
  const isNew = !strategy;
  const [form, setForm] = useState<Partial<Strategy>>(
    strategy ?? {
      name: "", kind: "scalping", enabled: false, allocation: 10,
      provider: "anthropic", model: "claude-3-5-sonnet-20241022", exchange_id: "1",
      params: { timeframe: "15m", stop_loss_pct: 2, take_profit_pct: 4, risk_per_trade_pct: 1, max_positions: 3 },
    }
  );

  const setParam = (key: string, val: unknown) => {
    setForm((f) => ({ ...f, params: { ...f.params, [key]: val } }));
  };
  const setProvider = (p: string) => {
    const firstModel = PROVIDERS[p].models[0];
    setForm((f) => ({ ...f, provider: p as Strategy["provider"], model: firstModel }));
  };

  const extraKeys = KIND_EXTRA[form.kind ?? ""] ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4 overflow-auto py-6" onClick={onClose}>
      <div
        className="bg-bg-elev border border-line rounded-xl p-5 w-full max-w-lg space-y-4 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-text">{isNew ? "Yeni Strateji" : `Düzenle: ${strategy?.name}`}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-text"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-dim">Strateji Adı</label>
            <input
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="BTC Scalper"
              className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-dim">Tip</label>
            <select
              value={form.kind ?? "scalping"}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none"
            >
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-dim">Zaman Dilimi</label>
            <select
              value={form.params?.timeframe ?? "15m"}
              onChange={(e) => setParam("timeframe", e.target.value)}
              className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none"
            >
              {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-text-dim mb-1 block">Tahsis: %{form.allocation}</label>
          <input
            type="range" min={1} max={100} step={1} value={form.allocation ?? 10}
            onChange={(e) => setForm({ ...form, allocation: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-text-dim mt-0.5"><span>1%</span><span>100%</span></div>
        </div>

        <div className="border-t border-line pt-3 grid grid-cols-2 gap-3">
          <div className="text-xs font-medium text-text-dim col-span-2">Risk Parametreleri (Rust Katmanı)</div>
          <NumField label="Stop-Loss" value={form.params?.stop_loss_pct as number ?? 2} min={0.1} max={15} step={0.1} unit="%" onChange={(v) => setParam("stop_loss_pct", v)} />
          <NumField label="Take-Profit" value={form.params?.take_profit_pct as number ?? 4} min={0.2} max={50} step={0.1} unit="%" onChange={(v) => setParam("take_profit_pct", v)} />
          <NumField label="İşlem Başına Risk" value={form.params?.risk_per_trade_pct as number ?? 1} min={0.1} max={5} step={0.1} unit="%" onChange={(v) => setParam("risk_per_trade_pct", v)} />
          <NumField label="Max Pozisyon" value={form.params?.max_positions as number ?? 3} min={1} max={20} step={1} onChange={(v) => setParam("max_positions", v)} />
          {extraKeys.map((key) => (
            <NumField key={key} label={key} value={form.params?.[key] as number ?? 2} min={0} max={100} step={0.5} onChange={(v) => setParam(key, v)} />
          ))}
        </div>

        <div className="border-t border-line pt-3 grid grid-cols-2 gap-3">
          <div className="text-xs font-medium text-text-dim col-span-2">LLM Kararı</div>
          <div>
            <label className="text-xs text-text-dim">Provider</label>
            <select
              value={form.provider ?? "anthropic"}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none"
            >
              {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-dim">Model</label>
            <select
              value={form.model ?? ""}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none"
            >
              {(PROVIDERS[form.provider ?? "anthropic"]?.models ?? []).map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-line text-sm text-text-dim hover:bg-bg-soft transition">İptal</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-amber-600 transition">
            {isNew ? "Oluştur" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Strategies() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<Strategy[]>([]);
  const [editTarget, setEditTarget] = useState<Strategy | "new" | null>(null);

  const load = () => { if (token) api.getStrategies().then(setList); };
  useEffect(() => { load(); }, [token]);

  const toggle = async (s: Strategy) => {
    await api.updateStrategy(s.id, { enabled: !s.enabled });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Bu stratejiyi silmek istiyor musun?")) return;
    await api.deleteStrategy(id);
    load();
  };

  const handleSave = async (data: Partial<Strategy>) => {
    if (editTarget === "new") {
      await api.createStrategy(data as Omit<Strategy, "id">);
    } else if (editTarget) {
      await api.updateStrategy(editTarget.id, data);
    }
    setEditTarget(null);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Stratejiler</h1>
        <button
          onClick={() => setEditTarget("new")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-amber-600 transition"
        >
          <Plus size={14} /> Yeni
        </button>
      </div>

      <div className="bg-bg-elev border border-line rounded-xl divide-y divide-line shadow-card">
        {list.map((s) => (
          <div key={s.id} className="px-3 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-bg-soft grid place-items-center border border-line">
                  <Sliders size={13} className="text-text-dim" />
                </div>
                <div>
                  <div className="text-sm font-medium text-text">{s.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-text-dim">{s.kind}</span>
                    <span className="text-xs text-text-dim">·</span>
                    <span className="text-xs text-text-dim">%{s.allocation} tahsis</span>
                    <span className="text-xs text-text-dim">·</span>
                    <span className="text-xs text-text-dim">{s.params?.timeframe}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">
                      {s.provider === "anthropic" ? "Claude" : s.provider === "google" ? "Gemini" : "GPT"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggle(s)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    s.enabled ? "bg-up/10 text-up hover:bg-up/20" : "bg-bg-soft text-text-dim hover:bg-line"
                  }`}
                >
                  {s.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  {s.enabled ? "ON" : "OFF"}
                </button>
                <button onClick={() => setEditTarget(s)} className="p-1.5 rounded-lg hover:bg-bg-soft transition text-text-dim">
                  <ChevronRight size={13} />
                </button>
                <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-dim hover:text-down transition">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-text-dim">
              <span>SL: <span className="text-down font-medium">%{s.params?.stop_loss_pct}</span></span>
              <span>TP: <span className="text-up font-medium">%{s.params?.take_profit_pct}</span></span>
              <span>Risk/işlem: <span className="text-text font-medium">%{s.params?.risk_per_trade_pct}</span></span>
              <span>Max pos: <span className="text-text font-medium">{s.params?.max_positions}</span></span>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="px-3 py-8 text-text-dim text-sm text-center">Strateji yok</div>}
      </div>

      {editTarget !== null && (
        <StrategyModal
          strategy={editTarget === "new" ? null : editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
