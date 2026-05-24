/**
 * Nexus Trade OS — Institutional Risk Engine
 * Features: SL/TP/Trailing Stop, Max Daily Loss, Max Drawdown,
 * Volatility Sizing, Exposure Limits, Cooldown, Kill Switch.
 */

import { EventEmitter } from "events";
import { logger } from "./logger.js";
import { getGateway } from "./binance-futures.js";
import type { PlaceOrderParams } from "./binance-futures.js";

// ── Types ─────────────────────────────────────────────────────────────────

export interface RiskConfig {
  // Position limits
  maxPositionPct: number;       // % of total balance per position
  riskPerTradePct: number;      // % of balance to risk per trade
  maxOpenPositions: number;     // max concurrent positions
  maxExposurePct: number;       // max total exposure % of balance

  // Stop management
  stopLossPct: number;          // default SL %
  takeProfitPct: number;        // default TP %
  trailingStopPct: number;      // trailing stop %
  useTrailingStop: boolean;

  // Daily limits
  maxDailyLossPct: number;      // kill switch threshold
  maxDailyLossUsd: number;      // absolute USD limit
  maxDrawdownPct: number;       // max drawdown from peak

  // Volatility
  useVolatilitySizing: boolean; // ATR-based position sizing
  volatilityMultiplier: number; // ATR multiplier for SL

  // Cooldown
  cooldownAfterLossMs: number;  // ms to wait after a loss
  maxConsecutiveLosses: number; // stop after N consecutive losses

  // Kill switch
  killSwitchEnabled: boolean;
  killSwitchTriggered: boolean;
}

export interface RiskState {
  config: RiskConfig;
  dailyPnl: number;
  dailyPnlUsd: number;
  peakBalance: number;
  currentBalance: number;
  drawdownPct: number;
  openPositionCount: number;
  totalExposureUsd: number;
  consecutiveLosses: number;
  lastLossAt: number;
  killSwitchActive: boolean;
  dailyResetAt: number;
  blockedReasons: string[];
}

export interface RiskCheckResult {
  approved: boolean;
  reasons: string[];
  adjustedQty?: number;
  adjustedSL?: number;
  adjustedTP?: number;
}

// ── Default Risk Config ───────────────────────────────────────────────────

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositionPct: 5,
  riskPerTradePct: 1,
  maxOpenPositions: 5,
  maxExposurePct: 50,
  stopLossPct: 2,
  takeProfitPct: 4,
  trailingStopPct: 1.5,
  useTrailingStop: false,
  maxDailyLossPct: 8,
  maxDailyLossUsd: 500,
  maxDrawdownPct: 15,
  useVolatilitySizing: true,
  volatilityMultiplier: 2,
  cooldownAfterLossMs: 5 * 60 * 1000, // 5 minutes
  maxConsecutiveLosses: 3,
  killSwitchEnabled: true,
  killSwitchTriggered: false,
};

// ── Risk Engine ───────────────────────────────────────────────────────────

export class RiskEngine extends EventEmitter {
  private state: RiskState;
  private trailingStops = new Map<string, { highWaterMark: number; stopPrice: number; side: "long" | "short" }>();

  constructor(config: Partial<RiskConfig> = {}) {
    super();
    this.state = {
      config: { ...DEFAULT_RISK_CONFIG, ...config },
      dailyPnl: 0,
      dailyPnlUsd: 0,
      peakBalance: 0,
      currentBalance: 0,
      drawdownPct: 0,
      openPositionCount: 0,
      totalExposureUsd: 0,
      consecutiveLosses: 0,
      lastLossAt: 0,
      killSwitchActive: false,
      dailyResetAt: this.nextMidnightUTC(),
      blockedReasons: [],
    };
  }

  private nextMidnightUTC(): number {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return midnight.getTime();
  }

  // ── Kill Switch ───────────────────────────────────────────────────────────

  triggerKillSwitch(reason: string) {
    this.state.killSwitchActive = true;
    this.state.config.killSwitchTriggered = true;
    logger.error({ reason }, "🚨 KILL SWITCH TRIGGERED");
    this.emit("killSwitch", { reason, ts: Date.now() });
  }

  resetKillSwitch() {
    this.state.killSwitchActive = false;
    this.state.config.killSwitchTriggered = false;
    logger.info("Kill switch reset");
    this.emit("killSwitchReset", { ts: Date.now() });
  }

  // ── Daily Reset ───────────────────────────────────────────────────────────

  private checkDailyReset() {
    if (Date.now() >= this.state.dailyResetAt) {
      this.state.dailyPnl = 0;
      this.state.dailyPnlUsd = 0;
      this.state.consecutiveLosses = 0;
      this.state.dailyResetAt = this.nextMidnightUTC();
      logger.info("Daily risk counters reset");
      this.emit("dailyReset", { ts: Date.now() });
    }
  }

