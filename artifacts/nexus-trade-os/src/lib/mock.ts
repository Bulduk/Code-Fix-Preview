import { useStore } from "./store";

const PAIRS = [
  { ex: "binance", sym: "BTCUSDT", base: 67420 },
  { ex: "binance", sym: "ETHUSDT", base: 3520 },
  { ex: "binance", sym: "SOLUSDT", base: 178 },
  { ex: "binance", sym: "BNBUSDT", base: 605 },
  { ex: "bybit",   sym: "BTCUSDT", base: 67415 },
  { ex: "bybit",   sym: "ETHUSDT", base: 3518 },
  { ex: "okx",     sym: "BTCUSDT", base: 67422 },
  { ex: "okx",     sym: "SOLUSDT", base: 177.8 },
  { ex: "binance", sym: "XRPUSDT", base: 0.62 },
  { ex: "binance", sym: "ADAUSDT", base: 0.48 },
  { ex: "binance", sym: "DOGEUSDT", base: 0.165 },
  { ex: "binance", sym: "LTCUSDT", base: 85 },
];

const STRATEGIES = ["scalping", "momentum", "meanreversion", "breakout", "grid"];

let sigId = 0;

export function startMockFeed() {
  const { applyEvent } = useStore.getState();

  // Seed prices
  PAIRS.forEach(({ ex, sym, base }) => {
    applyEvent({ t: "tick", ex, sym, px: base + (Math.random() - 0.5) * base * 0.001, ts: Date.now() });
  });

  // Seed positions
  applyEvent({ t: "position", ex: "binance", sym: "BTCUSDT", side: "long", qty: 0.05, entry: 65100, mark: 67420, pnl: 116 });
  applyEvent({ t: "position", ex: "bybit", sym: "ETHUSDT", side: "long", qty: 0.5, entry: 3480, mark: 3520, pnl: 20 });
  applyEvent({ t: "pnl", equity: 12450.36, realized: 240.12, unrealized: 136.0 });

  // Tick updates
  const tickInterval = setInterval(() => {
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const currentPx = useStore.getState().ticks[`${pair.ex}:${pair.sym}`]?.px ?? pair.base;
    const newPx = currentPx * (1 + (Math.random() - 0.495) * 0.0015);
    applyEvent({ t: "tick", ex: pair.ex, sym: pair.sym, px: Number(newPx.toFixed(6)), ts: Date.now() });
  }, 400);

  // Signals
  const sigInterval = setInterval(() => {
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const s: Record<string, unknown> = {
      t: "signal",
      id: `s${++sigId}`,
      strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
      ex: pair.ex,
      sym: pair.sym,
      side: Math.random() > 0.5 ? "buy" : "sell",
      strength: 0.55 + Math.random() * 0.4,
      ts: Date.now(),
    };
    applyEvent(s);
  }, 2800);

  // PnL drift
  const pnlInterval = setInterval(() => {
    const cur = useStore.getState().pnl ?? { equity: 12450, realized: 240, unrealized: 136 };
    applyEvent({
      t: "pnl",
      equity: cur.equity + (Math.random() - 0.48) * 3,
      realized: cur.realized + (Math.random() > 0.8 ? (Math.random() - 0.4) * 2 : 0),
      unrealized: cur.unrealized + (Math.random() - 0.5) * 5,
    });
  }, 3000);

  return () => {
    clearInterval(tickInterval);
    clearInterval(sigInterval);
    clearInterval(pnlInterval);
  };
}
