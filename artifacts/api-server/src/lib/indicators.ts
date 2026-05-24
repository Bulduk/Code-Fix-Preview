/**
 * Nexus Trade OS — Technical Indicators Library
 * Real implementations: RSI, EMA, SMA, MACD, ATR, Bollinger Bands, VWAP
 * No external dependencies — pure TypeScript math.
 */

export interface OHLCV {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Simple Moving Average ─────────────────────────────────────────────────

export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

// ── Exponential Moving Average ────────────────────────────────────────────

export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    if (i === period - 1) {
      // Seed with SMA
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      result.push(seed);
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

// ── RSI ───────────────────────────────────────────────────────────────────

export function rsi(closes: number[], period = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }

    let avgGain: number;
    let avgLoss: number;

    if (i === period - 1) {
      avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      const prevAvgGain = result.length > 0 ? (result[result.length - 1] !== undefined ? 0 : 0) : 0;
      // Wilder's smoothing
      const prevRsi = result[result.length - 1];
      if (isNaN(prevRsi)) {
        avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      } else {
        // Use stored values
        const prevAG = (result as unknown as { _ag?: number }[])[result.length - 1]?.["_ag"] ?? 0;
        const prevAL = (result as unknown as { _al?: number }[])[result.length - 1]?.["_al"] ?? 0;
        avgGain = (prevAG * (period - 1) + gains[i]) / period;
        avgLoss = (prevAL * (period - 1) + losses[i]) / period;
      }
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiVal = 100 - 100 / (1 + rs);
    result.push(rsiVal);
  }

  // Pad with NaN at start
  return [NaN, ...result];
}

// ── MACD ──────────────────────────────────────────────────────────────────

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  const macdLine = fastEma.map((f, i) => {
    if (isNaN(f) || isNaN(slowEma[i])) return NaN;
    return f - slowEma[i];
  });

  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalRaw = ema(validMacd, signalPeriod);

  // Align signal with macd
  const nanCount = macdLine.filter((v) => isNaN(v)).length;
  const signalLine = [
    ...Array(nanCount).fill(NaN),
    ...Array(signalPeriod - 1).fill(NaN),
    ...signalRaw.filter((v) => !isNaN(v)),
  ];

  const histogram = macdLine.map((m, i) => {
    if (isNaN(m) || isNaN(signalLine[i])) return NaN;
    return m - signalLine[i];
  });

  return { macd: macdLine, signal: signalLine, histogram };
}

// ── ATR (Average True Range) ──────────────────────────────────────────────

export function atr(candles: OHLCV[], period = 14): number[] {
  const trueRanges: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges.push(candles[i].high - candles[i].low);
      continue;
    }
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    );
    trueRanges.push(tr);
  }

  const result: number[] = [];
  let prevAtr = NaN;

  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    if (i === period - 1) {
      prevAtr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(prevAtr);
      continue;
    }
    prevAtr = (prevAtr * (period - 1) + trueRanges[i]) / period;
    result.push(prevAtr);
  }

  return result;
}

// ── Bollinger Bands ───────────────────────────────────────────────────────

export interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
  bandwidth: number[];
  percentB: number[];
}

export function bollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2
): BollingerBands {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const bandwidth: number[] = [];
  const percentB: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      bandwidth.push(NaN);
      percentB.push(NaN);
      continue;
    }

    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const u = mean + stdDevMultiplier * stdDev;
    const l = mean - stdDevMultiplier * stdDev;

    upper.push(u);
    lower.push(l);
    bandwidth.push((u - l) / mean);
    percentB.push((closes[i] - l) / (u - l));
  }

  return { upper, middle, lower, bandwidth, percentB };
}

// ── VWAP ──────────────────────────────────────────────────────────────────

export function vwap(candles: OHLCV[]): number[] {
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
    result.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice);
  }

  return result;
}

// ── Stochastic RSI ────────────────────────────────────────────────────────

export interface StochRSI {
  k: number[];
  d: number[];
}

