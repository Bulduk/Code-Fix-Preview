import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, Exchange } from "@/lib/api";
import { Plus, X, CheckCircle2, Circle, Trash2 } from "lucide-react";

const EXCHANGES = ["binance","bybit","okx","coinbase","kraken","bitmex","dydx","hyperliquid","ibkr","polymarket"];
const MODES = ["paper", "testnet", "live"];

export default function Exchanges() {
  const token = useStore((s) => s.token);
  const [list, setList] = useState<Exchange[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    exchange: "binance", label: "", mode: "testnet",
    api_key: "", api_secret: "", passphrase: "", is_active: true,
  });

  const load = () => { if (token) api.getExchanges().then(setList); };
  useEffect(() => { load(); }, [token]);

  const create = async () => {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Borsa Hesapları</h1>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-[#0b0e11] text-sm font-medium hover:bg-accent/90 transition"
        >
          <Plus size={14} /> Yeni
        </button>
      </div>

      <div className="bg-bg-elev border border-line rounded-xl divide-y divide-line">
        {list.map((a) => (
          <div key={a.id} className="px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bg-soft grid place-items-center text-xs font-bold uppercase text-text-dim">
                {a.exchange.slice(0, 2)}
              </div>
              <div>
                <div className="text-sm font-medium text-text">{a.exchange} · {a.label}</div>
                <div className="text-xs text-text-dim">Mod: {a.mode}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${a.is_active ? "bg-up/20 text-up" : "bg-bg-soft text-text-dim"}`}>
                {a.is_active ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                {a.is_active ? "aktif" : "pasif"}
              </span>
              <button onClick={() => remove(a.id)} className="p-1 rounded hover:bg-down/20 text-text-dim hover:text-down transition">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="px-3 py-8 text-text-dim text-sm text-center">Hesap yok</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center px-4" onClick={() => setOpen(false)}>
          <div
            className="bg-bg-elev border border-line rounded-xl p-5 w-full max-w-md space-y-3"
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
                        className="w-full bg-bg-soft px-3 py-2 rounded mt-1 text-sm text-text outline-none">
                  {EXCHANGES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-dim">Mod</label>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
                        className="w-full bg-bg-soft px-3 py-2 rounded mt-1 text-sm text-text outline-none">
                  {MODES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-dim">Etiket</label>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                     placeholder="örn. main" className="w-full bg-bg-soft px-3 py-2 rounded mt-1 text-sm text-text outline-none" />
            </div>
            <div>
              <label className="text-xs text-text-dim">API Key</label>
              <input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                     className="w-full bg-bg-soft px-3 py-2 rounded mt-1 font-mono text-xs text-text outline-none" />
            </div>
            <div>
              <label className="text-xs text-text-dim">API Secret</label>
              <input type="password" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                     className="w-full bg-bg-soft px-3 py-2 rounded mt-1 font-mono text-xs text-text outline-none" />
            </div>
            <div>
              <label className="text-xs text-text-dim">Passphrase (OKX/Coinbase)</label>
              <input value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
                     className="w-full bg-bg-soft px-3 py-2 rounded mt-1 font-mono text-xs text-text outline-none" />
            </div>
            <button onClick={create} className="w-full py-2.5 rounded bg-accent text-[#0b0e11] font-semibold hover:bg-accent/90 transition">
              Kaydet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