  // ── Balance Update ────────────────────────────────────────────────────────

  updateBalance(balance: number, unrealizedPnl = 0) {
    this.checkDailyReset();

    const totalEquity = balance + unrealizedPnl;
    this.state.currentBalance = balance;

    if (totalEquity > this.state.peakBalance) {
      this.state.peakBalance = totalEquity;
    }

    if (this.state.peakBalance > 0) {
      this.state.drawdownPct = ((this.state.peakBalance - totalEquity) / this.state.peakBalance) * 100;
    }

    // Check drawdown kill switch
    if (this.state.config.killSwitchEnabled &&
        this.state.drawdownPct >= this.state.config.maxDrawdownPct) {
      this.triggerKillSwitch(`Max drawdown exceeded: ${this.state.drawdownPct.toFixed(1)}%`);
    }
  }

  // ── PnL Tracking ──────────────────────────────────────────────────────────

  recordTrade(pnlUsd: number, balance: number) {
    this.checkDailyReset();

    const pnlPct = balance > 0 ? (pnlUsd / balance) * 100 : 0;
    this.state.dailyPnl += pnlPct;
    this.state.dailyPnlUsd += pnlUsd;

    if (pnlUsd < 0) {
      this.state.consecutiveLosses++;
      this.state.lastLossAt = Date.now();

      // Check consecutive losses
      if (this.state.consecutiveLosses >= this.state.config.maxConsecutiveLosses) {
        this.triggerKillSwitch(`${this.state.consecutiveLosses} consecutive losses`);
      }
    } else {
      this.state.consecutiveLosses = 0;
    }

    // Check daily loss limits
    if (this.state.config.killSwitchEnabled) {
      if (this.state.dailyPnl <= -this.state.config.maxDailyLossPct) {
        this.triggerKillSwitch(`Daily loss limit: ${this.state.dailyPnl.toFixed(1)}%`);
      }
      if (this.state.dailyPnlUsd <= -this.state.config.maxDailyLossUsd) {
        this.triggerKillSwitch(`Daily loss USD limit: $${Math.abs(this.state.dailyPnlUsd).toFixed(2)}`);
      }
    }

    this.emit("tradeRecorded", { pnlUsd, pnlPct, dailyPnl: this.state.dailyPnl });
  }

  // ── Pre-Trade Risk Check ──────────────────────────────────────────────────

  checkOrder(params: {
    symbol: string;
    side: "buy" | "sell";
    qty: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
    exchangeId: string;
    atr?: number;
  }): RiskCheckResult {
    this.checkDailyReset();

    const reasons: string[] = [];
    let approved = true;

    // Kill switch check
    if (this.state.killSwitchActive) {
      return { approved: false, reasons: ["Kill switch is active — all trading halted"] };
    }

    // Cooldown check
    if (this.state.lastLossAt > 0) {
      const timeSinceLoss = Date.now() - this.state.lastLossAt;
      if (timeSinceLoss < this.state.config.cooldownAfterLossMs) {
        const remaining = Math.ceil((this.state.config.cooldownAfterLossMs - timeSinceLoss) / 1000);
        return { approved: false, reasons: [`Cooldown active: ${remaining}s remaining after last loss`] };
      }
    }

    // Max positions check
    if (this.state.openPositionCount >= this.state.config.maxOpenPositions) {
      return { approved: false, reasons: [`Max open positions reached: ${this.state.openPositionCount}/${this.state.config.maxOpenPositions}`] };
    }

    // Daily loss check
    if (this.state.dailyPnl <= -this.state.config.maxDailyLossPct * 0.8) {
      reasons.push(`Warning: Daily loss at ${this.state.dailyPnl.toFixed(1)}% (limit: ${this.state.config.maxDailyLossPct}%)`);
    }

    // Position size check
    const notionalValue = params.qty * params.price;
    const maxPositionUsd = this.state.currentBalance * (this.state.config.maxPositionPct / 100);

    let adjustedQty = params.qty;

    if (notionalValue > maxPositionUsd && maxPositionUsd > 0) {
      adjustedQty = maxPositionUsd / params.price;
      reasons.push(`Position size reduced: $${notionalValue.toFixed(0)} → $${maxPositionUsd.toFixed(0)} (${this.state.config.maxPositionPct}% limit)`);
    }

    // Exposure check
    const newExposure = this.state.totalExposureUsd + adjustedQty * params.price;
    const maxExposureUsd = this.state.currentBalance * (this.state.config.maxExposurePct / 100);
    if (newExposure > maxExposureUsd && maxExposureUsd > 0) {
      approved = false;
      reasons.push(`Total exposure limit: $${newExposure.toFixed(0)} > $${maxExposureUsd.toFixed(0)}`);
    }

    // Volatility-based sizing
    let adjustedSL = params.stopLoss;
    let adjustedTP = params.takeProfit;

    if (this.state.config.useVolatilitySizing && params.atr) {
      const atrSL = params.side === "buy"
        ? params.price - params.atr * this.state.config.volatilityMultiplier
        : params.price + params.atr * this.state.config.volatilityMultiplier;

      // Use ATR-based SL if tighter than default
      if (params.side === "buy" && (!adjustedSL || atrSL > adjustedSL)) {
        adjustedSL = atrSL;
        reasons.push(`ATR-based SL: ${atrSL.toFixed(2)}`);
      } else if (params.side === "sell" && (!adjustedSL || atrSL < adjustedSL)) {
        adjustedSL = atrSL;
        reasons.push(`ATR-based SL: ${atrSL.toFixed(2)}`);
      }

      // Risk-based position sizing
      if (adjustedSL) {
        const slDistance = Math.abs(params.price - adjustedSL);
        const riskUsd = this.state.currentBalance * (this.state.config.riskPerTradePct / 100);
        const riskBasedQty = slDistance > 0 ? riskUsd / slDistance : adjustedQty;
        if (riskBasedQty < adjustedQty) {
          adjustedQty = riskBasedQty;
          reasons.push(`Risk-based sizing: ${adjustedQty.toFixed(4)} (${this.state.config.riskPerTradePct}% risk)`);
        }
      }
    }

    // Default SL/TP if not provided
    if (!adjustedSL) {
      adjustedSL = params.side === "buy"
        ? params.price * (1 - this.state.config.stopLossPct / 100)
        : params.price * (1 + this.state.config.stopLossPct / 100);
    }
    if (!adjustedTP) {
      adjustedTP = params.side === "buy"
        ? params.price * (1 + this.state.config.takeProfitPct / 100)
        : params.price * (1 - this.state.config.takeProfitPct / 100);
    }

    return {
      approved,
      reasons,
      adjustedQty,
      adjustedSL,
      adjustedTP,
    };
  }