export function stochRsi(closes: number[], rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3): StochRSI {
  const rsiValues = rsi(closes, rsiPeriod);
  const k: number[] = [];

  for (let i = 0; i < rsiValues.length; i++) {
    if (i < stochPeriod - 1 || isNaN(rsiValues[i])) {
      k.push(NaN);
      continue;
    }
    const slice = rsiValues.slice(i - stochPeriod + 1, i + 1).filter((v) => !isNaN(v));
    if (slice.length < stochPeriod) { k.push(NaN); continue; }
    const minRsi = Math.min(...slice);
    const maxRsi = Math.max(...slice);
    k.push(maxRsi === minRsi ? 0 : ((rsiValues[i] - minRsi) / (maxRsi - minRsi)) * 100);
  }

  const kSmoothed = sma(k.filter((v) => !isNaN(v)), kPeriod);
  const d = sma(kSmoothed.filter((v) => !isNaN(v)), dPeriod);

  return { k, d };
}

// ── Volume Analysis ───────────────────────────────────────────────────────

export interface VolumeAnalysis {
  obv: number[];          // On-Balance Volume
  volumeSma: number[];    // Volume SMA
  volumeRatio: number[];  // Current vol / avg vol
}

export function volumeAnalysis(candles: OHLCV[], period = 20): VolumeAnalysis {
  const obv: number[] = [];
  let prevObv = 0;

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { obv.push(candles[i].volume); prevObv = candles[i].volume; continue; }
    if (candles[i].close > candles[i - 1].close) prevObv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) prevObv -= candles[i].volume;
    obv.push(prevObv);
  }

  const volumes = candles.map((c) => c.volume);
  const volumeSma = sma(volumes, period);
  const volumeRatio = volumes.map((v, i) => isNaN(volumeSma[i]) ? NaN : v / volumeSma[i]);

  return { obv, volumeSma, volumeRatio };
}

// ── Signal Scoring ────────────────────────────────────────────────────────

export interface SignalScore {
  direction: "buy" | "sell" | "neutral";
  strength: number;  // 0-1
  confidence: number; // 0-1
  reasons: string[];
  indicators: Record<string, number>;
}

