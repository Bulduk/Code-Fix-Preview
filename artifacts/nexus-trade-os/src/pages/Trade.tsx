import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/lib/store";
import { api, OrderRecord } from "@/lib/api";

function getSearchParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

const STATUS_COLORS: Record<string, string> = {
  filled:    "badge-up",
  open:      "bg-[var(--color-accent2)]/10 text-[var(--color-accent2)] border border-[var(--color-accent2)]/20",
  pending:   "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20",
  cancelled: "badge-neutral",
  rejected:  "badge-down",
  partial:   "bg-purple-500/10 text-purple-400 border border-purple-500/20",
};

const EXCHANGE = "binance";

const SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "ADAUSDT", "DOGEUSDT", "LINKUSDT", "ARBUSDT", "MATICUSDT",
  "AAVEUSDT", "UNIUSDT", "OPUSDT",
];

function generateOrderbook(midPrice: number) {
  const asks: { px: number; qty: number; total: number }[] = [];
  const bids: { px: number; qty: number; total: number }[] = [];
  let askTotal = 0;
  let bidTotal = 0;
  for (let i = 0; i < 12; i++) {
    const spread = midPrice * 0.00008 * (i + 1);
    const askPx  = midPrice + spread;
    const bidPx  = midPrice - spread;
    const askQty = Number((Math.random() * 2.5 + 0.05).toFixed(4));
    const bidQty = Number((Math.random() * 2.5 + 0.05).toFixed(4));
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
    <div className="card overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2.5 border-b border-[var(--color-line)] flex items-center justify-between shrink-0">
        <span className="text-sm font-bold text-[var(--color-text)]">Orderbook</span>
        <span className="text-[10px] text-[var(--color-text-muted)] font-semibold">Binance · Simüle</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider border-b border-[var(--color-line)] shrink-0">
        <span>Fiyat</span>
        <span className="text-right">Miktar</span>
        <span className="text-right">Toplam</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col font-num text-[11px]">
        {/* Asks — reversed */}
        <div className="flex-1 overflow-hidden flex flex-col justify-end">
          {[...asks].reverse().map((a, i) => (
            <div
              key={i}
              onClick={() => onPriceClick(a.px)}
              className="relative grid grid-cols-3 px-3 py-[3px] cursor-pointer hover:bg-[var(--color-down)]/5 transition"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-[var(--color-down)]/10"
                style={{ width: `${(a.total / maxTotal) * 100}%` }}
              />
              <span className="text-[var(--color-down)] relative z-10 font-semibold">{a.px.toFixed(2)}</span>
              <span className="text-right text-[var(--color-text)] relative z-10">{a.qty.toFixed(4)}</span>
              <span className="text-right text-[var(--color-text-muted)] relative z-10">{a.total.toFixed(3)}</span>
            </div>
          ))}
        </div>

        {/* Spread / Mid price */}
        <div className="px-3 py-2 bg-[var(--color-bg-soft)] border-y border-[var(--color-line)] flex items-center justify-between shrink-0">
          <span className="text-base font-black text-[var(--color-text)] font-num">{midPrice.toFixed(2)}</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">Son Fiyat</span>
        </div>

        {/* Bids */}
        <div className="flex-1 overflow-hidden">
          {bids.map((b, i) => (
            <div
              key={i}
              onClick={() => onPriceClick(b.px)}
              className="relative grid grid-cols-3 px-3 py-[3px] cursor-pointer hover:bg-[var(--color-up)]/5 transition"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-[var(--color-up)]/10"
                style={{ width: `${(b.total / maxTotal) * 100}%` }}
              />
              <span className="text-[var(--color-up)] relative z-10 font-semibold">{b.px.toFixed(2)}</span>
              <span className="text-right text-[var(--color-text)] relative z-10">{b.qty.toFixed(4)}</span>
              <span className="text-right text-[var(--color-text-muted)] relative z-10">{b.total.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

  const token        = useStore((s) => s.token);
  const ticks        = useStore((s) => s.ticks);
  const pnl          = useStore((s) => s.pnl);
  const systemConfig = useStore((s) => s.systemConfig);
  const { applyEvent, riskConfig } = useStore();

  const tick      = ticks[`${EXCHANGE}:${sym}`] ?? ticks[`okx:${sym}`];
  const currentPx = tick?.px;
  const up        = (tick?.change ?? 0) >= 0;
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
  const slPrice = side === "buy" ? entryPrice * (1 - slPct / 100) : entryPrice * (1 + slPct / 100);
  const tpPrice = side === "buy" ? entryPrice * (1 + tpPct / 100) : entryPrice * (1 - tpPct / 100);

  const equity = pnl?.equity ?? 10000;
  const { positionValue, riskAmount, riskPct } = useMemo(
    () => calcRisk(Number(qty), entryPrice, slEnabled ? slPct : riskConfig.stopLossPct, equity),
    [qty, entryPrice, slPct, slEnabled, equity, riskConfig.stopLossPct]
  );

  const riskColor = riskPct > riskConfig.riskPerTradePct * 2
    ? "text-[var(--color-down)]"
    : riskPct > riskConfig.riskPerTradePct
    ? "text-[var(--color-accent)]"
    : "text-[var(--color-up)]";

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
      setFlash({ msg: `${side === "buy" ? "Alım" : "Satım"} emri iletildi${paperTag}`, ok: true });
      await loadOrders();
    } catch (e) {
      setFlash({ msg: `Hata: ${e instanceof Error ? e.message : "Bilinmeyen hata"}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const estimatedValue = useMemo(() => {
    const price = type === "limit" ? Number(px) : (currentPx ?? 0);
    return (Number(qty) * price * leverage).toFixed(2);
  }, [qty, px, type, currentPx, leverage]);

  const recentOrders = orders.slice(0, 20);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[var(--color-text)]">Emir Gir</h1>
            <span className={`text-[10px] px-2 py-1 rounded-lg font-bold border ${
              isPaperMode
                ? "bg-[var(--color-accent2)]/10 text-[var(--color-accent2)] border-[var(--color-accent2)]/20"
                : "bg-[var(--color-up)]/10 text-[var(--color-up)] border-[var(--color-up)]/20"
            }`}>
              {isPaperMode ? "PAPER" : "LIVE"}
            </span>
            <span className="text-[10px] px-2 py-1 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 font-bold">
              Binance
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-dim)] mt-0.5">CCXT Pro · Risk Kontrollü</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-dim)]">
          <span>SL: <span className="font-bold text-[var(--color-text)] font-num">{riskConfig.stopLossPct}%</span></span>
          <span>Max Pos: <span className="font-bold text-[var(--color-text)] font-num">{riskConfig.maxOpenPositions}</span></span>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Col 1: Order Form ── */}
        <div className="space-y-3">

          {/* Price ticker */}
          {tick && (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--color-text-dim)] mb-1 font-semibold">{sym} · Binance</div>
                  <div className="text-2xl font-black font-num text-[var(--color-text)]">
                    {tick.px < 1 ? tick.px.toFixed(4) : tick.px.toFixed(2)}
                    <span className="text-sm font-normal text-[var(--color-text-dim)] ml-1">USDT</span>
                  </div>
                </div>
                <div className={`text-sm font-bold font-num px-3 py-1.5 rounded-xl ${
                  up
                    ? "bg-[var(--color-up)]/10 text-[var(--color-up)]"
                    : "bg-[var(--color-down)]/10 text-[var(--color-down)]"
                }`}>
                  {up ? "+" : ""}{((tick.change ?? 0) * 100).toFixed(2)}%
                </div>
              </div>
              {(tick.high24h || tick.low24h || tick.vol24h) && (
                <div className="flex gap-3 mt-3 text-[10px] text-[var(--color-text-muted)] flex-wrap">
                  {tick.high24h && <span>H: <span className="text-[var(--color-up)] font-num font-semibold">{tick.high24h.toFixed(2)}</span></span>}
                  {tick.low24h  && <span>L: <span className="text-[var(--color-down)] font-num font-semibold">{tick.low24h.toFixed(2)}</span></span>}
                  {tick.vol24h  && <span>Vol: <span className="text-[var(--color-text)] font-num font-semibold">${(tick.vol24h / 1e6).toFixed(0)}M</span></span>}
                  {tick.rsi     && <span>RSI: <span className={`font-num font-bold ${tick.rsi > 70 ? "text-[var(--color-down)]" : tick.rsi < 30 ? "text-[var(--color-up)]" : "text-[var(--color-text)]"}`}>{tick.rsi.toFixed(0)}</span></span>}
                </div>
              )}
            </div>
          )}

          {/* Order Form */}
          <div className="card p-4 space-y-3">

            {/* Symbol */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-[var(--color-text-dim)] font-semibold uppercase tracking-wider">Sembol</label>
              <select
                value={sym}
                onChange={(e) => { setSym(e.target.value); setPx(""); }}
                className="w-full bg-[var(--color-bg-soft)] border border-[var(--color-line)] px-3 py-2.5 rounded-xl text-sm text-[var(--color-text)] font-num font-semibold"
              >
                {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            {/* Buy / Sell */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide("buy")}
                className={`py-3 rounded-xl font-black text-sm transition ${
                  side === "buy"
                    ? "bg-[var(--color-up)] text-white shadow-[0_4px_16px_rgba(14,203,129,0.3)]"
                    : "bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] border border-[var(--color-line)] hover:bg-[var(--color-line)]"
                }`}
              >
                AL (BUY)
              </button>
              <button
                onClick={() => setSide("sell")}
                className={`py-3 rounded-xl font-black text-sm transition ${
                  side === "sell"
                    ? "bg-[var(--color-down)] text-white shadow-[0_4px_16px_rgba(246,70,93,0.3)]"
                    : "bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] border border-[var(--color-line)] hover:bg-[var(--color-line)]"
                }`}
              >
                SAT (SELL)
              </button>
            </div>

            {/* Order type */}
            <div className="flex gap-2">
              {(["limit", "market"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                    type === t
                      ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 text-[var(--color-accent)]"
                      : "bg-[var(--color-bg-soft)] border-[var(--color-line)] text-[var(--color-text-dim)] hover:bg-[var(--color-line)]"
                  }`}
                >
                  {t === "limit" ? "Limit" : "Market"}
                </button>
              ))}
            </div>

            {/* Price */}
            {type === "limit" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-[var(--color-text-dim)] font-semibold uppercase tracking-wider">Fiyat (USDT)</label>
                  {currentPx && (
                    <button onClick={() => setPx(currentPx.toFixed(2))} className="text-[10px] text-[var(--color-accent)] hover:underline font-semibold">
                      Piyasa fiyatı
                    </button>
                  )}
                </div>
                <input
                  value={px}
                  onChange={(e) => setPx(e.target.value)}
                  placeholder={currentPx ? currentPx.toFixed(2) : "0.00"}
                  className="w-full bg-[var(--color-bg-soft)] border border-[var(--color-line)] px-3 py-2.5 rounded-xl font-num text-sm text-[var(--color-text)]"
                />
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-[var(--color-text-dim)] font-semibold uppercase tracking-wider">Miktar</label>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.001"
                className="w-full bg-[var(--color-bg-soft)] border border-[var(--color-line)] px-3 py-2.5 rounded-xl font-num text-sm text-[var(--color-text)]"
              />
              <div className="flex gap-1.5">
                {["25%", "50%", "75%", "100%"].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      const factor = parseInt(pct) / 100;
                      setQty((0.1 * factor).toFixed(4));
                    }}
                    className="flex-1 text-[10px] py-1.5 rounded-lg bg-[var(--color-bg-soft)] border border-[var(--color-line)] text-[var(--color-text-dim)] hover:bg-[var(--color-line)] hover:text-[var(--color-text)] transition font-semibold"
                  >
                    {pct}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk summary */}
            {entryPrice > 0 && Number(qty) > 0 && (
              <div className="bg-[var(--color-bg-soft)] rounded-xl p-3 border border-[var(--color-line)]">
                <div className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider mb-2">Risk Analizi</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[var(--color-text-muted)]">Pozisyon</div>
                    <div className="font-num font-bold text-[var(--color-text)]">${positionValue.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-muted)]">Risk $</div>
                    <div className={`font-num font-bold ${riskColor}`}>${riskAmount.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-muted)]">Risk %</div>
                    <div className={`font-num font-bold ${riskColor}`}>{riskPct.toFixed(2)}%</div>
                  </div>
                </div>
                {riskPct > riskConfig.riskPerTradePct && (
                  <div className="flex items-center gap-1 text-[10px] text-[var(--color-accent)] mt-2 font-semibold">
                    ⚠ Risk limiti aşılıyor (max %{riskConfig.riskPerTradePct})
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] px-0.5">
              <span>Tahmini: <span className="font-num font-semibold text-[var(--color-text)]">${estimatedValue} USDT</span></span>
              <span>Min: 0.001</span>
            </div>

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--color-bg-soft)] border border-[var(--color-line)] text-xs text-[var(--color-text-dim)] hover:bg-[var(--color-line)] transition"
            >
              <span className="font-semibold">SL / TP / Kaldıraç</span>
              <span>{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-3 bg-[var(--color-bg-soft)] rounded-xl p-3 border border-[var(--color-line)]">
                {/* Stop-Loss */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] cursor-pointer">
                      <input type="checkbox" checked={slEnabled} onChange={(e) => setSlEnabled(e.target.checked)} className="accent-[var(--color-down)] w-3.5 h-3.5" />
                      <span className="text-[var(--color-down)]">Stop-Loss</span>
                    </label>
                    {slEnabled && entryPrice > 0 && (
                      <span className="text-[10px] font-num font-bold text-[var(--color-down)]">${slPrice.toFixed(2)}</span>
                    )}
                  </div>
                  {slEnabled && (
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.1} max={10} step={0.1} value={slPct}
                        onChange={(e) => setSlPct(Number(e.target.value))} className="flex-1 accent-[var(--color-down)]" />
                      <span className="text-xs font-num font-bold text-[var(--color-down)] w-10 text-right">{slPct}%</span>
                    </div>
                  )}
                </div>

                {/* Take-Profit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] cursor-pointer">
                      <input type="checkbox" checked={tpEnabled} onChange={(e) => setTpEnabled(e.target.checked)} className="accent-[var(--color-up)] w-3.5 h-3.5" />
                      <span className="text-[var(--color-up)]">Take-Profit</span>
                    </label>
                    {tpEnabled && entryPrice > 0 && (
                      <span className="text-[10px] font-num font-bold text-[var(--color-up)]">${tpPrice.toFixed(2)}</span>
                    )}
                  </div>
                  {tpEnabled && (
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.5} max={30} step={0.5} value={tpPct}
                        onChange={(e) => setTpPct(Number(e.target.value))} className="flex-1 accent-[var(--color-up)]" />
                      <span className="text-xs font-num font-bold text-[var(--color-up)] w-10 text-right">{tpPct}%</span>
                    </div>
                  )}
                </div>

                {slEnabled && tpEnabled && (
                  <div className="flex items-center justify-between text-xs bg-[var(--color-bg-elev)] rounded-lg px-3 py-2 border border-[var(--color-line)]">
                    <span className="text-[var(--color-text-dim)] font-semibold">Risk/Ödül</span>
                    <span className="font-bold font-num text-[var(--color-accent)]">1:{(tpPct / slPct).toFixed(2)}</span>
                  </div>
                )}

                {/* Leverage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-text)]">Kaldıraç</span>
                    <span className="text-xs font-num font-bold text-[var(--color-accent)]">{leverage}x</span>
                  </div>
                  <input type="range" min={1} max={20} step={1} value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
                  <div className="flex justify-between text-[9px] text-[var(--color-text-muted)]">
                    <span>1x</span><span>5x</span><span>10x</span><span>20x</span>
                  </div>
                </div>
              </div>
            )}

            {/* Flash message */}
            {flash && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                flash.ok
                  ? "bg-[var(--color-up)]/10 text-[var(--color-up)] border border-[var(--color-up)]/20"
                  : "bg-[var(--color-down)]/10 text-[var(--color-down)] border border-[var(--color-down)]/20"
              }`}>
                <span>{flash.ok ? "✓" : "✕"}</span>
                {flash.msg}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={submit}
              disabled={loading || !token}
              className={`w-full py-3.5 rounded-xl font-black text-base transition disabled:opacity-60 disabled:cursor-not-allowed ${
                side === "buy"
                  ? "bg-[var(--color-up)] text-white hover:brightness-110 shadow-[0_4px_20px_rgba(14,203,129,0.3)]"
                  : "bg-[var(--color-down)] text-white hover:brightness-110 shadow-[0_4px_20px_rgba(246,70,93,0.3)]"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
                  </svg>
                  İşleniyor...
                </span>
              ) : (
                `${side === "buy" ? "AL" : "SAT"} — ${qty} ${sym.replace("USDT", "")}`
              )}
            </button>
          </div>
        </div>

        {/* ── Col 2: Orderbook ── */}
        <div className="min-h-[500px]">
          {currentPx ? (
            <Orderbook midPrice={currentPx} onPriceClick={(p) => { if (type === "limit") setPx(p.toFixed(2)); }} />
          ) : (
            <div className="card h-full flex items-center justify-center text-[var(--color-text-dim)] text-sm">
              <div className="text-center">
                <div className="text-3xl mb-3">📊</div>
                Fiyat verisi bekleniyor...
              </div>
            </div>
          )}
        </div>

        {/* ── Col 3: Order History ── */}
        <div className="card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-line)] shrink-0">
            <span className="text-sm font-bold text-[var(--color-text)]">Emir Geçmişi</span>
            <button
              onClick={loadOrders}
              disabled={loadingOrders}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg-soft)] text-[var(--color-text-dim)] transition disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={loadingOrders ? "animate-spin" : ""}>
                <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <polyline points="14,2 14,8 8,8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Column headers */}
          <div className="grid px-4 py-2 text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider border-b border-[var(--color-line)] shrink-0"
            style={{ gridTemplateColumns: "60px 1fr 80px 70px" }}>
            <span>Yön</span>
            <span>Sembol</span>
            <span className="text-right">Fiyat</span>
            <span className="text-right">Durum</span>
          </div>

          <div className="flex-1 overflow-auto divide-y divide-[var(--color-line)]">
            {recentOrders.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-[var(--color-text-dim)]">
                <div className="text-2xl mb-2">📋</div>
                Emir yok
              </div>
            )}
            {recentOrders.map((o) => (
              <div key={o.id} className="grid px-4 py-2.5 items-center hover:bg-[var(--color-bg-soft)] transition"
                style={{ gridTemplateColumns: "60px 1fr 80px 70px" }}>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${
                  o.side === "buy" ? "badge-up" : "badge-down"
                }`}>
                  {o.side.toUpperCase()}
                </span>
                <div>
                  <div className="text-xs font-bold font-num text-[var(--color-text)]">{o.sym}</div>
                  <div className="text-[9px] text-[var(--color-text-muted)]">{o.exchange} · {o.qty}</div>
                </div>
                <div className="text-right text-xs font-num font-semibold text-[var(--color-text)]">
                  ${o.px.toFixed(2)}
                </div>
                <div className="text-right">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${STATUS_COLORS[o.status] ?? "badge-neutral"}`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
