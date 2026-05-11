import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Strategy, Exchange } from "@/lib/api";
import { Plus, ToggleLeft, ToggleRight, Sliders, Trash2, X, Code2, Settings2, Loader2 } from "lucide-react";

const KINDS = ["scalping","meanreversion","momentum","breakout","grid","marketmaking","dca","trendfollowing","arbitrage"];
const TIMEFRAMES = ["1m","3m","5m","15m","30m","1h","2h","4h","6h","12h","1d"];
const PROVIDERS: Record<string, { label: string; models: string[] }> = {
  anthropic: { label: "Claude", models: ["claude-3-5-sonnet-20241022","claude-3-5-haiku-20241022","claude-3-opus-20240229"] },
  google:    { label: "Gemini", models: ["gemini-1.5-pro","gemini-1.5-flash","gemini-2.0-flash"] },
  openai:    { label: "GPT",    models: ["gpt-4o","gpt-4o-mini","gpt-4-turbo"] },
};
const KIND_EXTRA: Record<string, { key: string; label: string; min: number; max: number; step: number }[]> = {
  meanreversion: [{ key: "z_score",    label: "Z-Score Eşiği",  min: 0.5, max: 5,   step: 0.1 }],
  grid:          [{ key: "grid_levels",label: "Grid Seviyeleri",min: 2,   max: 50,  step: 1   }],
  momentum:      [{ key: "lookback",   label: "Lookback (bar)", min: 5,   max: 200, step: 1   }],
  breakout:      [{ key: "lookback",   label: "Lookback (bar)", min: 5,   max: 200, step: 1   }],
  dca:           [{ key: "lookback",   label: "DCA Periyot",    min: 1,   max: 30,  step: 1   }],
  arbitrage:     [{ key: "min_spread", label: "Min Spread (%)", min: 0.01,max: 1,   step: 0.01}],
};

type Tab = "params" | "code";

