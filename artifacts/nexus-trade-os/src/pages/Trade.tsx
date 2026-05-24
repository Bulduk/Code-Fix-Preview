import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { api, OrderRecord } from "@/lib/api";
import { TrendingUp, TrendingDown, Clock, RefreshCw, Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react";

function getSearchParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

const STATUS_COLORS: Record<string, string> = {
  filled:    "bg-green-100 text-green-700",
  open:      "bg-blue-100 text-blue-700",
  pending:   "bg-amber-100 text-amber-700",
  cancelled: "bg-bg-soft text-text-dim",
  rejected:  "bg-red-100 text-red-700",
  partial:   "bg-purple-100 text-purple-700",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  filled:    CheckCircle2,
  open:      Circle,
  pending:   Loader2,
  cancelled: AlertCircle,
  rejected:  AlertCircle,
  partial:   Circle,
};

export default function Trade() {
  const exParam  = getSearchParam("ex")  || "okx";
  const symParam = getSearchParam("sym") || "BTCUSDT";

  const [ex,      setEx]      = useState(exParam);
  const [sym,     setSym]     = useState(symParam);
  const [side,    setSide]    = useState<"buy" | "sell">("buy");
  const [type,    setType]    = useState<"market" | "limit">("limit");
  const [qty,     setQty]     = useState("0.001");
  const [px,      setPx]      = useState("");
  const [loading, setLoading] = useState(false);
  const [flash,   setFlash]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [orders,  setOrders]  = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const token  = useStore((s) => s.token);
  const ticks  = useStore((s) => s.ticks);
  const { applyEvent } = useStore();

  const currentPx = ticks[`${ex}:${sym}`]?.px;
  const tick       = ticks[`${ex}:${sym}`];
  const up         = (tick?.change ?? 0) >= 0;

  const loadOrders = async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch { /* ignore */ }
    finally { setLoadingOrders(false); }
  };

  useEffect(() => { loadOrders(); }, [token]);

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    setFlash(null);
    try {
      const result = await api.placeOrder({
        ex, sym, side, type, qty: Number(qty),
        px: type === "limit" ? Number(px) : currentPx ?? 0,
      });
      // Push to local store
      applyEvent({
        t: "order",
        id: result.id,
        ex,
        sym,
        side,
        type,
        qty: Number(qty),
        px: result.avgFillPx ?? (type === "limit" ? Number(px) : currentPx ?? 0),
        status: result.status,
        ts: Date.now(),
      });
      setFlash({ msg: `${side === "buy" ? "Alım" : "Satım"} emri başarıyla iletildi${result.isPaper ? " [PAPER]" : ""}.`, ok: true });
      await loadOrders();
    } catch (e) {
      setFlash({ msg: `Emir hatası: ${e instanceof Error ? e.message : "Bilinmeyen hata"}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const EXCHANGES = ["binance", "bybit", "okx", "coinbase", "kraken"];
  const SYMBOLS   = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "LINKUSDT", "ARBUSDT", "MATICUSDT"];

  const estimatedValue = useMemo(() => {
    const price = type === "limit" ? Number(px) : (currentPx ?? 0);
    return (Number(qty) * price).toFixed(2);
  }, [qty, px, type, currentPx]);

  const recentOrders = orders.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Emir Gir</h1>
          <p className="text-xs text-text-dim">CCXT Pro · Paper & Live emirler</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Order Form ── */}
        <div className="space-y-3">
          {/* Price ticker */}
          {tick && (
            <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-text-dim mb-0.5">{sym} · {ex}</div>
                  <div className="text-2xl font-bold font-mono text-text">
                    {tick.px < 1 ? tick.px.toFixed(4) : tick.px.toFixed(2)}
                    <span className="text-sm font-normal text-text-dim ml-1">USDT</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-sm font-semibold ${up ? "text-up" : "text-down"}`}>
                  {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {up ? "+" : ""}{((tick.change ?? 0) * 100).toFixed(2)}%
                </div>
              </div>
              {(tick.high24h || tick.low24h) && (
                <div className="flex gap-4 mt-2 text-xs text-text-dim">
                  {tick.high24h && <span>24h Yüksek: <span className="text-up font-mono">{tick.high24h.toFixed(2)}</span></span>}
                  {tick.low24h  && <span>24h Düşük: <span className="text-down font-mono">{tick.low24h.toFixed(2)}</span></span>}
                  {tick.vol24h  && <span>Hacim: <span className="text-text font-mono">${(tick.vol24h / 1e6).toFixed(0)}M</span></span>}
                </div>
              )}
            </div>
          )}

          <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card space-y-3">
            {/* Exchange + Symbol */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-text-dim font-medium">Borsa</label>
                <select value={ex} onChange={(e) => setEx(e.target.value)}
                  className="w-full bg-bg-soft border border-line px-3 py-2 rounded-xl text-sm text-text outline-none focus:border-accent">
                  {EXCHANGES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-dim font-medium">Sembol</label>
                <select value={sym} onChange={(e) => setSym(e.target.value)}
                  className="w-full bg-bg-soft border border-line px-3 py-2 rounded-xl text-sm text-text outline-none focus:border-accent">
                  {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Side buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSide("buy")}
                className={`py-3 rounded-xl font-bold text-sm transition ${side === "buy" ? "bg-up text-white shadow-sm" : "bg-bg-soft text-text-dim border border-line hover:bg-line"}`}>
                AL (BUY)
              </button>
              <button onClick={() => setSide("sell")}
                className={`py-3 rounded-xl font-bold text-sm transition ${side === "sell" ? "bg-down text-white shadow-sm" : "bg-bg-soft text-text-dim border border-line hover:bg-line"}`}>
                SAT (SELL)
              </button>
            </div>

            {/* Order type */}
            <div className="space-y-1">
              <label className="text-xs text-text-dim font-medium">Emir Tipi</label>
              <div className="flex gap-2">
                {(["limit", "market"] as const).map((t) => (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition border ${type === t ? "bg-accent/10 border-accent/30 text-accent" : "bg-bg-soft border-line text-text-dim hover:bg-line"}`}>
                    {t === "limit" ? "Limit" : "Market"}
                  </button>
                ))}
              </div>
            </div>

            {/* Price (limit only) */}
            {type === "limit" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-dim font-medium">Fiyat (USDT)</label>
                  {currentPx && (
                    <button onClick={() => setPx(currentPx.toFixed(2))}
                      className="text-[10px] text-accent hover:underline">
                      Piyasa fiyatını kullan
                    </button>
                  )}
                </div>
                <input value={px} onChange={(e) => setPx(e.target.value)}
                  placeholder={currentPx ? currentPx.toFixed(2) : "0.00"}
                  className="w-full bg-bg-soft border border-line px-3 py-2 rounded-xl font-mono text-sm text-text outline-none focus:border-accent" />
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-1">
              <label className="text-xs text-text-dim font-medium">Miktar</label>
              <div className="flex gap-2">
                <input value={qty} onChange={(e) => setQty(e.target.value)}
                  placeholder="0.001"
                  className="flex-1 bg-bg-soft border border-line px-3 py-2 rounded-xl font-mono text-sm text-text outline-none focus:border-accent" />
                <div className="flex gap-1">
                  {["25%", "50%", "75%", "100%"].map((pct) => (
                    <button key={pct} onClick={() => {
                      const base = 0.1;
                      const factor = parseInt(pct) / 100;
                      setQty((base * factor).toFixed(4));
                    }}
                      className="text-[10px] px-1.5 py-1 rounded-lg bg-bg-soft border border-line text-text-dim hover:bg-line transition">
                      {pct}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Estimated value */}
            <div className="flex items-center justify-between text-xs text-text-dim px-1">
              <span>Tahmini değer: <span className="font-mono text-text">${estimatedValue} USDT</span></span>
              <span>Min: 0.001</span>
            </div>

            {/* Flash message */}
            {flash && (
              <div className={`text-sm px-3 py-2.5 rounded-xl flex items-center gap-2 ${flash.ok ? "bg-up/10 text-up border border-up/20" : "bg-down/10 text-down border border-down/20"}`}>
                {flash.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {flash.msg}
              </div>
            )}

            {/* Submit */}
            <button onClick={submit} disabled={loading}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition disabled:opacity-60 ${
                side === "buy"
                  ? "bg-up text-white hover:brightness-110 shadow-sm"
                  : "bg-down text-white hover:brightness-110 shadow-sm"
              }`}>
              {loading
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> İşleniyor...</span>
                : `${side === "buy" ? "AL" : "SAT"} — ${qty} ${sym.replace("USDT", "")}`}
            </button>

            <p className="text-[10px] text-text-dim text-center">
              Paper mod aktif — emirler simüle edilir, gerçek işlem yapılmaz
            </p>
          </div>
        </div>

        {/* ── Order History ── */}
        <div className="bg-bg-elev border border-line rounded-2xl shadow-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-text-dim" />
              <span className="text-sm font-bold text-text">Emir Geçmişi</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-bg-soft text-text-dim border border-line">{orders.length}</span>
            </div>
            <button onClick={loadOrders} disabled={loadingOrders}
              className="p-1.5 rounded-lg hover:bg-bg-soft text-text-dim transition disabled:opacity-50">
              {loadingOrders ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>

          <div className="flex-1 overflow-auto divide-y divide-line">
            {recentOrders.length === 0 && (
              <div className="px-4 py-12 text-center text-text-dim text-sm">
                <Clock size={28} className="mx-auto mb-2 opacity-30" />
                <div>Henüz emir yok</div>
                <div className="text-xs mt-1 opacity-60">İlk emrini gir</div>
              </div>
            )}
            {recentOrders.map((o) => {
              const StatusIcon = STATUS_ICONS[o.status] ?? Circle;
              const isPaper = o.isPaper === true || o.isPaper === "true";
              return (
                <div key={o.id} className="px-4 py-3 hover:bg-bg-soft transition">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${o.side === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {o.side.toUpperCase()}
                      </span>
                      <span className="font-mono text-sm font-semibold text-text">{o.sym}</span>
                      {isPaper && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">PAPER</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon size={11} className={o.status === "filled" ? "text-up" : o.status === "rejected" ? "text-down" : "text-text-dim"} />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[o.status] ?? "bg-bg-soft text-text-dim"}`}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-dim">
                    <span>{o.exchange} · {o.qty} @ <span className="font-mono text-text">${(o.avgFillPx ?? o.px ?? 0).toFixed(2)}</span></span>
                    <span>{o.createdAt ? new Date(o.createdAt).toLocaleTimeString("tr-TR") : o.ts ? new Date(o.ts).toLocaleTimeString("tr-TR") : ""}</span>
                  </div>
                  {o.fee !== undefined && o.fee > 0 && (
                    <div className="text-[10px] text-text-dim mt-0.5">Komisyon: ${o.fee.toFixed(4)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
