import { useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

function getSearchParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

export default function Trade() {
  const exParam = getSearchParam("ex") || "binance";
  const symParam = getSearchParam("sym") || "BTCUSDT";

  const [ex, setEx] = useState(exParam);
  const [sym, setSym] = useState(symParam);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("limit");
  const [qty, setQty] = useState("0.001");
  const [px, setPx] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState("");
  const token = useStore((s) => s.token);
  const ticks = useStore((s) => s.ticks);

  const currentPx = ticks[`${ex}:${sym}`]?.px;

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    setFlash("");
    try {
      await api.placeOrder({
        ex, sym, side, type, qty: Number(qty),
        px: type === "limit" ? Number(px) : currentPx ?? 0,
      });
      setFlash(`${side === "buy" ? "Alım" : "Satım"} emri başarıyla iletildi.`);
    } catch {
      setFlash("Emir iletme hatası.");
    } finally {
      setLoading(false);
    }
  };

  const EXCHANGES = ["binance", "bybit", "okx", "coinbase", "kraken"];
  const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "LTCUSDT"];

  return (
    <div className="space-y-3 max-w-md">
      <h1 className="text-lg font-semibold text-text">Emir Gir</h1>

      <div className="bg-bg-elev border border-line rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-text-dim">Borsa</label>
            <select
              value={ex}
              onChange={(e) => setEx(e.target.value)}
              className="w-full bg-bg-soft px-3 py-2 rounded text-sm text-text outline-none"
            >
              {EXCHANGES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-dim">Sembol</label>
            <select
              value={sym}
              onChange={(e) => setSym(e.target.value)}
              className="w-full bg-bg-soft px-3 py-2 rounded text-sm text-text outline-none"
            >
              {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {currentPx !== undefined && (
          <div className="text-xs text-text-dim">
            Piyasa fiyatı: <span className="font-mono text-text">{currentPx.toFixed(2)}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSide("buy")}
            className={`py-2.5 rounded font-semibold text-sm transition ${side === "buy" ? "bg-up text-[#0b0e11]" : "bg-bg-soft text-text-dim hover:bg-bg-elev"}`}
          >
            AL (BUY)
          </button>
          <button
            onClick={() => setSide("sell")}
            className={`py-2.5 rounded font-semibold text-sm transition ${side === "sell" ? "bg-down text-[#0b0e11]" : "bg-bg-soft text-text-dim hover:bg-bg-elev"}`}
          >
            SAT (SELL)
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-dim">Emir Tipi</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "market" | "limit")}
            className="w-full bg-bg-soft px-3 py-2 rounded text-sm text-text outline-none"
          >
            <option value="limit">Limit</option>
            <option value="market">Market</option>
          </select>
        </div>

        {type === "limit" && (
          <div className="space-y-1">
            <label className="text-xs text-text-dim">Fiyat (USDT)</label>
            <input
              value={px}
              onChange={(e) => setPx(e.target.value)}
              placeholder={currentPx ? currentPx.toFixed(2) : "0.00"}
              className="w-full bg-bg-soft px-3 py-2 rounded font-mono text-sm text-text outline-none"
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs text-text-dim">Miktar</label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0.001"
            className="w-full bg-bg-soft px-3 py-2 rounded font-mono text-sm text-text outline-none"
          />
        </div>

        {flash && (
          <div className={`text-sm px-3 py-2 rounded ${flash.includes("hata") ? "bg-down/15 text-down" : "bg-up/15 text-up"}`}>
            {flash}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className={`w-full py-3 rounded font-semibold text-sm transition disabled:opacity-60 ${side === "buy" ? "bg-up text-[#0b0e11] hover:bg-up/90" : "bg-down text-[#0b0e11] hover:bg-down/90"}`}
        >
          {loading ? "İşleniyor..." : `${side === "buy" ? "AL" : "SAT"} — ${qty} ${sym}`}
        </button>
      </div>
    </div>
  );
}
