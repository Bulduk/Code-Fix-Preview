/**
 * /api/backtest — Historical backtesting engine
 * Features: equity curves, winrate, drawdown, Sharpe ratio, walk-forward
 */
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { scoreSignal, type OHLCV } from "../lib/indicators.js";
import { getGateway, getAllGateways } from "../lib/binance-futures.js";

const router = Router();
router.use(requireAuth);

interface BacktestTrade {
  entryTs: number;
  exitTs: number;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  fee: number;
  reason: string;
}

interface BacktestResult {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  trades: BacktestTrade[];
  equityCurve: Array<{ ts: number; equity: number; drawdown: number }>;
  monthlyReturns: Record<string, number>;
}

function runBacktest(
  candles: OHLCV[],
  params: {
    symbol: string;
    timeframe: string;
    initialBalance: number;
    stopLossPct: number;
    takeProfitPct: number;
    riskPerTradePct: number;
    feeRate: number;
    strategyKind: string;
    rsiOversold?: number;
    rsiOverbought?: number;
    emaFast?: number;
    emaSlow?: number;
    signalThreshold?: number;
  }
): BacktestResult {
  const {
    symbol, timeframe, initialBalance, stopLossPct, takeProfitPct,
    riskPerTradePct, feeRate, signalThreshold = 0.4,
  } = params;

  let balance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ ts: number; equity: number; drawdown: number }> = [];
  const monthlyReturns: Record<string, number> = {};

  let openTrade: {
    entryTs: number; side: "buy" | "sell"; entryPrice: number;
    qty: number; sl: number; tp: number;
  } | null = null;

  const warmup = 50; // candles needed for indicators

  for (let i = warmup; i < candles.length; i++) {
    const candle = candles[i];
    const slice = candles.slice(0, i + 1);

    // Check open trade exit
    if (openTrade) {
      const { side, entryPrice, qty, sl, tp } = openTrade;
      let exitPrice: number | null = null;
      let exitReason = "";

      if (side === "buy") {
        if (candle.low <= sl) { exitPrice = sl; exitReason = "stop_loss"; }
        else if (candle.high >= tp) { exitPrice = tp; exitReason = "take_profit"; }
      } else {
        if (candle.high >= sl) { exitPrice = sl; exitReason = "stop_loss"; }
        else if (candle.low <= tp) { exitPrice = tp; exitReason = "take_profit"; }
      }

      if (exitPrice !== null) {
        const priceDiff = side === "buy" ? exitPrice - entryPrice : entryPrice - exitPrice;
        const pnl = priceDiff * qty;
        const fee = (entryPrice + exitPrice) * qty * feeRate;
        const netPnl = pnl - fee;

        balance += netPnl;
        trades.push({
          entryTs: openTrade.entryTs,
          exitTs: candle.ts,
          symbol,
          side,
          entryPrice,
          exitPrice,
          qty,
          pnl: netPnl,
          pnlPct: (netPnl / initialBalance) * 100,
          fee,
          reason: exitReason,
        });

        // Monthly returns
        const month = new Date(candle.ts).toISOString().slice(0, 7);
        monthlyReturns[month] = (monthlyReturns[month] ?? 0) + netPnl;

        openTrade = null;
      }
    }

    // Update equity curve
    const drawdown = peakBalance - balance;
    const drawdownPct = peakBalance > 0 ? (drawdown / peakBalance) * 100 : 0;

    if (balance > peakBalance) peakBalance = balance;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;

    equityCurve.push({ ts: candle.ts, equity: balance, drawdown: drawdownPct });

    // Generate signal if no open trade
    if (!openTrade) {
      const signal = scoreSignal(slice, {
        rsiPeriod: 14,
        rsiOversold: params.rsiOversold ?? 30,
        rsiOverbought: params.rsiOverbought ?? 70,
        emaFast: params.emaFast ?? 9,
        emaSlow: params.emaSlow ?? 21,
        bbPeriod: 20,
        atrPeriod: 14,
        volumePeriod: 20,
      });

      if (signal.direction !== "neutral" && signal.strength >= signalThreshold) {
        const price = candle.close;
        const riskUsd = balance * (riskPerTradePct / 100);
        const slDistance = price * (stopLossPct / 100);
        const qty = slDistance > 0 ? riskUsd / slDistance : 0;

        if (qty > 0 && balance > price * qty * 0.01) {
          const sl = signal.direction === "buy"
            ? price * (1 - stopLossPct / 100)
            : price * (1 + stopLossPct / 100);
          const tp = signal.direction === "buy"
            ? price * (1 + takeProfitPct / 100)
            : price * (1 - takeProfitPct / 100);

          openTrade = {
            entryTs: candle.ts,
            side: signal.direction,
            entryPrice: price,
            qty,
            sl,
            tp,
          };

          // Deduct entry fee
          balance -= price * qty * feeRate;
        }
      }
    }
  }

  // Close any open trade at end
  if (openTrade) {
    const lastCandle = candles[candles.length - 1];
    const exitPrice = lastCandle.close;
    const priceDiff = openTrade.side === "buy"
      ? exitPrice - openTrade.entryPrice
      : openTrade.entryPrice - exitPrice;
    const pnl = priceDiff * openTrade.qty;
    const fee = (openTrade.entryPrice + exitPrice) * openTrade.qty * feeRate;
    balance += pnl - fee;
    trades.push({
      entryTs: openTrade.entryTs,
      exitTs: lastCandle.ts,
      symbol,
      side: openTrade.side,
      entryPrice: openTrade.entryPrice,
      exitPrice,
      qty: openTrade.qty,
      pnl: pnl - fee,
      pnlPct: ((pnl - fee) / initialBalance) * 100,
      fee,
      reason: "end_of_data",
    });
  }

  // Calculate statistics
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 0;

  // Sharpe ratio (annualized, assuming daily returns)
  const returns = trades.map((t) => t.pnlPct / 100);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  // Sortino ratio (downside deviation)
  const negReturns = returns.filter((r) => r < 0);
  const downsideStd = negReturns.length > 1
    ? Math.sqrt(negReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / negReturns.length)
    : 0;
  const sortinoRatio = downsideStd > 0 ? (avgReturn / downsideStd) * Math.sqrt(252) : 0;

  // Calmar ratio
  const totalReturnPct = ((balance - initialBalance) / initialBalance) * 100;
  const calmarRatio = maxDrawdownPct > 0 ? totalReturnPct / maxDrawdownPct : 0;

  return {
    symbol,
    timeframe,
    startDate: new Date(candles[0].ts).toISOString(),
    endDate: new Date(candles[candles.length - 1].ts).toISOString(),
    initialBalance,
    finalBalance: balance,
    totalReturn: balance - initialBalance,
    totalReturnPct,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    maxDrawdown,
    maxDrawdownPct,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    trades: trades.slice(-100), // last 100 trades
    equityCurve: equityCurve.filter((_, i) => i % 10 === 0), // downsample
    monthlyReturns,
  };
}