export function scoreSignal(candles: OHLCV[], params: {
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  emaFast?: number;
  emaSlow?: number;
  bbPeriod?: number;
  atrPeriod?: number;
  volumePeriod?: number;
} = {}): SignalScore {
  const {
    rsiPeriod = 14,
    rsiOversold = 30,
    rsiOverbought = 70,
    emaFast = 9,
    emaSlow = 21,
    bbPeriod = 20,
    atrPeriod = 14,
    volumePeriod = 20,
  } = params;

  const closes = candles.map((c) => c.close);
  const last = closes.length - 1;

  const rsiVals = rsi(closes, rsiPeriod);
  const emaFastVals = ema(closes, emaFast);
  const emaSlowVals = ema(closes, emaSlow);
  const bbVals = bollingerBands(closes, bbPeriod);
  const atrVals = atr(candles, atrPeriod);
  const volAnalysis = volumeAnalysis(candles, volumePeriod);
  const macdVals = macd(closes);

  const currentRsi = rsiVals[last];
  const currentEmaFast = emaFastVals[last];
  const currentEmaSlow = emaSlowVals[last];
  const currentBbUpper = bbVals.upper[last];
  const currentBbLower = bbVals.lower[last];
  const currentBbMiddle = bbVals.middle[last];
  const currentPercentB = bbVals.percentB[last];
  const currentAtr = atrVals[last];
  const currentVolRatio = volAnalysis.volumeRatio[last];
  const currentMacd = macdVals.macd[last];
  const currentSignal = macdVals.signal[last];
  const currentHistogram = macdVals.histogram[last];
  const prevHistogram = macdVals.histogram[last - 1];
  const currentClose = closes[last];

  const buySignals: string[] = [];
  const sellSignals: string[] = [];
  let buyScore = 0;
  let sellScore = 0;

  // RSI
  if (!isNaN(currentRsi)) {
    if (currentRsi < rsiOversold) {
      buyScore += 0.25;
      buySignals.push(`RSI oversold (${currentRsi.toFixed(1)})`);
    } else if (currentRsi > rsiOverbought) {
      sellScore += 0.25;
      sellSignals.push(`RSI overbought (${currentRsi.toFixed(1)})`);
    }
  }

  // EMA crossover
  if (!isNaN(currentEmaFast) && !isNaN(currentEmaSlow)) {
    const prevEmaFast = emaFastVals[last - 1];
    const prevEmaSlow = emaSlowVals[last - 1];
    if (!isNaN(prevEmaFast) && !isNaN(prevEmaSlow)) {
      if (prevEmaFast <= prevEmaSlow && currentEmaFast > currentEmaSlow) {
        buyScore += 0.30;
        buySignals.push(`EMA${emaFast} crossed above EMA${emaSlow}`);
      } else if (prevEmaFast >= prevEmaSlow && currentEmaFast < currentEmaSlow) {
        sellScore += 0.30;
        sellSignals.push(`EMA${emaFast} crossed below EMA${emaSlow}`);
      } else if (currentEmaFast > currentEmaSlow) {
        buyScore += 0.10;
        buySignals.push(`EMA bullish alignment`);
      } else {
        sellScore += 0.10;
        sellSignals.push(`EMA bearish alignment`);
      }
    }
  }

  // Bollinger Bands
  if (!isNaN(currentPercentB)) {
    if (currentPercentB < 0.05) {
      buyScore += 0.20;
      buySignals.push(`Price at BB lower band`);
    } else if (currentPercentB > 0.95) {
      sellScore += 0.20;
      sellSignals.push(`Price at BB upper band`);
    }
  }

  // MACD
  if (!isNaN(currentHistogram) && !isNaN(prevHistogram)) {
    if (prevHistogram < 0 && currentHistogram > 0) {
      buyScore += 0.25;
      buySignals.push(`MACD bullish crossover`);
    } else if (prevHistogram > 0 && currentHistogram < 0) {
      sellScore += 0.25;
      sellSignals.push(`MACD bearish crossover`);
    } else if (currentHistogram > 0 && currentHistogram > prevHistogram) {
      buyScore += 0.10;
      buySignals.push(`MACD momentum increasing`);
    } else if (currentHistogram < 0 && currentHistogram < prevHistogram) {
      sellScore += 0.10;
      sellSignals.push(`MACD momentum decreasing`);
    }
  }

  // Volume confirmation
  if (!isNaN(currentVolRatio)) {
    if (currentVolRatio > 1.5) {
      const boost = 0.10;
      if (buyScore > sellScore) {
        buyScore += boost;
        buySignals.push(`High volume confirmation (${currentVolRatio.toFixed(1)}x avg)`);
      } else {
        sellScore += boost;
        sellSignals.push(`High volume confirmation (${currentVolRatio.toFixed(1)}x avg)`);
      }
    }
  }

  const direction: "buy" | "sell" | "neutral" =
    buyScore > sellScore && buyScore > 0.3 ? "buy" :
    sellScore > buyScore && sellScore > 0.3 ? "sell" : "neutral";

  const strength = direction === "buy" ? Math.min(1, buyScore) :
    direction === "sell" ? Math.min(1, sellScore) : 0;

  // Confidence based on agreement between indicators
  const totalSignals = buySignals.length + sellSignals.length;
  const dominantSignals = direction === "buy" ? buySignals.length : sellSignals.length;
  const confidence = totalSignals > 0 ? dominantSignals / totalSignals : 0;

  return {
    direction,
    strength,
    confidence,
    reasons: direction === "buy" ? buySignals : direction === "sell" ? sellSignals : [],
    indicators: {
      rsi: currentRsi,
      emaFast: currentEmaFast,
      emaSlow: currentEmaSlow,
      bbUpper: currentBbUpper,
      bbLower: currentBbLower,
      bbMiddle: currentBbMiddle,
      percentB: currentPercentB,
      atr: currentAtr,
      volumeRatio: currentVolRatio,
      macd: currentMacd,
      macdSignal: currentSignal,
      macdHistogram: currentHistogram,
    },
  };
}
