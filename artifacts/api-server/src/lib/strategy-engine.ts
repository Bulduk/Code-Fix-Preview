/**
 * Nexus Trade OS — Strategy Engine
 * Real strategy execution with hot-reload, signal scoring, multi-timeframe.
 * Built-in strategies: EMA Trend, RSI Pullback, Breakout, Scalping, AI Hybrid.
 */

import { EventEmitter } from "events";
import { logger } from "./logger.js";
import { scoreSignal, type OHLCV, type SignalScore } from "./indicators.js";
import { getGateway, type BinanceFuturesGateway } from "./binance-futures.js";
import { db } from "@workspace/db";
import { strategiesTable, signalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────

export interface StrategyParams {
  timeframe: string;
  symbol: string;
  stopLossPct: number;
  takeProfitPct: number;
  riskPerTradePct: number;
  maxPositions: number;
  leverage?: number;
  // Indicator params
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  emaFast?: number;
  emaSlow?: number;
  bbPeriod?: number;
  atrPeriod?: number;
  // Strategy-specific
  lookback?: number;
  zScore?: number;
  gridLevels?: number;
  minSpread?: number;
  trailingStopPct?: number;
  signalThreshold?: number;
}

export interface StrategySignal {
  strategyId: string;
  strategyName: string;
  exchangeId: string;
  symbol: string;
  side: "buy" | "sell";
  strength: number;
  confidence: number;
  reasons: string[];
  indicators: Record<string, number>;
  suggestedEntry: number;
  suggestedSL: number;
  suggestedTP: number;
  suggestedQty: number;
  ts: number;
}

export interface StrategyState {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  exchangeId: string;
  params: StrategyParams;
  lastSignal: StrategySignal | null;
  lastRun: number;
  runCount: number;
  signalCount: number;
  errorCount: number;
  status: "idle" | "running" | "error" | "stopped";
}

// ── Built-in Strategy Implementations ────────────────────────────────────

type StrategyFn = (
  candles: OHLCV[],
  params: StrategyParams,
  currentPrice: number
) => { signal: SignalScore; entry: number; sl: number; tp: number; qty: number } | null;

const STRATEGIES: Record<string, StrategyFn> = {

  // EMA Trend Following
  ema_trend: (candles, params, price) => {
    if (candles.length < 50) return null;
    const signal = scoreSignal(candles, {
      emaFast: params.emaFast ?? 9,
      emaSlow: params.emaSlow ?? 21,
      rsiPeriod: params.rsiPeriod ?? 14,
      atrPeriod: params.atrPeriod ?? 14,
    });
    if (signal.direction === "neutral" || signal.strength < (params.signalThreshold ?? 0.4)) return null;

    const atrVal = signal.indicators["atr"] ?? price * 0.01;
    const sl = signal.direction === "buy"
      ? price - atrVal * 2
      : price + atrVal * 2;
    const tp = signal.direction === "buy"
      ? price + atrVal * 3
      : price - atrVal * 3;

    return { signal, entry: price, sl, tp, qty: 0 };
  },

  // RSI Pullback
  rsi_pullback: (candles, params, price) => {
    if (candles.length < 30) return null;
    const signal = scoreSignal(candles, {
      rsiPeriod: params.rsiPeriod ?? 14,
      rsiOversold: params.rsiOversold ?? 30,
      rsiOverbought: params.rsiOverbought ?? 70,
      emaFast: params.emaFast ?? 20,
      emaSlow: params.emaSlow ?? 50,
    });

    const rsi = signal.indicators["rsi"];
    if (isNaN(rsi)) return null;

    // Only trade pullbacks in trend direction
    const emaFast = signal.indicators["emaFast"];
    const emaSlow = signal.indicators["emaSlow"];
    const inUptrend = !isNaN(emaFast) && !isNaN(emaSlow) && emaFast > emaSlow;
    const inDowntrend = !isNaN(emaFast) && !isNaN(emaSlow) && emaFast < emaSlow;

    if (inUptrend && rsi < (params.rsiOversold ?? 35)) {
      const sl = price * (1 - params.stopLossPct / 100);
      const tp = price * (1 + params.takeProfitPct / 100);
      return { signal: { ...signal, direction: "buy" }, entry: price, sl, tp, qty: 0 };
    }
    if (inDowntrend && rsi > (params.rsiOverbought ?? 65)) {
      const sl = price * (1 + params.stopLossPct / 100);
      const tp = price * (1 - params.takeProfitPct / 100);
      return { signal: { ...signal, direction: "sell" }, entry: price, sl, tp, qty: 0 };
    }
    return null;
  },

  // Breakout Strategy
  breakout: (candles, params, price) => {
    const lookback = params.lookback ?? 20;
    if (candles.length < lookback + 5) return null;

    const recent = candles.slice(-lookback - 1, -1);
    const highestHigh = Math.max(...recent.map((c) => c.high));
    const lowestLow = Math.min(...recent.map((c) => c.low));
    const lastCandle = candles[candles.length - 1];

    const signal = scoreSignal(candles, {
      volumePeriod: 20,
      atrPeriod: params.atrPeriod ?? 14,
    });

    const volRatio = signal.indicators["volumeRatio"];
    const hasVolumeConfirmation = !isNaN(volRatio) && volRatio > 1.3;

    if (lastCandle.close > highestHigh && hasVolumeConfirmation) {
      const atr = signal.indicators["atr"] ?? price * 0.01;
      const sl = highestHigh - atr;
      const tp = price + (price - sl) * 2;
      return {
        signal: { ...signal, direction: "buy", strength: 0.75, reasons: [`Breakout above ${highestHigh.toFixed(2)} with volume`] },
        entry: price, sl, tp, qty: 0,
      };
    }

    if (lastCandle.close < lowestLow && hasVolumeConfirmation) {
      const atr = signal.indicators["atr"] ?? price * 0.01;
      const sl = lowestLow + atr;
      const tp = price - (sl - price) * 2;
      return {
        signal: { ...signal, direction: "sell", strength: 0.75, reasons: [`Breakdown below ${lowestLow.toFixed(2)} with volume`] },
        entry: price, sl, tp, qty: 0,
      };
    }

    return null;
  },

  // Scalping (1m/3m timeframe)
  scalping: (candles, params, price) => {
    if (candles.length < 20) return null;
    const signal = scoreSignal(candles, {
      rsiPeriod: 7,
      rsiOversold: 25,
      rsiOverbought: 75,
      emaFast: 5,
      emaSlow: 13,
      bbPeriod: 14,
    });

    if (signal.direction === "neutral" || signal.strength < 0.5) return null;

    const atr = signal.indicators["atr"] ?? price * 0.005;
    const sl = signal.direction === "buy" ? price - atr * 1.5 : price + atr * 1.5;
    const tp = signal.direction === "buy" ? price + atr * 2 : price - atr * 2;

    return { signal, entry: price, sl, tp, qty: 0 };
  },

  // Mean Reversion
  meanreversion: (candles, params, price) => {
    if (candles.length < 30) return null;
    const signal = scoreSignal(candles, {
      bbPeriod: params.bbPeriod ?? 20,
      rsiPeriod: params.rsiPeriod ?? 14,
    });

    const percentB = signal.indicators["percentB"];
    const rsiVal = signal.indicators["rsi"];

    if (isNaN(percentB) || isNaN(rsiVal)) return null;

    // Buy when price is below lower BB and RSI is oversold
    if (percentB < 0.1 && rsiVal < 35) {
      const bbMiddle = signal.indicators["bbMiddle"];
      const sl = price * (1 - params.stopLossPct / 100);
      const tp = isNaN(bbMiddle) ? price * (1 + params.takeProfitPct / 100) : bbMiddle;
      return {
        signal: { ...signal, direction: "buy", strength: 0.7, reasons: ["Price below BB lower, RSI oversold"] },
        entry: price, sl, tp, qty: 0,
      };
    }

    // Sell when price is above upper BB and RSI is overbought
    if (percentB > 0.9 && rsiVal > 65) {
      const bbMiddle = signal.indicators["bbMiddle"];
      const sl = price * (1 + params.stopLossPct / 100);
      const tp = isNaN(bbMiddle) ? price * (1 - params.takeProfitPct / 100) : bbMiddle;
      return {
        signal: { ...signal, direction: "sell", strength: 0.7, reasons: ["Price above BB upper, RSI overbought"] },
        entry: price, sl, tp, qty: 0,
      };
    }

    return null;
  },

  // Momentum
  momentum: (candles, params, price) => {
    const lookback = params.lookback ?? 20;
    if (candles.length < lookback + 10) return null;

    const signal = scoreSignal(candles, {
      emaFast: params.emaFast ?? 12,
      emaSlow: params.emaSlow ?? 26,
      rsiPeriod: params.rsiPeriod ?? 14,
      volumePeriod: 20,
    });

    // Momentum: price change over lookback period
    const priceChange = (price - candles[candles.length - lookback - 1].close) / candles[candles.length - lookback - 1].close;
    const volRatio = signal.indicators["volumeRatio"];

    if (priceChange > 0.02 && !isNaN(volRatio) && volRatio > 1.2 && signal.direction === "buy") {
      const sl = price * (1 - params.stopLossPct / 100);
      const tp = price * (1 + params.takeProfitPct / 100);
      return {
        signal: { ...signal, strength: Math.min(0.9, signal.strength + 0.2), reasons: [...signal.reasons, `Momentum +${(priceChange * 100).toFixed(1)}%`] },
        entry: price, sl, tp, qty: 0,
      };
    }

    if (priceChange < -0.02 && !isNaN(volRatio) && volRatio > 1.2 && signal.direction === "sell") {
      const sl = price * (1 + params.stopLossPct / 100);
      const tp = price * (1 - params.takeProfitPct / 100);
      return {
        signal: { ...signal, strength: Math.min(0.9, signal.strength + 0.2), reasons: [...signal.reasons, `Momentum ${(priceChange * 100).toFixed(1)}%`] },
        entry: price, sl, tp, qty: 0,
      };
    }

    return null;
  },
};

// ── Strategy Engine ───────────────────────────────────────────────────────

export class StrategyEngine extends EventEmitter {
  private strategies = new Map<string, StrategyState>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private candleCache = new Map<string, OHLCV[]>();

  constructor() {
    super();
  }

  // ── Strategy Management ──────────────────────────────────────────────────

  async loadFromDB() {
    try {
      const rows = await db.select().from(strategiesTable);
      for (const row of rows) {
        if (row.enabled) {
          await this.startStrategy({
            id: row.id,
            name: row.name,
            kind: row.kind,
            enabled: Boolean(row.enabled),
            exchangeId: row.exchangeId,
            params: JSON.parse(row.paramsJson ?? "{}") as StrategyParams,
          });
        }
      }
      logger.info({ count: rows.filter((r) => r.enabled).length }, "Strategies loaded from DB");
    } catch (err) {
      logger.warn({ err }, "Failed to load strategies from DB");
    }
  }

  async startStrategy(config: {
    id: string;
    name: string;
    kind: string;
    enabled: boolean;
    exchangeId: string;
    params: StrategyParams;
  }) {
    // Stop existing if running
    this.stopStrategy(config.id);

    const state: StrategyState = {
      id: config.id,
      name: config.name,
      kind: config.kind,
      enabled: config.enabled,
      exchangeId: config.exchangeId,
      params: config.params,
      lastSignal: null,
      lastRun: 0,
      runCount: 0,
      signalCount: 0,
      errorCount: 0,
      status: "idle",
    };

    this.strategies.set(config.id, state);

    if (!config.enabled) return;

    // Determine interval from timeframe
    const intervalMs = this.timeframeToMs(config.params.timeframe ?? "15m");

    const timer = setInterval(async () => {
      await this.runStrategy(config.id);
    }, intervalMs);

    this.timers.set(config.id, timer);

    // Run immediately
    await this.runStrategy(config.id);

    logger.info({ id: config.id, name: config.name, kind: config.kind }, "Strategy started");
  }

  stopStrategy(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    const state = this.strategies.get(id);
    if (state) {
      state.status = "stopped";
    }
  }

  async hotReload(id: string, params: Partial<StrategyParams>) {
    const state = this.strategies.get(id);
    if (!state) return;

    state.params = { ...state.params, ...params };

    // Restart with new params
    await this.startStrategy({
      id: state.id,
      name: state.name,
      kind: state.kind,
      enabled: state.enabled,
      exchangeId: state.exchangeId,
      params: state.params,
    });

    logger.info({ id, params }, "Strategy hot-reloaded");
  }

  // ── Strategy Execution ────────────────────────────────────────────────────

  private async runStrategy(id: string) {
    const state = this.strategies.get(id);
    if (!state || !state.enabled) return;

    state.status = "running";
    state.lastRun = Date.now();
    state.runCount++;

    try {
      const gateway = getGateway(state.exchangeId);
      if (!gateway) {
        logger.warn({ id, exchangeId: state.exchangeId }, "Gateway not found for strategy");
        state.status = "error";
        return;
      }

      const symbol = state.params.symbol ?? "BTCUSDT";
      const timeframe = state.params.timeframe ?? "15m";

      // Get candles (cached or fresh)
      const candles = await this.getCandles(gateway, symbol, timeframe);
      if (candles.length < 30) {
        state.status = "idle";
        return;
      }

      const currentPrice = candles[candles.length - 1].close;

      // Run strategy function
      const stratFn = STRATEGIES[state.kind] ?? STRATEGIES["ema_trend"];
      const result = stratFn(candles, state.params, currentPrice);

      if (!result || result.signal.direction === "neutral") {
        state.status = "idle";
        return;
      }

      // Calculate position size based on risk
      const balance = await gateway.getBalance();
      const availableBalance = balance.availableBalance;
      const riskAmount = availableBalance * (state.params.riskPerTradePct / 100);
      const slDistance = Math.abs(currentPrice - result.sl);
      const qty = slDistance > 0 ? riskAmount / slDistance : 0;

      if (qty <= 0) {
        state.status = "idle";
        return;
      }

      const signal: StrategySignal = {
        strategyId: state.id,
        strategyName: state.name,
        exchangeId: state.exchangeId,
        symbol,
        side: result.signal.direction as "buy" | "sell",
        strength: result.signal.strength,
        confidence: result.signal.confidence,
        reasons: result.signal.reasons,
        indicators: result.signal.indicators,
        suggestedEntry: result.entry,
        suggestedSL: result.sl,
        suggestedTP: result.tp,
        suggestedQty: qty,
        ts: Date.now(),
      };

      state.lastSignal = signal;
      state.signalCount++;
      state.status = "idle";

      // Persist signal to DB
      db.insert(signalsTable).values({
        id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        strategyId: state.id,
        exchangeId: state.exchangeId,
        exchange: "binance",
        sym: symbol,
        side: signal.side,
        strength: signal.strength,
        confidence: signal.confidence,
        reasons: signal.reasons.join("; "),
        indicators: JSON.stringify(signal.indicators),
        suggestedEntry: signal.suggestedEntry,
        suggestedSl: signal.suggestedSL,
        suggestedTp: signal.suggestedTP,
        suggestedQty: signal.suggestedQty,
      }).catch(() => { /* DB may not be ready */ });

      this.emit("signal", signal);
      logger.info({
        strategy: state.name,
        symbol,
        side: signal.side,
        strength: signal.strength.toFixed(2),
        confidence: signal.confidence.toFixed(2),
      }, "Strategy signal generated");

    } catch (err) {
      state.errorCount++;
      state.status = "error";
      logger.error({ err, id }, "Strategy execution error");
    }
  }

  private async getCandles(gateway: BinanceFuturesGateway, symbol: string, timeframe: string): Promise<OHLCV[]> {
    const cacheKey = `${symbol}:${timeframe}`;
    const cached = this.candleCache.get(cacheKey);

    // Use cache if less than 1 minute old
    if (cached && cached.length > 0) {
      const age = Date.now() - cached[cached.length - 1].ts;
      if (age < 60000) return cached;
    }

    try {
      const ohlcv = await gateway.fetchOHLCV(symbol, timeframe, 200);
      this.candleCache.set(cacheKey, ohlcv);
      return ohlcv;
    } catch {
      return cached ?? [];
    }
  }

  private timeframeToMs(timeframe: string): number {
    const map: Record<string, number> = {
      "1m": 60000, "3m": 180000, "5m": 300000, "15m": 900000,
      "30m": 1800000, "1h": 3600000, "2h": 7200000, "4h": 14400000,
      "6h": 21600000, "12h": 43200000, "1d": 86400000,
    };
    return map[timeframe] ?? 900000;
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getAll(): StrategyState[] {
    return [...this.strategies.values()];
  }

  get(id: string): StrategyState | undefined {
    return this.strategies.get(id);
  }

  stopAll() {
    for (const id of this.timers.keys()) {
      this.stopStrategy(id);
    }
  }
}

// Singleton
export const strategyEngine = new StrategyEngine();
