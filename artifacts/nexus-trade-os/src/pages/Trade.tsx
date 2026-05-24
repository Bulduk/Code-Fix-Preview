import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/lib/store";
import { api, OrderRecord } from "@/lib/api";
import {
  TrendingUp, TrendingDown, Clock, RefreshCw, Loader2,
  CheckCircle2, Circle, AlertCircle, Shield, ChevronDown, ChevronUp,
  Zap, Target, BarChart3,
} from "lucide-react";

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

// Binance odaklı — borsa seçici kaldırıldı
const EXCHANGE = "binance";

const SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "ADAUSDT", "DOGEUSDT", "LINKUSDT", "ARBUSDT", "MATICUSDT",
  "AAVEUSDT", "UNIUSDT", "OPUSDT",
];

// ── Orderbook Mock ─────────────────────────────────────────────────────────
function generateOrderbook(midPrice: number) {
  const asks: { px: number; qty: number; total: number }[] = [];
  const bids: { px: number; qty: number; total: number }[] = [];
  let askTotal = 0;
  let bidTotal = 0;

  for (let i = 0; i < 10; i++) {
    const spread = midPrice * 0.0001 * (i + 1);
    const askPx  = midPrice + spread;
    const bidPx  = midPrice - spread;
    const askQty = Number((Math.random() * 2 + 0.1).toFixed(4));
    const bidQty = Number((Math.random() * 2 + 0.1).toFixed(4));
    askTotal += askQty;
    bidTotal += bidQty;
    asks.push({ px: askPx, qty: askQty, total: askTotal });
    bids.push({ px: bidPx, qty: bidQty, total: bidTotal });
  }
  return { asks, bids };
}