  // ── Trailing Stop Management ──────────────────────────────────────────────

  updateTrailingStop(symbol: string, currentPrice: number, side: "long" | "short"): number | null {
    if (!this.state.config.useTrailingStop) return null;

    const trailPct = this.state.config.trailingStopPct / 100;
    const existing = this.trailingStops.get(symbol);

    if (!existing) {
      const stopPrice = side === "long"
        ? currentPrice * (1 - trailPct)
        : currentPrice * (1 + trailPct);
      this.trailingStops.set(symbol, { highWaterMark: currentPrice, stopPrice, side });
      return stopPrice;
    }

    if (side === "long" && currentPrice > existing.highWaterMark) {
      existing.highWaterMark = currentPrice;
      existing.stopPrice = currentPrice * (1 - trailPct);
      this.emit("trailingStopUpdated", { symbol, stopPrice: existing.stopPrice, currentPrice });
    } else if (side === "short" && currentPrice < existing.highWaterMark) {
      existing.highWaterMark = currentPrice;
      existing.stopPrice = currentPrice * (1 + trailPct);
      this.emit("trailingStopUpdated", { symbol, stopPrice: existing.stopPrice, currentPrice });
    }

    // Check if stop hit
    if (side === "long" && currentPrice <= existing.stopPrice) {
      this.trailingStops.delete(symbol);
      this.emit("trailingStopHit", { symbol, stopPrice: existing.stopPrice, currentPrice });
      return existing.stopPrice;
    }
    if (side === "short" && currentPrice >= existing.stopPrice) {
      this.trailingStops.delete(symbol);
      this.emit("trailingStopHit", { symbol, stopPrice: existing.stopPrice, currentPrice });
      return existing.stopPrice;
    }

    return null;
  }

  removeTrailingStop(symbol: string) {
    this.trailingStops.delete(symbol);
  }

  // ── State Management ──────────────────────────────────────────────────────

  updatePositionCount(count: number) {
    this.state.openPositionCount = count;
  }

  updateExposure(totalUsd: number) {
    this.state.totalExposureUsd = totalUsd;
  }

  updateConfig(config: Partial<RiskConfig>) {
    this.state.config = { ...this.state.config, ...config };
    logger.info({ config }, "Risk config updated");
    this.emit("configUpdated", this.state.config);
  }

  getState(): RiskState {
    return { ...this.state };
  }

  getConfig(): RiskConfig {
    return { ...this.state.config };
  }

  getSummary() {
    return {
      killSwitchActive: this.state.killSwitchActive,
      dailyPnlPct: this.state.dailyPnl,
      dailyPnlUsd: this.state.dailyPnlUsd,
      drawdownPct: this.state.drawdownPct,
      openPositions: this.state.openPositionCount,
      consecutiveLosses: this.state.consecutiveLosses,
      totalExposureUsd: this.state.totalExposureUsd,
      config: this.state.config,
    };
  }
}

// Singleton
export const riskEngine = new RiskEngine();
