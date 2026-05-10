import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Exchange } from "@/lib/api";
import {
  Plus, X, CheckCircle2, Circle, Trash2,
  Wifi, WifiOff, Loader2, FlaskConical, Pencil,
} from "lucide-react";

const EXCHANGES = ["binance","bybit","okx","coinbase","kraken","bitmex","dydx","hyperliquid","kucoin","gate"];
const MODES     = ["paper", "testnet", "live"];
const MODE_COLORS: Record<string, string> = {
  paper:   "bg-blue-100 text-blue-700",
  testnet: "bg-amber-100 text-amber-700",
  live:    "bg-green-100 text-green-700",
};
const EX_COLORS: Record<string, string> = {
  okx:     "bg-blue-600",
  binance: "bg-amber-500",
  bybit:   "bg-purple-600",
  coinbase:"bg-sky-500",
  kraken:  "bg-indigo-600",
};

type FormData = {
  exchange: string; label: string; mode: string;
  api_key: string; api_secret: string; passphrase: string; is_active: boolean;
};
const EMPTY_FORM: FormData = {
  exchange: "okx", label: "", mode: "testnet",
  api_key: "", api_secret: "", passphrase: "", is_active: true,
};

function ExchangeModal({
  mode, exchange, onClose, onSave,
}: {
  mode: "add" | "edit";
  exchange: Exchange | null;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
}) {
  const [form, setForm] = useState<FormData>(
    exchange
      ? { exchange: exchange.exchange, label: exchange.label, mode: exchange.mode,
          api_key: exchange.api_key ?? "", api_secret: exchange.api_secret ?? "",
          passphrase: exchange.passphrase ?? "", is_active: exchange.is_active }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const handleSave = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4 py-6 overflow-auto" onClick={onClose}>
      <div className="bg-bg-elev border border-line rounded-2xl p-5 w-full max-w-md space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-text">{mode === "add" ? "Yeni Borsa Hesabı" : `Düzenle: ${exchange?.exchange} / ${exchange?.label}`}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-soft text-text-dim"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-dim">Borsa</label>
            <select value={form.exchange} onChange={(e) => setForm({ ...form, exchange: e.target.value })}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent">
              {EXCHANGES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-dim">Mod</label>
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent">
              {MODES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-text-dim">Etiket</label>
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="örn. main · hedge · paper" autoFocus
            className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent" />
        </div>

        <div className="border-t border-line pt-3 space-y-3">
          <div className="text-xs font-medium text-text-dim">API Anahtarları (sunucu tarafında kullanılır)</div>
          <div>
            <label className="text-xs text-text-dim">API Key</label>
            <input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="API anahtarını yapıştır"
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 font-mono text-xs text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-xs text-text-dim">API Secret</label>
            <div className="relative mt-1">
              <input
                type={showSecret ? "text" : "password"}
                value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 pr-16 font-mono text-xs text-text outline-none focus:border-accent" />
              <button onClick={() => setShowSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-dim hover:text-text">
                {showSecret ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-text-dim">Passphrase (OKX / Coinbase)</label>
            <input value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
              className="w-full bg-bg-soft border border-line rounded-xl px-3 py-2 mt-1 font-mono text-xs text-text outline-none focus:border-accent" />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-text flex-1">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="accent-amber-500 w-4 h-4" />
            Aktif
          </label>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-line text-sm text-text-dim hover:bg-bg-soft transition">İptal</button>
          <button onClick={handleSave} disabled={saving || !form.label.trim()}
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : mode === "add" ? "Kaydet" : "Güncelle"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Exchanges() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<Exchange[]>([]);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; target: Exchange | null } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = () => { if (token) api.getExchanges().then(setList); };
  useEffect(() => { load(); }, [token]);

  const handleSave = async (data: FormData) => {
    if (modal?.mode === "add") {
      await api.createExchange(data as Parameters<typeof api.createExchange>[0]);
    } else if (modal?.target) {
      await api.updateExchange(modal.target.id, data);
    }
    setModal(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Bu hesabı silmek istiyor musun?")) return;
    await api.deleteExchange(id);
    load();
  };

  const toggleActive = async (ex: Exchange) => {
    await api.updateExchange(ex.id, { is_active: !ex.is_active });
    load();
  };

  const testConn = async (id: string) => {
    setTesting(id);
    await api.testExchangeConnection(id);
    load();
    setTesting(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Borsa Hesapları</h1>
          <p className="text-xs text-text-dim">CCXT Pro WebSocket · çoklu borsa yönetimi</p>
        </div>
        <button onClick={() => setModal({ mode: "add", target: null })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-amber-600 transition">
          <Plus size={14} /> Yeni Hesap
        </button>
      </div>

      <div className="bg-bg-elev border border-line rounded-2xl shadow-card overflow-hidden">
        {list.map((a) => (
          <div key={a.id} className="px-4 py-3 flex items-center justify-between border-b border-line last:border-0">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl grid place-items-center text-white text-xs font-bold uppercase ${EX_COLORS[a.exchange] ?? "bg-text-dim"}`}>
                {a.exchange.slice(0, 2)}
              </div>
              <div>
                <div className="text-sm font-semibold text-text capitalize">{a.exchange} · {a.label}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${MODE_COLORS[a.mode]}`}>{a.mode}</span>
                  {a.ws_connected ? (
                    <span className="flex items-center gap-1 text-[10px] text-up"><Wifi size={9} /> {a.latency_ms}ms</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-text-dim"><WifiOff size={9} /> bağlı değil</span>
                  )}
                  {a.api_key && <span className="text-[10px] text-text-dim">API ✓</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => testConn(a.id)} disabled={testing === a.id}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line bg-bg-soft text-xs text-text-dim hover:text-text hover:bg-line transition disabled:opacity-50">
                {testing === a.id ? <Loader2 size={10} className="animate-spin" /> : <FlaskConical size={10} />} Test
              </button>
              <button onClick={() => toggleActive(a)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition ${a.is_active ? "bg-up/10 text-up border-up/20 hover:bg-up/20" : "bg-bg-soft text-text-dim border-line hover:bg-line"}`}>
                {a.is_active ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                {a.is_active ? "Aktif" : "Pasif"}
              </button>
              <button onClick={() => setModal({ mode: "edit", target: a })}
                className="p-1.5 rounded-lg hover:bg-bg-soft transition text-text-dim hover:text-text">
                <Pencil size={13} />
              </button>
              <button onClick={() => remove(a.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-text-dim hover:text-down transition">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="px-4 py-8 text-text-dim text-sm text-center">Hesap yok</div>}
      </div>

      <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
        <div className="text-xs font-medium text-text-dim mb-2">OKX API Ortam Değişkenleri</div>
        <div className="bg-slate-50 rounded-xl p-3 font-mono text-xs text-slate-600 space-y-1">
          <div>OKX_API_KEY=<span className="text-slate-400">sk-...</span></div>
          <div>OKX_SECRET=<span className="text-slate-400">...</span></div>
          <div>OKX_PASSPHRASE=<span className="text-slate-400">...</span></div>
        </div>
        <p className="text-[11px] text-text-dim mt-2">Replit Secrets'a eklenmiş anahtarlar Python Orchestrator servisi tarafından kullanılır.</p>
      </div>

      {modal && (
        <ExchangeModal
          mode={modal.mode}
          exchange={modal.target}
          onClose={() => setModal(null)}
          onSave={handleSave as (data: FormData) => Promise<void>}
        />
      )}
    </div>
  );
}