function Orderbook({ midPrice, onPriceClick }: { midPrice: number; onPriceClick: (px: number) => void }) {
  const { asks, bids } = useMemo(() => generateOrderbook(midPrice), [Math.floor(midPrice * 10)]);
  const maxTotal = Math.max(...asks.map((a) => a.total), ...bids.map((b) => b.total));

  return (
    <div className="bg-bg-elev border border-line rounded-2xl overflow-hidden shadow-card">
      <div className="px-3 py-2.5 border-b border-line flex items-center justify-between">
        <span className="text-sm font-bold text-text">Orderbook</span>
        <span className="text-[10px] text-text-dim">Binance · Simüle</span>
      </div>
      <div className="text-[11px] font-mono">
        {/* Header */}
        <div className="grid grid-cols-3 px-3 py-1 text-text-dim border-b border-line">
          <span>Fiyat (USDT)</span>
          <span className="text-right">Miktar</span>
          <span className="text-right">Toplam</span>
        </div>
        {/* Asks (Sat emirleri) — ters sıra */}
        <div className="divide-y divide-line/50">
          {[...asks].reverse().map((a, i) => (
            <div
              key={i}
              onClick={() => onPriceClick(a.px)}
              className="relative grid grid-cols-3 px-3 py-1 cursor-pointer hover:bg-red-50/50 transition"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-red-100/40"
                style={{ width: `${(a.total / maxTotal) * 100}%` }}
              />
              <span className="text-down relative z-10">{a.px.toFixed(2)}</span>
              <span className="text-right text-text relative z-10">{a.qty.toFixed(4)}</span>
              <span className="text-right text-text-dim relative z-10">{a.total.toFixed(3)}</span>
            </div>
          ))}
        </div>
        {/* Mid price */}
        <div className="px-3 py-2 bg-bg-soft border-y border-line flex items-center justify-between">
          <span className="text-base font-bold text-text">{midPrice.toFixed(2)}</span>
          <span className="text-[10px] text-text-dim">Son Fiyat</span>
        </div>
        {/* Bids (Al emirleri) */}
        <div className="divide-y divide-line/50">
          {bids.map((b, i) => (
            <div
              key={i}
              onClick={() => onPriceClick(b.px)}
              className="relative grid grid-cols-3 px-3 py-1 cursor-pointer hover:bg-green-50/50 transition"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-green-100/40"
                style={{ width: `${(b.total / maxTotal) * 100}%` }}
              />
              <span className="text-up relative z-10">{b.px.toFixed(2)}</span>
              <span className="text-right text-text relative z-10">{b.qty.toFixed(4)}</span>
              <span className="text-right text-text-dim relative z-10">{b.total.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Risk hesaplama
function calcRisk(qty: number, price: number, slPct: number, equity: number) {
  const positionValue = qty * price;
  const riskAmount    = positionValue * (slPct / 100);
  const riskPct       = equity > 0 ? (riskAmount / equity) * 100 : 0;
  return { positionValue, riskAmount, riskPct };
}

export default function Trade() {
  const symParam = getSearchParam("sym") || "BTCUSDT";

  const [sym,     setSym]     = useState(symParam);
  const [side,    setSide]    = useState<"buy" | "sell">("buy");
  const [type,    setType]    = useState<"market" | "limit">("limit");
  const [qty,     setQty]     = useState("0.001");
  const [px,      setPx]      = useState("");
  const [loading, setLoading] = useState(false);
  const [flash,   setFlash]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [orders,  setOrders]  = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slEnabled,    setSlEnabled]    = useState(false);
  const [tpEnabled,    setTpEnabled]    = useState(false);
  const [slPct,        setSlPct]        = useState(2);
  const [tpPct,        setTpPct]        = useState(4);
  const [leverage,     setLeverage]     = useState(1);
  const [orderNote,    setOrderNote]    = useState("");

  const token  = useStore((s) => s.token);
  const ticks  = useStore((s) => s.ticks);
  const pnl    = useStore((s) => s.pnl);
  const systemConfig = useStore((s) => s.systemConfig);
  const { applyEvent, riskConfig } = useStore();

  // Binance tick'i — önce binance, yoksa herhangi bir borsa
  const tick = ticks[`${EXCHANGE}:${sym}`] ?? ticks[`okx:${sym}`];
  const currentPx = tick?.px;
  const up = (tick?.change ?? 0) >= 0;

  // Paper mod göstergesi
  const isPaperMode = systemConfig.paperTrading;

  useEffect(() => {
    if (currentPx && type === "limit" && !px) {
      setPx(currentPx.toFixed(2));
    }
  }, [sym]);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch { /* ignore */ }
    finally { setLoadingOrders(false); }
  }, [token]);

  useEffect(() => { loadOrders(); }, [token]);

  const entryPrice = type === "limit" ? Number(px) : (currentPx ?? 0);
  const slPrice = side === "buy"
    ? entryPrice * (1 - slPct / 100)
    : entryPrice * (1 + slPct / 100);
  const tpPrice = side === "buy"
    ? entryPrice * (1 + tpPct / 100)
    : entryPrice * (1 - tpPct / 100);

  const equity = pnl?.equity ?? 10000;
  const { positionValue, riskAmount, riskPct } = useMemo(
    () => calcRisk(Number(qty), entryPrice, slEnabled ? slPct : riskConfig.stopLossPct, equity),
    [qty, entryPrice, slPct, slEnabled, equity, riskConfig.stopLossPct]
  );

  const riskColor = riskPct > riskConfig.riskPerTradePct * 2
    ? "text-down"
    : riskPct > riskConfig.riskPerTradePct
    ? "text-amber-600"
    : "text-up";

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    setFlash(null);
    try {
      const result = await api.placeOrder({
        ex: EXCHANGE, sym, side, type, qty: Number(qty),
        px: type === "limit" ? Number(px) : currentPx ?? 0,
      });
      applyEvent({
        t: "order", id: result.id, ex: EXCHANGE, sym, side, type,
        qty: Number(qty),
        px: result.avgFillPx ?? (type === "limit" ? Number(px) : currentPx ?? 0),
        status: result.status, ts: Date.now(),
      });
      const paperTag = result.isPaper ? " [PAPER]" : "";
      const slTag    = slEnabled ? ` · SL: $${slPrice.toFixed(2)}` : "";
      const tpTag    = tpEnabled ? ` · TP: $${tpPrice.toFixed(2)}` : "";
      setFlash({ msg: `${side === "buy" ? "Alım" : "Satım"} emri iletildi${paperTag}${slTag}${tpTag}`, ok: true });
      await loadOrders();
    } catch (e) {
      setFlash({ msg: `Emir hatası: ${e instanceof Error ? e.message : "Bilinmeyen hata"}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const estimatedValue = useMemo(() => {
    const price = type === "limit" ? Number(px) : (currentPx ?? 0);
    return (Number(qty) * price * leverage).toFixed(2);
  }, [qty, px, type, currentPx, leverage]);

  const recentOrders = orders.slice(0, 20);
  const isPerpOrFutures = sym.includes("-PERP") || sym.includes("-MARGIN") || sym.match(/-\d{6}$/);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-text">Emir Gir</h1>
            {/* Paper/Live badge — her zaman görünür */}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
              isPaperMode
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-green-50 text-green-700 border-green-200"
            }`}>
              {isPaperMode ? "📄 PAPER" : "🔴 LIVE"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              Binance
            </span>
          </div>
          <p className="text-xs text-text-dim">CCXT Pro · Risk Kontrollü</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Shield size={12} className="text-accent" />
          <span className="text-text-dim">SL: <span className="font-semibold text-text">{riskConfig.stopLossPct}%</span></span>
          <span className="text-text-dim">Max Pos: <span className="font-semibold text-text">{riskConfig.maxOpenPositions}</span></span>
        </div>
      </div>

      {/* 3 sütun layout: Grafik/Fiyat | Orderbook | Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Sol: Fiyat + Emir Formu ── */}
        <div className="lg:col-span-1 space-y-3">
          {/* Price ticker */}
          {tick && (
            <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-text-dim mb-0.5 flex items-center gap-1.5">
                    <span className="font-semibold text-amber-600">{sym}</span>
                    <span className="text-text-dim">· Binance</span>
                  </div>
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
                <div className="flex gap-4 mt-2 text-xs text-text-dim flex-wrap">
                  {tick.high24h && <span>24h Yüksek: <span className="text-up font-mono">{tick.high24h.toFixed(2)}</span></span>}
                  {tick.low24h  && <span>24h Düşük: <span className="text-down font-mono">{tick.low24h.toFixed(2)}</span></span>}
                  {tick.vol24h  && <span>Hacim: <span className="text-text font-mono">${(tick.vol24h / 1e6).toFixed(0)}M</span></span>}
                  {tick.rsi     && (
                    <span>RSI: <span className={`font-mono font-semibold ${tick.rsi > 70 ? "text-down" : tick.rsi < 30 ? "text-up" : "text-text"}`}>{tick.rsi.toFixed(0)}</span></span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Emir Formu */}
          <div className="bg-bg-elev border border-line rounded-2xl p-4 shadow-card space-y-3">
            {/* Sembol seçici — borsa seçici yok */}
            <div className="space-y-1">
              <label className="text-xs text-text-dim font-medium">Sembol</label>
              <select
                value={sym}
                onChange={(e) => { setSym(e.target.value); setPx(""); }}
                className="w-full bg-bg-soft border border-line px-3 py-2 rounded-xl text-sm text-text outline-none focus:border-accent"
              >
                {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            {/* Side buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide("buy")}
                className={`py-3 rounded-xl font-bold text-sm transition ${
                  side === "buy" ? "bg-up text-white shadow-sm" : "bg-bg-soft text-text-dim border border-line hover:bg-line"
                }`}
              >
                AL (BUY)
              </button>
              <button
                onClick={() => setSide("sell")}
                className={`py-3 rounded-xl font-bold text-sm transition ${
                  side === "sell" ? "bg-down text-white shadow-sm" : "bg-bg-soft text-text-dim border border-line hover:bg-line"
                }`}
              >
                SAT (SELL)
              </button>
            </div>

            {/* Order type */}
            <div className="space-y-1">
              <label className="text-xs text-text-dim font-medium">Emir Tipi</label>
              <div className="flex gap-2">
                {(["limit", "market"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition border ${
                      type === t
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-bg-soft border-line text-text-dim hover:bg-line"
                    }`}
                  >
                    {t === "limit" ? "Limit" : "Market"}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            {type === "limit" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-dim font-medium">Fiyat (USDT)</label>
                  {currentPx && (
                    <button onClick={() => setPx(currentPx.toFixed(2))} className="text-[10px] text-accent hover:underline">
                      Piyasa fiyatı
                    </button>
                  )}
                </div>
                <input
                  value={px}
                  onChange={(e) => setPx(e.target.value)}
                  placeholder={currentPx ? currentPx.toFixed(2) : "0.00"}
                  className="w-full bg-bg-soft border border-line px-3 py-2 rounded-xl font-mono text-sm text-text outline-none focus:border-accent"
                />
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-1">
              <label className="text-xs text-text-dim font-medium">Miktar</label>
              <div className="flex gap-2">
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="0.001"
                  className="flex-1 bg-bg-soft border border-line px-3 py-2 rounded-xl font-mono text-sm text-text outline-none focus:border-accent"
                />
                <div className="flex gap-1">
                  {["25%", "50%", "75%", "100%"].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        const base = 0.1;
                        const factor = parseInt(pct) / 100;
                        setQty((base * factor).toFixed(4));
                      }}
                      className="text-[10px] px-1.5 py-1 rounded-lg bg-bg-soft border border-line text-text-dim hover:bg-line transition"
                    >
                      {pct}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Risk özeti */}
            {entryPrice > 0 && Number(qty) > 0 && (
              <div className="bg-bg-soft rounded-xl p-3 border border-line space-y-1.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 size={11} className="text-accent" />
                  <span className="text-[11px] font-semibold text-text-dim">Risk Analizi</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-text-dim">Pozisyon</div>
                    <div className="font-mono font-semibold text-text">${positionValue.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-text-dim">Risk</div>
                    <div className={`font-mono font-semibold ${riskColor}`}>${riskAmount.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-text-dim">Risk %</div>
                    <div className={`font-mono font-semibold ${riskColor}`}>{riskPct.toFixed(2)}%</div>
                  </div>
                </div>
                {riskPct > riskConfig.riskPerTradePct && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-1">
                    <AlertCircle size={10} />
                    Risk limiti aşılıyor (max %{riskConfig.riskPerTradePct})
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-text-dim px-1">
              <span>Tahmini: <span className="font-mono text-text">${estimatedValue} USDT</span></span>
              <span>Min: 0.001</span>
            </div>

            {/* Gelişmiş */}
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-bg-soft border border-line text-xs text-text-dim hover:bg-line transition"
            >
              <span className="flex items-center gap-1.5"><Shield size={11} />SL / TP / Kaldıraç</span>
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showAdvanced && (
              <div className="space-y-3 bg-bg-soft rounded-xl p-3 border border-line">
                {/* Stop-Loss */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-text cursor-pointer">
                      <input type="checkbox" checked={slEnabled} onChange={(e) => setSlEnabled(e.target.checked)} className="accent-red-500 w-3.5 h-3.5" />
                      <span className="text-down">Stop-Loss</span>
                    </label>
                    {slEnabled && entryPrice > 0 && (
                      <span className="text-[10px] font-mono text-down">${slPrice.toFixed(2)}</span>
                    )}
                  </div>
                  {slEnabled && (
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.1} max={10} step={0.1} value={slPct}
                        onChange={(e) => setSlPct(Number(e.target.value))} className="flex-1 accent-red-500" />
                      <span className="text-xs font-mono text-down w-10 text-right">{slPct}%</span>
                    </div>
                  )}
                </div>

                {/* Take-Profit */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-text cursor-pointer">
                      <input type="checkbox" checked={tpEnabled} onChange={(e) => setTpEnabled(e.target.checked)} className="accent-green-500 w-3.5 h-3.5" />
                      <span className="text-up">Take-Profit</span>
                    </label>
                    {tpEnabled && entryPrice > 0 && (
                      <span className="text-[10px] font-mono text-up">${tpPrice.toFixed(2)}</span>
                    )}
                  </div>
                  {tpEnabled && (
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.5} max={30} step={0.5} value={tpPct}
                        onChange={(e) => setTpPct(Number(e.target.value))} className="flex-1 accent-green-500" />
                      <span className="text-xs font-mono text-up w-10 text-right">{tpPct}%</span>
                    </div>
                  )}
                </div>

                {slEnabled && tpEnabled && (
                  <div className="flex items-center justify-between text-xs bg-bg-elev rounded-lg px-2 py-1.5 border border-line">
                    <span className="text-text-dim flex items-center gap-1"><Target size={10} /> Risk/Ödül</span>
                    <span className="font-semibold text-accent">1:{(tpPct / slPct).toFixed(2)}</span>
                  </div>
                )}

                {/* Kaldıraç — sadece perp/futures */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-text flex items-center gap-1.5">
                      <Zap size={11} className="text-amber-500" />
                      Kaldıraç
                      {!isPerpOrFutures && <span className="text-[9px] text-text-dim">(spot için 1x)</span>}
                    </label>
                    <span className="text-xs font-mono font-bold text-accent">{leverage}x</span>
                  </div>
                  <input
                    type="range" min={1} max={isPerpOrFutures ? 100 : 1} step={1} value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full accent-amber-500"
                    disabled={!isPerpOrFutures}
                  />
                  {leverage > 10 && (
                    <div className="flex items-center gap-1 text-[10px] text-down">
                      <AlertCircle size={9} /> Yüksek kaldıraç — likidasyona dikkat
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-text-dim">Emir Notu</label>
                  <input
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Strateji notu..."
                    className="w-full mt-1 bg-bg-elev border border-line px-3 py-1.5 rounded-xl text-xs text-text outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}

            {flash && (
              <div className={`text-sm px-3 py-2.5 rounded-xl flex items-center gap-2 ${
                flash.ok ? "bg-up/10 text-up border border-up/20" : "bg-down/10 text-down border border-down/20"
              }`}>
                {flash.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {flash.msg}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition disabled:opacity-60 ${
                side === "buy"
                  ? "bg-up text-white hover:brightness-110 shadow-sm"
                  : "bg-down text-white hover:brightness-110 shadow-sm"
              }`}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> İşleniyor...</span>
                : `${side === "buy" ? "AL" : "SAT"} — ${qty} ${sym.replace("USDT", "")}${leverage > 1 ? ` (${leverage}x)` : ""}`}
            </button>

            <p className="text-[10px] text-text-dim text-center">
              {isPaperMode ? "📄 Paper mod — emirler simüle edilir" : "🔴 Live mod — gerçek emir gönderilir"}
            </p>
          </div>
        </div>

        {/* ── Orta: Orderbook ── */}
        <div className="lg:col-span-1">
          {currentPx ? (
            <Orderbook
              midPrice={currentPx}
              onPriceClick={(p) => { if (type === "limit") setPx(p.toFixed(2)); }}
            />
          ) : (
            <div className="bg-bg-elev border border-line rounded-2xl p-8 text-center text-text-dim shadow-card">
              <BarChart3 size={28} className="mx-auto mb-2 opacity-30" />
              <div className="text-sm">Orderbook yükleniyor...</div>
            </div>
          )}
        </div>

        {/* ── Sağ: Emir Geçmişi ── */}
        <div className="lg:col-span-1 bg-bg-elev border border-line rounded-2xl shadow-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-text-dim" />
              <span className="text-sm font-bold text-text">Emir Geçmişi</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-bg-soft text-text-dim border border-line">
                {orders.length}
              </span>
            </div>
            <button
              onClick={loadOrders}
              disabled={loadingOrders}
              className="p-1.5 rounded-lg hover:bg-bg-soft text-text-dim transition disabled:opacity-50"
            >
              {loadingOrders ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>

          {orders.length > 0 && (
            <div className="px-4 py-2 border-b border-line bg-bg-soft/50 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="font-semibold text-up">{orders.filter((o) => o.status === "filled").length}</div>
                <div className="text-text-dim">Dolu</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-amber-600">{orders.filter((o) => o.status === "open" || o.status === "pending").length}</div>
                <div className="text-text-dim">Açık</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-down">{orders.filter((o) => o.status === "cancelled" || o.status === "rejected").length}</div>
                <div className="text-text-dim">İptal</div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto divide-y divide-line">
            {recentOrders.length === 0 && (
              <div className="px-4 py-12 text-center text-text-dim text-sm">
                <Clock size={28} className="mx-auto mb-2 opacity-30" />
                <div>Henüz emir yok</div>
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