// POST /api/backtest/run
router.post("/run", async (req, res) => {
  const {
    symbol = "BTCUSDT",
    timeframe = "1h",
    exchangeId,
    initialBalance = 10000,
    stopLossPct = 2,
    takeProfitPct = 4,
    riskPerTradePct = 1,
    feeRate = 0.0004,
    strategyKind = "ema_trend",
    limit = 500,
    rsiOversold = 30,
    rsiOverbought = 70,
    emaFast = 9,
    emaSlow = 21,
    signalThreshold = 0.4,
  } = req.body as {
    symbol?: string; timeframe?: string; exchangeId?: string;
    initialBalance?: number; stopLossPct?: number; takeProfitPct?: number;
    riskPerTradePct?: number; feeRate?: number; strategyKind?: string;
    limit?: number; rsiOversold?: number; rsiOverbought?: number;
    emaFast?: number; emaSlow?: number; signalThreshold?: number;
  };

  // Get candles
  let candles: OHLCV[] = [];

  const gateway = exchangeId ? getGateway(exchangeId) : getAllGateways().values().next().value;

  if (gateway) {
    try {
      candles = await gateway.fetchOHLCV(symbol, timeframe, Math.min(1000, limit));
    } catch (err) {
      req.log.warn({ err }, "Failed to fetch candles for backtest");
    }
  }

  // Generate synthetic candles if no gateway
  if (candles.length === 0) {
    const basePrice = symbol.includes("BTC") ? 67000 : symbol.includes("ETH") ? 3500 : 100;
    let price = basePrice;
    const now = Date.now();
    const intervalMs = timeframe === "1h" ? 3600000 : timeframe === "4h" ? 14400000 : 86400000;

    for (let i = limit; i >= 0; i--) {
      const change = (Math.random() - 0.495) * 0.02;
      price = price * (1 + change);
      const high = price * (1 + Math.random() * 0.01);
      const low = price * (1 - Math.random() * 0.01);
      candles.push({
        ts: now - i * intervalMs,
        open: price * (1 - change / 2),
        high,
        low,
        close: price,
        volume: Math.random() * 1000 + 100,
      });
    }
  }

  if (candles.length < 60) {
    res.status(400).json({ error: "Insufficient candle data for backtesting (need 60+)" });
    return;
  }

  try {
    const result = runBacktest(candles, {
      symbol, timeframe, initialBalance, stopLossPct, takeProfitPct,
      riskPerTradePct, feeRate, strategyKind, rsiOversold, rsiOverbought,
      emaFast, emaSlow, signalThreshold,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/backtest/walk-forward — walk-forward analysis
router.post("/walk-forward", async (req, res) => {
  const {
    symbol = "BTCUSDT",
    timeframe = "1h",
    exchangeId,
    initialBalance = 10000,
    stopLossPct = 2,
    takeProfitPct = 4,
    riskPerTradePct = 1,
    folds = 5,
  } = req.body as {
    symbol?: string; timeframe?: string; exchangeId?: string;
    initialBalance?: number; stopLossPct?: number; takeProfitPct?: number;
    riskPerTradePct?: number; folds?: number;
  };

  const gateway = exchangeId ? getGateway(exchangeId) : getAllGateways().values().next().value;
  let candles: OHLCV[] = [];

  if (gateway) {
    try {
      candles = await gateway.fetchOHLCV(symbol, timeframe, 1000);
    } catch { /* use synthetic */ }
  }

  if (candles.length < 200) {
    res.status(400).json({ error: "Need 200+ candles for walk-forward analysis" });
    return;
  }

  const foldSize = Math.floor(candles.length / folds);
  const results = [];

  for (let i = 0; i < folds; i++) {
    const start = i * foldSize;
    const end = Math.min(start + foldSize, candles.length);
    const foldCandles = candles.slice(start, end);

    if (foldCandles.length < 60) continue;

    const result = runBacktest(foldCandles, {
      symbol, timeframe, initialBalance, stopLossPct, takeProfitPct,
      riskPerTradePct, feeRate: 0.0004, strategyKind: "ema_trend",
    });

    results.push({
      fold: i + 1,
      startDate: result.startDate,
      endDate: result.endDate,
      totalReturnPct: result.totalReturnPct,
      winRate: result.winRate,
      sharpeRatio: result.sharpeRatio,
      maxDrawdownPct: result.maxDrawdownPct,
      totalTrades: result.totalTrades,
    });
  }

  const avgReturn = results.reduce((s, r) => s + r.totalReturnPct, 0) / results.length;
  const avgWinRate = results.reduce((s, r) => s + r.winRate, 0) / results.length;
  const avgSharpe = results.reduce((s, r) => s + r.sharpeRatio, 0) / results.length;

  res.json({
    symbol, timeframe, folds: results.length,
    summary: { avgReturn, avgWinRate, avgSharpe },
    foldResults: results,
  });
});

export default router;
