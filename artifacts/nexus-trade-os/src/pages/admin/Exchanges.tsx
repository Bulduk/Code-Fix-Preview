import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Exchange } from "@/lib/api";
import { Plus, X, CheckCircle2, Circle, Trash2, Wifi, WifiOff, Loader2, FlaskConical } from "lucide-react";

const EXCHANGES = ["binance","bybit","okx","coinbase","kraken","bitmex","dydx","hyperliquid","ibkr","polymarket"];
const MODES = ["paper", "testnet", "live"];
const MODE_COLORS: Record<string, string> = {
  paper: "bg-blue-100 text-blue-700",
  testnet: "bg-amber-100 text-amber-700",
  live: "bg-green-100 text-green-700",
};

export default function Exchanges() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<Exchange[]>([]);
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({
    exchange: "binance", label: "", mode: "testnet",
    api_key: "", api_secret: "", passphrase: "", is_active: true,
  });

  const load = () => { if (token) api.getExchanges().then(setList); };
  useEffect(() => { load(); }, [token]);

  const create = async () => {
    if (!form.label.trim()) return;
    await api.createExchange({ ...form });
    setOpen(false);
    setForm({ ...form, label: "", api_key: "", api_secret: "", passphrase: "" });
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

  const testConnection = async (id: string) => {
    setTesting(id);
    try {
      await api.testExchangeConnection(id);
      load();
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Borsa Hesapları</h1>
          <p className="text-xs text-text-dim">CCXT Pro WebSocket — çoklu borsa yönetimi</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-amber-600 transition"
        >
          <Plus size={14} /> Yeni Hesap
        </button>
      </div>

      <div className="bg-bg-elev border border-line rounded-xl divide-y divide-line shadow-card">
        {list.map((a) => (
          <div key={a.id} className="px-3 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-bg-soft border border-line grid place-items-center text-xs font-bold uppercase text-text-dim">
                  {a.exchange.slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-medium text-text capitalize">{a.exchange} · {a.label}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${MODE_COLORS[a.mode]}`}>{a.mode}</span>
                    {a.ws_connected ? (
                      <span className="flex items-center gap-1 text-[10px] text-up">
                        <Wifi size={9} /> {a.latency_ms}ms
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-text-dim">
                        <WifiOff size={9} /> bağlı değil
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => testConnection(a.id)}
                  disabled={testing === a.id}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line bg-bg-soft text-xs text-text-dim hover:text-text hover:bg-line transition disabled:opacity-50"
                >
                  {testing === a.id ? <Loader2 size={10} className="animate-spin" /> : <FlaskConical size={10} />}
                  Test
                </button>
                <button
                  onClick={() => toggleActive(a)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${
                    a.is_active ? "bg-up/10 text-up hover:bg-up/20" : "bg-bg-soft text-text-dim hover:bg-line"
                  }`}
                >
                  {a.is_active ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                  {a.is_active ? "aktif" : "pasif"}
                </button>
                <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-dim hover:text-down transition">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="px-3 py-8 text-text-dim text-sm text-center">Hesap yok</div>}
      </div>

      <div className="bg-bg-elev border border-line rounded-xl p-4 shadow-card">
        <div className="text-xs font-medium text-text-dim mb-3">Desteklenen Özellikler</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {["WebSocket Tick Feed", "Order Book L2", "Paper/Testnet/Live", "Spot + Futures"].map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-text-dim">
              <div className="w-1.5 h-1.5 rounded-full bg-up shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4" onClick={() => setOpen(false)}>
          <div
            className="bg-bg-elev border border-line rounded-xl p-5 w-full max-w-md space-y-3 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-text">Yeni Borsa Hesabı</h2>
              <button onClick={() => setOpen(false)} className="text-text-dim hover:text-text"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-text-dim">Borsa</label>
                <select value={form.exchange} onChange={(e) => setForm({ ...form, exchange: e.target.value })}
                        className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none">
                  {EXCHANGES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-dim">Mod</label>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
                        className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none">
                  {MODES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-dim">Etiket</label>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                     placeholder="örn. main" className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 text-sm text-text outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-text-dim">API Key</label>
              <input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                     className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 font-mono text-xs text-text outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-text-dim">API Secret</label>
              <input type="password" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                     className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 font-mono text-xs text-text outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-text-dim">Passphrase (OKX / Coinbase)</label>
              <input value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
                     className="w-full bg-bg-soft border border-line rounded-lg px-3 py-2 mt-1 font-mono text-xs text-text outline-none focus:border-accent" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-lg border border-line text-sm text-text-dim hover:bg-bg-soft transition">İptal</button>
              <button onClick={create} className="flex-1 py-2.5 rounded-lg bg-accent text-white font-semibold hover:bg-amber-600 transition">
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