function StrategyModal({
  strategy, exchanges, onClose, onSave,
}: {
  strategy: Strategy | null; exchanges: Exchange[];
  onClose: () => void; onSave: (data: Partial<Strategy>) => Promise<void>;
}) {
  const isNew = !strategy;
  const [form, setForm] = useState<Partial<Strategy>>(
    strategy ?? {
      name: "", kind: "scalping", enabled: false, allocation: 10,
      provider: "anthropic", model: "claude-3-5-sonnet-20241022", exchange_id: "1",
      code: undefined,
      params: { timeframe: "15m", stop_loss_pct: 2, take_profit_pct: 4, risk_per_trade_pct: 1, max_positions: 3 },
    }
  );
  const [tab, setTab]       = useState<Tab>("params");
  const [saving, setSaving] = useState(false);

  const setParam = (key: string, val: unknown) => setForm((f) => ({ ...f, params: { ...f.params, [key]: val } }));
  const setProvider = (p: string) => {
    const firstModel = PROVIDERS[p].models[0];
    setForm((f) => ({ ...f, provider: p as Strategy["provider"], model: firstModel }));
  };

  const extraFields = KIND_EXTRA[form.kind ?? ""] ?? [];

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-start pt-6 px-4 overflow-auto pb-6" onClick={onClose}>
      <div className="bg-bg-elev border border-line rounded-2xl w-full max-w-2xl mx-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-text">{isNew ? "Yeni Strateji" : `Düzenle: ${strategy?.name}`}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-soft text-text-dim"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line">
          {([["params","⚙️ Parametreler"],["code","</> Kod"]] as [Tab,string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === t ? "border-accent text-accent" : "border-transparent text-text-dim hover:text-text"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "params" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-text-dim">Strateji Adı</label>
                  <input value={form.name ?? ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="BTC Scalper"
                    className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-xs text-text-dim">Tip</label>
                  <select value={form.kind ?? "scalping"}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                    className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none">
                    {KINDS.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-dim">Zaman Dilimi</label>
                  <select value={(form.params?.["timeframe"] as string) ?? "15m"}
                    onChange={(e) => setParam("timeframe", e.target.value)}
                    className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none">
                    {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-dim">Borsa</label>
                  <select value={form.exchange_id ?? "1"}
                    onChange={(e) => setForm({ ...form, exchange_id: e.target.value })}
                    className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none">
                    {exchanges.map((ex) => (
                      <option key={ex.id} value={ex.id}>{ex.exchange} / {ex.label} ({ex.mode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-dim mb-1 block">Tahsis: %{form.allocation}</label>
                  <input type="range" min={1} max={100} step={1} value={form.allocation ?? 10}
                    onChange={(e) => setForm({ ...form, allocation: Number(e.target.value) })}
                    className="w-full accent-amber-500 mt-1" />
                </div>
              </div>

              <div className="border-t border-line pt-4">
                <div className="text-xs font-semibold text-text-dim mb-3">Risk Parametreleri</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "stop_loss_pct",    label: "Stop-Loss",        unit: "%", min: 0.1, max: 15,  step: 0.1 },
                    { key: "take_profit_pct",  label: "Take-Profit",      unit: "%", min: 0.2, max: 50,  step: 0.1 },
                    { key: "risk_per_trade_pct",label:"Risk/İşlem",       unit: "%", min: 0.1, max: 5,   step: 0.1 },
                    { key: "max_positions",    label: "Max Pozisyon",     unit: "",  min: 1,   max: 20,  step: 1   },
                  ].map(({ key, label, unit, min, max, step }) => (
                    <div key={key}>
                      <label className="text-xs text-text-dim">{label}{unit ? ` (${unit})` : ""}</label>
                      <input type="number" min={min} max={max} step={step}
                        value={form.params?.[key] as number ?? 0}
                        onChange={(e) => setParam(key, Number(e.target.value))}
                        className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent" />
                    </div>
                  ))}
                  {extraFields.map(({ key, label, min, max, step }) => (
                    <div key={key}>
                      <label className="text-xs text-text-dim">{label}</label>
                      <input type="number" min={min} max={max} step={step}
                        value={form.params?.[key] as number ?? 0}
                        onChange={(e) => setParam(key, Number(e.target.value))}
                        className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-line pt-4">
                <div className="text-xs font-semibold text-text-dim mb-3">LLM Kararı</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-dim">Provider</label>
                    <select value={form.provider ?? "anthropic"} onChange={(e) => setProvider(e.target.value)}
                      className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none">
                      {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-text-dim">Model</label>
                    <select value={form.model ?? ""}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none">
                      {(PROVIDERS[form.provider ?? "anthropic"]?.models ?? []).map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "code" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Code2 size={14} className="text-accent" />
                <span className="text-sm font-semibold text-text">Strateji Kodu</span>
                <span className="text-xs text-text-dim ml-auto">Python · nexus_sdk kullanır</span>
              </div>
              <div className="relative">
                <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-t-xl border-b border-slate-700">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{(form.name ?? "strategy").toLowerCase().replace(/\s+/g,"_")}.py</span>
                </div>
                <textarea
                  value={form.code ?? ""}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  rows={22}
                  spellCheck={false}
                  className="w-full bg-slate-900 text-green-300 font-mono text-xs px-4 pb-4 pt-10 rounded-xl outline-none resize-none leading-relaxed border border-slate-700 focus:border-slate-500"
                  placeholder="# Strateji kodunu buraya yaz..."
                />
              </div>
              <div className="text-[11px] text-text-dim bg-bg-soft rounded-xl p-3 border border-line">
                <strong>Kullanılabilir:</strong> <code>nexus_sdk.Strategy</code>, <code>Signal</code>, <code>AgentIntent</code> · 
                <code>self.compute_rsi()</code>, <code>self.compute_macd()</code>, <code>self.calc_position_size()</code> · 
                <code>CCXT Pro</code> + <code>Polars</code> entegrasyonu VPS'te çalışır
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-text-dim hover:bg-bg-soft transition">İptal</button>
          <button onClick={handleSave} disabled={saving || !form.name?.trim()}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isNew ? "Oluştur" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Strategies() {
  const token = useStore((s) => s.token);
  const [list, setList]           = useState<Strategy[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [editTarget, setEditTarget] = useState<Strategy | "new" | null>(null);

  const load = () => {
    if (!token) return;
    api.getStrategies().then(setList);
    api.getExchanges().then(setExchanges);
  };
  useEffect(load, [token]);

  const toggle = async (s: Strategy) => { await api.updateStrategy(s.id, { enabled: !s.enabled }); load(); };
  const remove = async (id: string) => { if (!confirm("Sil?")) return; await api.deleteStrategy(id); load(); };
  const handleSave = async (data: Partial<Strategy>) => {
    if (editTarget === "new") await api.createStrategy(data as Omit<Strategy, "id">);
    else if (editTarget) await api.updateStrategy(editTarget.id, data);
    setEditTarget(null); load();
  };

  const getExchangeLabel = (id: string) => {
    const ex = exchanges.find((e) => e.id === id);
    return ex ? `${ex.exchange}/${ex.label}` : id;
  };

  const totalAllocation = list.filter((s) => s.enabled).reduce((a, s) => a + s.allocation, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Stratejiler</h1>
          <p className="text-xs text-text-dim">Aktif tahsis: %{totalAllocation} · {list.filter((s) => s.enabled).length}/{list.length} çalışıyor</p>
        </div>
        <button onClick={() => setEditTarget("new")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-amber-600 transition">
          <Plus size={14} /> Yeni
        </button>
      </div>

      {/* Allocation bar */}
      <div className="bg-bg-elev border border-line rounded-2xl p-3 shadow-card">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-text-dim font-medium">Aktif Tahsis</span>
          <span className={`font-semibold ${totalAllocation > 100 ? "text-down" : "text-text"}`}>%{totalAllocation}/100</span>
        </div>
        <div className="h-2 bg-bg-soft rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${totalAllocation > 100 ? "bg-down" : totalAllocation > 80 ? "bg-amber-400" : "bg-up"}`}
            style={{ width: `${Math.min(100, totalAllocation)}%` }}
          />
        </div>
      </div>

      <div className="bg-bg-elev border border-line rounded-2xl divide-y divide-line shadow-card">
        {list.map((s) => (
          <div key={s.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-bg-soft grid place-items-center border border-line shrink-0">
                  <Sliders size={14} className="text-text-dim" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">{s.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-text-dim">{s.kind}</span>
                    <span className="text-xs text-text-dim">·</span>
                    <span className="text-xs text-text-dim">%{s.allocation}</span>
                    <span className="text-xs text-text-dim">·</span>
                    <span className="text-xs text-text-dim">{s.params?.["timeframe"] as string}</span>
                    <span className="text-xs text-text-dim">·</span>
                    <span className="text-xs text-text-dim">{getExchangeLabel(s.exchange_id)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      s.provider === "anthropic" ? "bg-orange-50 text-orange-600" :
                      s.provider === "google" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                    }`}>
                      {s.provider === "anthropic" ? "Claude" : s.provider === "google" ? "Gemini" : "GPT"}
                    </span>
                    {s.code && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex items-center gap-0.5">
                        <Code2 size={9} /> Kod
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggle(s)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    s.enabled ? "bg-up/10 text-up hover:bg-up/20" : "bg-bg-soft text-text-dim hover:bg-line"
                  }`}>
                  {s.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} {s.enabled ? "ON" : "OFF"}
                </button>
                <button onClick={() => setEditTarget(s)}
                  className="p-1.5 rounded-lg hover:bg-bg-soft text-text-dim hover:text-text transition">
                  <Settings2 size={13} />
                </button>
                <button onClick={() => remove(s.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-text-dim hover:text-down transition">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-text-dim flex-wrap">
              <span>SL <span className="text-down font-semibold">%{s.params?.["stop_loss_pct"] as number}</span></span>
              <span>TP <span className="text-up font-semibold">%{s.params?.["take_profit_pct"] as number}</span></span>
              <span>Risk/işlem <span className="text-text font-semibold">%{s.params?.["risk_per_trade_pct"] as number}</span></span>
              <span>Max pos <span className="text-text font-semibold">{s.params?.["max_positions"] as number}</span></span>
              {Object.entries(s.params ?? {})
                .filter(([k]) => !["timeframe","stop_loss_pct","take_profit_pct","risk_per_trade_pct","max_positions"].includes(k))
                .map(([k, v]) => <span key={k}>{k} <span className="text-text font-semibold">{String(v as string | number)}</span></span>)}
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="px-4 py-8 text-text-dim text-sm text-center">Strateji yok</div>}
      </div>

      {editTarget !== null && (
        <StrategyModal
          strategy={editTarget === "new" ? null : editTarget}
          exchanges={exchanges}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
