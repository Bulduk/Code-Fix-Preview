/**
 * Nexus Trade OS — Binance Futures Gateway
 * Real institutional-grade Binance USDM Futures implementation.
 * Uses CCXT for REST + native WebSocket for user data stream.
 * API keys NEVER leave this module.
 */

import * as ccxt from "ccxt";
import { EventEmitter } from "events";
import { WebSocket } from "ws";
import { logger } from "./logger.js";
import { db } from "@workspace/db";
import { positionsTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────

export type FuturesMode = "live" | "testnet" | "paper";

export interface BinanceFuturesConfig {
  apiKey?: string;
  apiSecret?: string;
  mode: FuturesMode;
  exchangeId: string;
  leverage?: number;
  marginType?: "ISOLATED" | "CROSSED";
  hedgeMode?: boolean;
}

export interface FuturesPosition {
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  leverage: number;
  unrealizedPnl: number;
  realizedPnl: number;
  marginType: "isolated" | "cross";
  isolatedMargin: number;
  notional: number;
  percentage: number;
}

export interface FuturesOrder {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: string;
  price: number;
  amount: number;
  filled: number;
  remaining: number;
  status: string;
  reduceOnly: boolean;
  positionSide: "LONG" | "SHORT" | "BOTH";
  stopPrice?: number;
  timestamp: number;
}

export interface FuturesBalance {
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  totalMarginBalance: number;
  availableBalance: number;
  assets: Array<{
    asset: string;
    walletBalance: number;
    unrealizedProfit: number;
    marginBalance: number;
    availableBalance: number;
  }>;
}

export interface PlaceOrderParams {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop_market" | "stop_limit" | "take_profit_market" | "trailing_stop_market";
  amount: number;
  price?: number;
  stopPrice?: number;
  reduceOnly?: boolean;
  positionSide?: "LONG" | "SHORT" | "BOTH";
  timeInForce?: "GTC" | "IOC" | "FOK" | "GTX";
  callbackRate?: number; // for trailing stop
  closePosition?: boolean;
  strategyId?: string;
  placedBy?: string;
}

// ── Paper Trading Engine ───────────────────────────────────────────────────

interface PaperPosition {
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  leverage: number;
  unrealizedPnl: number;
  realizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  openedAt: number;
}

class PaperTradingEngine {
  private positions = new Map<string, PaperPosition>();
  private balance = 10000; // USDT
  private orders: FuturesOrder[] = [];
  private orderIdCounter = 1;

  getBalance(): FuturesBalance {
    const unrealized = [...this.positions.values()].reduce((sum, p) => sum + p.unrealizedPnl, 0);
    return {
      totalWalletBalance: this.balance,
      totalUnrealizedProfit: unrealized,
      totalMarginBalance: this.balance + unrealized,
      availableBalance: this.balance,
      assets: [{
        asset: "USDT",
        walletBalance: this.balance,
        unrealizedProfit: unrealized,
        marginBalance: this.balance + unrealized,
        availableBalance: this.balance,
      }],
    };
  }

  updateMarkPrice(symbol: string, markPrice: number) {
    const pos = this.positions.get(symbol);
    if (!pos) return;
    const priceDiff = markPrice - pos.entryPrice;
    pos.unrealizedPnl = pos.side === "long"
      ? priceDiff * pos.size
      : -priceDiff * pos.size;

    // Check SL/TP
    if (pos.stopLoss) {
      const slHit = pos.side === "long" ? markPrice <= pos.stopLoss : markPrice >= pos.stopLoss;
      if (slHit) {
        this.closePosition(symbol, markPrice, "stop_loss");
        return;
      }
    }
    if (pos.takeProfit) {
      const tpHit = pos.side === "long" ? markPrice >= pos.takeProfit : markPrice <= pos.takeProfit;
      if (tpHit) {
        this.closePosition(symbol, markPrice, "take_profit");
      }
    }
  }

  placeOrder(params: PlaceOrderParams, currentPrice: number): FuturesOrder {
    const orderId = `paper-${Date.now()}-${this.orderIdCounter++}`;
    const fillPrice = params.type === "market" ? currentPrice : (params.price ?? currentPrice);
    const fee = fillPrice * params.amount * 0.0004; // 0.04% taker fee

    // Open/close position
    const existingPos = this.positions.get(params.symbol);
    const isClose = params.reduceOnly || params.closePosition;

    if (isClose && existingPos) {
      this.closePosition(params.symbol, fillPrice, "manual");
    } else {
      const side = params.side === "buy" ? "long" : "short";
      const leverage = 10; // default
      const margin = (fillPrice * params.amount) / leverage;

      if (this.balance < margin + fee) {
        throw new Error(`Insufficient paper balance: need $${(margin + fee).toFixed(2)}, have $${this.balance.toFixed(2)}`);
      }

      this.balance -= margin + fee;

      if (existingPos && existingPos.side === side) {
        // Add to position
        const totalSize = existingPos.size + params.amount;
        existingPos.entryPrice = (existingPos.entryPrice * existingPos.size + fillPrice * params.amount) / totalSize;
        existingPos.size = totalSize;
      } else {
        this.positions.set(params.symbol, {
          symbol: params.symbol,
          side,
          size: params.amount,
          entryPrice: fillPrice,
          leverage,
          unrealizedPnl: 0,
          realizedPnl: 0,
          openedAt: Date.now(),
        });
      }
    }

    const order: FuturesOrder = {
      id: orderId,
      clientOrderId: orderId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      price: fillPrice,
      amount: params.amount,
      filled: params.amount,
      remaining: 0,
      status: "closed",
      reduceOnly: params.reduceOnly ?? false,
      positionSide: params.positionSide ?? "BOTH",
      timestamp: Date.now(),
    };

    this.orders.unshift(order);
    return order;
  }

  private closePosition(symbol: string, closePrice: number, reason: string) {
    const pos = this.positions.get(symbol);
    if (!pos) return;

    const priceDiff = closePrice - pos.entryPrice;
    const pnl = pos.side === "long" ? priceDiff * pos.size : -priceDiff * pos.size;
    const fee = closePrice * pos.size * 0.0004;
    const netPnl = pnl - fee;

    this.balance += (pos.entryPrice * pos.size) / pos.leverage + netPnl;
    this.positions.delete(symbol);

    logger.info({ symbol, reason, pnl: netPnl.toFixed(2) }, "Paper position closed");
  }

  getPositions(): FuturesPosition[] {
    return [...this.positions.values()].map((p) => ({
      symbol: p.symbol,
      side: p.side,
      size: p.size,
      entryPrice: p.entryPrice,
      markPrice: p.entryPrice, // updated via updateMarkPrice
      liquidationPrice: p.side === "long"
        ? p.entryPrice * (1 - 1 / p.leverage + 0.004)
        : p.entryPrice * (1 + 1 / p.leverage - 0.004),
      leverage: p.leverage,
      unrealizedPnl: p.unrealizedPnl,
      realizedPnl: p.realizedPnl,
      marginType: "cross",
      isolatedMargin: 0,
      notional: p.entryPrice * p.size,
      percentage: p.entryPrice > 0 ? (p.unrealizedPnl / (p.entryPrice * p.size / p.leverage)) * 100 : 0,
    }));
  }

  getOrders(): FuturesOrder[] {
    return this.orders.slice(0, 100);
  }
}

// ── Binance Futures Gateway ────────────────────────────────────────────────

export class BinanceFuturesGateway extends EventEmitter {
  private exchange: InstanceType<typeof ccxt.binanceusdm> | null = null;
  private config: BinanceFuturesConfig;
  private paper: PaperTradingEngine;
  private userStreamWs: WebSocket | null = null;
  private listenKey: string | null = null;
  private listenKeyTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private marketWs: WebSocket | null = null;
  private subscribedSymbols = new Set<string>();
  private markPrices = new Map<string, number>();
  private isConnected = false;
  private latencyMs = 0;

  constructor(config: BinanceFuturesConfig) {
    super();
    this.config = config;
    this.paper = new PaperTradingEngine();
    this.initExchange();
  }

  private initExchange() {
    if (this.config.mode === "paper") return;

    const opts: Record<string, unknown> = {
      enableRateLimit: true,
      timeout: 15000,
      options: {
        defaultType: "future",
        adjustForTimeDifference: true,
      },
    };

    if (this.config.apiKey) opts["apiKey"] = this.config.apiKey;
    if (this.config.apiSecret) opts["secret"] = this.config.apiSecret;
    if (this.config.mode === "testnet") {
      opts["options"] = {
        ...(opts["options"] as object),
        sandboxMode: true,
      };
    }

    this.exchange = new ccxt.binanceusdm(opts as ConstructorParameters<typeof ccxt.binanceusdm>[0]);

    if (this.config.mode === "testnet") {
      this.exchange.setSandboxMode(true);
    }
  }

  // ── Connection Management ────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.config.mode === "paper") {
      this.isConnected = true;
      this.emit("connected", { mode: "paper" });
      this.startMarketDataStream(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]);
      return;
    }

    try {
      const start = Date.now();
      await this.exchange!.fetchTime();
      this.latencyMs = Date.now() - start;
      this.isConnected = true;
      this.emit("connected", { mode: this.config.mode, latencyMs: this.latencyMs });
      logger.info({ exchangeId: this.config.exchangeId, latencyMs: this.latencyMs }, "Binance Futures connected");

      if (this.config.apiKey) {
        await this.startUserDataStream();
      }
    } catch (err) {
      this.isConnected = false;
      this.emit("error", err);
      logger.error({ err, exchangeId: this.config.exchangeId }, "Binance Futures connection failed");
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.isConnected = false;
    if (this.listenKeyTimer) clearInterval(this.listenKeyTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.userStreamWs?.close();
    this.marketWs?.close();
    this.userStreamWs = null;
    this.marketWs = null;
    this.listenKey = null;
  }

  private scheduleReconnect(delayMs = 5000) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delayMs);
  }

  // ── User Data Stream (account updates, order fills) ──────────────────────

  private async startUserDataStream() {
    if (!this.exchange || !this.config.apiKey) return;

    try {
      const baseUrl = this.config.mode === "testnet"
        ? "https://testnet.binancefuture.com"
        : "https://fapi.binance.com";

      const wsBase = this.config.mode === "testnet"
        ? "wss://stream.binancefuture.com/ws"
        : "wss://fstream.binance.com/ws";

      // Get listen key
      const resp = await fetch(`${baseUrl}/fapi/v1/listenKey`, {
        method: "POST",
        headers: { "X-MBX-APIKEY": this.config.apiKey! },
      });
      const data = await resp.json() as { listenKey?: string };
      if (!data.listenKey) throw new Error("Failed to get listen key");

      this.listenKey = data.listenKey;

      // Keepalive every 30 minutes
      this.listenKeyTimer = setInterval(async () => {
        try {
          await fetch(`${baseUrl}/fapi/v1/listenKey`, {
            method: "PUT",
            headers: { "X-MBX-APIKEY": this.config.apiKey! },
            body: JSON.stringify({ listenKey: this.listenKey }),
          });
        } catch (err) {
          logger.warn({ err }, "Listen key keepalive failed");
        }
      }, 30 * 60 * 1000);

      // Connect to user stream
      this.userStreamWs = new WebSocket(`${wsBase}/${this.listenKey}`);

      this.userStreamWs.on("open", () => {
        logger.info({ exchangeId: this.config.exchangeId }, "Binance user data stream connected");
      });

      this.userStreamWs.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
          this.handleUserStreamMessage(msg);
        } catch (err) {
          logger.warn({ err }, "User stream parse error");
        }
      });

      this.userStreamWs.on("close", () => {
        logger.warn({ exchangeId: this.config.exchangeId }, "User data stream closed, reconnecting...");
        setTimeout(() => this.startUserDataStream(), 5000);
      });

      this.userStreamWs.on("error", (err) => {
        logger.error({ err, exchangeId: this.config.exchangeId }, "User data stream error");
      });

    } catch (err) {
      logger.error({ err }, "Failed to start user data stream");
    }
  }

  private handleUserStreamMessage(msg: Record<string, unknown>) {
    const eventType = msg["e"] as string;

    switch (eventType) {
      case "ACCOUNT_UPDATE": {
        const data = msg["a"] as Record<string, unknown>;
        const balances = (data["B"] as Array<Record<string, unknown>>)?.map((b) => ({
          asset: b["a"] as string,
          walletBalance: parseFloat(b["wb"] as string),
          crossWalletBalance: parseFloat(b["cw"] as string),
        }));
        const positions = (data["P"] as Array<Record<string, unknown>>)?.map((p) => ({
          symbol: p["s"] as string,
          positionAmount: parseFloat(p["pa"] as string),
          entryPrice: parseFloat(p["ep"] as string),
          unrealizedPnl: parseFloat(p["up"] as string),
          marginType: p["mt"] as string,
          isolatedWallet: parseFloat(p["iw"] as string),
          positionSide: p["ps"] as string,
        }));
        this.emit("accountUpdate", { balances, positions, reason: data["m"] });
        break;
      }

      case "ORDER_TRADE_UPDATE": {
        const o = msg["o"] as Record<string, unknown>;
        const order = {
          symbol: o["s"] as string,
          clientOrderId: o["c"] as string,
          side: (o["S"] as string).toLowerCase() as "buy" | "sell",
          type: o["o"] as string,
          status: o["X"] as string,
          price: parseFloat(o["p"] as string),
          avgPrice: parseFloat(o["ap"] as string),
          origQty: parseFloat(o["q"] as string),
          executedQty: parseFloat(o["z"] as string),
          orderId: o["i"] as number,
          reduceOnly: o["R"] as boolean,
          positionSide: o["ps"] as string,
          realizedPnl: parseFloat(o["rp"] as string),
          commission: parseFloat(o["n"] as string),
          commissionAsset: o["N"] as string,
          tradeId: o["t"] as number,
          timestamp: o["T"] as number,
        };
        this.emit("orderUpdate", order);

        // Persist to DB
        this.persistOrderUpdate(order).catch((err) =>
          logger.warn({ err }, "Failed to persist order update")
        );
        break;
      }

      case "listenKeyExpired": {
        logger.warn("Listen key expired, restarting user stream");
        this.startUserDataStream();
        break;
      }
    }
  }

  private async persistOrderUpdate(order: {
    symbol: string; clientOrderId: string; side: "buy" | "sell";
    status: string; avgPrice: number; executedQty: number;
    orderId: number; realizedPnl: number; timestamp: number;
  }) {
    try {
      const status = this.mapOrderStatus(order.status);
      await db.update(ordersTable)
        .set({
          status,
          avgFillPx: order.avgPrice,
          filledQty: order.executedQty,
          updatedAt: new Date(order.timestamp),
          filledAt: status === "filled" ? new Date(order.timestamp) : undefined,
        })
        .where(eq(ordersTable.exchangeOid, String(order.orderId)));
    } catch { /* DB may not be ready */ }
  }

  private mapOrderStatus(binanceStatus: string): "pending" | "open" | "filled" | "cancelled" | "rejected" | "partial" {
    const map: Record<string, "pending" | "open" | "filled" | "cancelled" | "rejected" | "partial"> = {
      NEW: "open",
      PARTIALLY_FILLED: "partial",
      FILLED: "filled",
      CANCELED: "cancelled",
      REJECTED: "rejected",
      EXPIRED: "cancelled",
    };
    return map[binanceStatus] ?? "open";
  }

  // ── Market Data Stream ────────────────────────────────────────────────────

  startMarketDataStream(symbols: string[]) {
    const wsBase = this.config.mode === "testnet"
      ? "wss://stream.binancefuture.com/stream"
      : "wss://fstream.binance.com/stream";

    const streams = symbols.map((s) => `${s.toLowerCase()}@markPrice@1s`).join("/");
    const url = `${wsBase}?streams=${streams}`;

    if (this.marketWs) {
      this.marketWs.close();
    }

    this.marketWs = new WebSocket(url);

    this.marketWs.on("open", () => {
      symbols.forEach((s) => this.subscribedSymbols.add(s));
      logger.info({ symbols, mode: this.config.mode }, "Binance Futures market stream connected");
    });

    this.marketWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { data: Record<string, unknown> };
        const data = msg.data;
        if (data["e"] === "markPriceUpdate") {
          const symbol = data["s"] as string;
          const markPrice = parseFloat(data["p"] as string);
          const fundingRate = parseFloat(data["r"] as string);
          const nextFundingTime = data["T"] as number;

          this.markPrices.set(symbol, markPrice);

          // Update paper positions
          if (this.config.mode === "paper") {
            this.paper.updateMarkPrice(symbol, markPrice);
          }

          this.emit("markPrice", {
            symbol,
            markPrice,
            fundingRate,
            nextFundingTime,
            ts: Date.now(),
          });
        }
      } catch { /* ignore */ }
    });

    this.marketWs.on("close", () => {
      logger.warn("Binance market stream closed, reconnecting...");
      setTimeout(() => this.startMarketDataStream([...this.subscribedSymbols]), 5000);
    });

    this.marketWs.on("error", (err) => {
      logger.error({ err }, "Binance market stream error");
    });
  }

  subscribeSymbol(symbol: string) {
    if (this.subscribedSymbols.has(symbol)) return;
    this.subscribedSymbols.add(symbol);
    this.startMarketDataStream([...this.subscribedSymbols]);
  }

  // ── Account & Position Management ────────────────────────────────────────

  async getBalance(): Promise<FuturesBalance> {
    if (this.config.mode === "paper") {
      return this.paper.getBalance();
    }

    if (!this.exchange) throw new Error("Exchange not initialized");

    const balance = await this.exchange.fetchBalance({ type: "future" });
    const info = balance.info as Record<string, unknown>;
    const assets = (info["assets"] as Array<Record<string, unknown>> ?? []).map((a) => ({
      asset: a["asset"] as string,
      walletBalance: parseFloat(a["walletBalance"] as string),
      unrealizedProfit: parseFloat(a["unrealizedProfit"] as string),
      marginBalance: parseFloat(a["marginBalance"] as string),
      availableBalance: parseFloat(a["availableBalance"] as string),
    }));

    return {
      totalWalletBalance: parseFloat(info["totalWalletBalance"] as string ?? "0"),
      totalUnrealizedProfit: parseFloat(info["totalUnrealizedProfit"] as string ?? "0"),
      totalMarginBalance: parseFloat(info["totalMarginBalance"] as string ?? "0"),
      availableBalance: parseFloat(info["availableBalance"] as string ?? "0"),
      assets,
    };
  }

  async getPositions(): Promise<FuturesPosition[]> {
    if (this.config.mode === "paper") {
      return this.paper.getPositions();
    }

    if (!this.exchange) throw new Error("Exchange not initialized");

    const positions = await this.exchange.fetchPositions();
    return positions
      .filter((p) => Math.abs(p.contracts ?? 0) > 0)
      .map((p) => ({
        symbol: p.symbol.replace("/USDT:USDT", "USDT"),
        side: (p.side ?? "long") as "long" | "short",
        size: Math.abs(p.contracts ?? 0),
        entryPrice: p.entryPrice ?? 0,
        markPrice: p.markPrice ?? 0,
        liquidationPrice: p.liquidationPrice ?? 0,
        leverage: p.leverage ?? 1,
        unrealizedPnl: p.unrealizedPnl ?? 0,
        realizedPnl: 0,
        marginType: (p.marginMode ?? "cross") as "isolated" | "cross",
        isolatedMargin: p.initialMargin ?? 0,
        notional: p.notional ?? 0,
        percentage: p.percentage ?? 0,
      }));
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    if (this.config.mode === "paper") return;
    if (!this.exchange) throw new Error("Exchange not initialized");
    await this.exchange.setLeverage(leverage, symbol);
    logger.info({ symbol, leverage }, "Leverage set");
  }

  async setMarginType(symbol: string, marginType: "ISOLATED" | "CROSSED"): Promise<void> {
    if (this.config.mode === "paper") return;
    if (!this.exchange) throw new Error("Exchange not initialized");
    await this.exchange.setMarginMode(marginType.toLowerCase(), symbol);
    logger.info({ symbol, marginType }, "Margin type set");
  }

  async setHedgeMode(enabled: boolean): Promise<void> {
    if (this.config.mode === "paper") return;
    if (!this.exchange) throw new Error("Exchange not initialized");
    // Binance hedge mode via private API
    const baseUrl = this.config.mode === "testnet"
      ? "https://testnet.binancefuture.com"
      : "https://fapi.binance.com";

    const timestamp = Date.now();
    const params = `dualSidePosition=${enabled}&timestamp=${timestamp}`;
    // Sign would be needed here — using CCXT's private method
    await (this.exchange as unknown as { privatePostFapiV1PositionSideDual: (p: Record<string, unknown>) => Promise<unknown> })
      .privatePostFapiV1PositionSideDual({ dualSidePosition: enabled });
    logger.info({ enabled }, "Hedge mode set");
  }

  // ── Order Management ──────────────────────────────────────────────────────

  async placeOrder(params: PlaceOrderParams): Promise<FuturesOrder> {
    const currentPrice = this.markPrices.get(params.symbol) ?? 0;

    if (this.config.mode === "paper") {
      const order = this.paper.placeOrder(params, currentPrice);
      this.emit("orderPlaced", { ...order, isPaper: true });
      return order;
    }

    if (!this.exchange) throw new Error("Exchange not initialized");
    if (!this.config.apiKey) throw new Error("API key required for live trading");

    const ccxtSymbol = params.symbol.replace("USDT", "/USDT:USDT");

    const orderParams: Record<string, unknown> = {
      reduceOnly: params.reduceOnly ?? false,
    };

    if (params.positionSide) orderParams["positionSide"] = params.positionSide;
    if (params.timeInForce) orderParams["timeInForce"] = params.timeInForce;
    if (params.stopPrice) orderParams["stopPrice"] = params.stopPrice;
    if (params.callbackRate) orderParams["callbackRate"] = params.callbackRate;
    if (params.closePosition) orderParams["closePosition"] = params.closePosition;

    const ccxtType = this.mapOrderType(params.type);

    const result = await this.exchange.createOrder(
      ccxtSymbol,
      ccxtType,
      params.side,
      params.amount,
      params.price,
      orderParams
    );

    const order: FuturesOrder = {
      id: String(result.id),
      clientOrderId: result.clientOrderId ?? String(result.id),
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      price: result.price ?? params.price ?? 0,
      amount: result.amount,
      filled: result.filled ?? 0,
      remaining: result.remaining ?? result.amount,
      status: result.status ?? "open",
      reduceOnly: params.reduceOnly ?? false,
      positionSide: params.positionSide ?? "BOTH",
      stopPrice: params.stopPrice,
      timestamp: result.timestamp ?? Date.now(),
    };

    this.emit("orderPlaced", { ...order, isPaper: false });
    return order;
  }

  private mapOrderType(type: string): string {
    const map: Record<string, string> = {
      market: "market",
      limit: "limit",
      stop_market: "stop_market",
      stop_limit: "stop",
      take_profit_market: "take_profit_market",
      trailing_stop_market: "trailing_stop_market",
    };
    return map[type] ?? type;
  }

  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    if (this.config.mode === "paper") return;
    if (!this.exchange) throw new Error("Exchange not initialized");
    const ccxtSymbol = symbol.replace("USDT", "/USDT:USDT");
    await this.exchange.cancelOrder(orderId, ccxtSymbol);
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    if (this.config.mode === "paper") return;
    if (!this.exchange) throw new Error("Exchange not initialized");
    if (symbol) {
      const ccxtSymbol = symbol.replace("USDT", "/USDT:USDT");
      await this.exchange.cancelAllOrders(ccxtSymbol);
    } else {
      await this.exchange.cancelAllOrders();
    }
  }

  async getOpenOrders(symbol?: string): Promise<FuturesOrder[]> {
    if (this.config.mode === "paper") {
      return this.paper.getOrders().filter((o) => o.status === "open");
    }

    if (!this.exchange) throw new Error("Exchange not initialized");
    const ccxtSymbol = symbol ? symbol.replace("USDT", "/USDT:USDT") : undefined;
    const orders = await this.exchange.fetchOpenOrders(ccxtSymbol);

    return orders.map((o) => ({
      id: String(o.id),
      clientOrderId: o.clientOrderId ?? String(o.id),
      symbol: o.symbol.replace("/USDT:USDT", "USDT"),
      side: o.side as "buy" | "sell",
      type: String(o.type ?? "market"),
      price: o.price ?? 0,
      amount: o.amount,
      filled: o.filled ?? 0,
      remaining: o.remaining ?? o.amount,
      status: o.status ?? "open",
      reduceOnly: (o.info as Record<string, unknown>)?.["reduceOnly"] as boolean ?? false,
      positionSide: (o.info as Record<string, unknown>)?.["positionSide"] as "LONG" | "SHORT" | "BOTH" ?? "BOTH",
      timestamp: o.timestamp ?? Date.now(),
    }));
  }

  async closePosition(symbol: string, percentage = 100): Promise<FuturesOrder> {
    const positions = await this.getPositions();
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) throw new Error(`No open position for ${symbol}`);

    const closeAmount = pos.size * (percentage / 100);
    const closeSide = pos.side === "long" ? "sell" : "buy";

    return this.placeOrder({
      symbol,
      side: closeSide,
      type: "market",
      amount: closeAmount,
      reduceOnly: true,
    });
  }

  // ── Market Data ───────────────────────────────────────────────────────────

  async fetchTicker(symbol: string) {
    if (!this.exchange && this.config.mode !== "paper") throw new Error("Exchange not initialized");

    if (this.config.mode === "paper") {
      const markPrice = this.markPrices.get(symbol) ?? 0;
      return { symbol, markPrice, lastPrice: markPrice, fundingRate: 0, openInterest: 0 };
    }

    const ccxtSymbol = symbol.replace("USDT", "/USDT:USDT");
    const ticker = await this.exchange!.fetchTicker(ccxtSymbol);
    return {
      symbol,
      markPrice: ticker.last ?? 0,
      lastPrice: ticker.last ?? 0,
      bidPrice: ticker.bid ?? 0,
      askPrice: ticker.ask ?? 0,
      volume24h: ticker.quoteVolume ?? 0,
      priceChange24h: ticker.percentage ?? 0,
      high24h: ticker.high ?? 0,
      low24h: ticker.low ?? 0,
      fundingRate: 0,
      openInterest: 0,
    };
  }

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200) {
    if (!this.exchange) throw new Error("Exchange not initialized");
    const ccxtSymbol = symbol.replace("USDT", "/USDT:USDT");
    const ohlcv = await this.exchange.fetchOHLCV(ccxtSymbol, timeframe, undefined, limit);
    return ohlcv.map(([ts, open, high, low, close, volume]) => ({
      ts: ts ?? 0, open: open ?? 0, high: high ?? 0,
      low: low ?? 0, close: close ?? 0, volume: volume ?? 0,
    }));
  }

  async fetchFundingRate(symbol: string) {
    if (!this.exchange) return { symbol, fundingRate: 0, nextFundingTime: 0 };
    const ccxtSymbol = symbol.replace("USDT", "/USDT:USDT");
    const rate = await this.exchange.fetchFundingRate(ccxtSymbol);
    return {
      symbol,
      fundingRate: rate.fundingRate ?? 0,
      nextFundingTime: rate.fundingDatetime ? new Date(rate.fundingDatetime).getTime() : 0,
    };
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getStatus() {
    return {
      connected: this.isConnected,
      mode: this.config.mode,
      latencyMs: this.latencyMs,
      subscribedSymbols: [...this.subscribedSymbols],
      hasApiKey: !!this.config.apiKey,
      userStreamActive: !!this.userStreamWs && this.userStreamWs.readyState === WebSocket.OPEN,
    };
  }

  getMarkPrice(symbol: string): number {
    return this.markPrices.get(symbol) ?? 0;
  }
}

// ── Gateway Registry ──────────────────────────────────────────────────────

const gateways = new Map<string, BinanceFuturesGateway>();

export function getGateway(exchangeId: string): BinanceFuturesGateway | undefined {
  return gateways.get(exchangeId);
}

export function createGateway(config: BinanceFuturesConfig): BinanceFuturesGateway {
  const existing = gateways.get(config.exchangeId);
  if (existing) {
    existing.disconnect();
  }
  const gateway = new BinanceFuturesGateway(config);
  gateways.set(config.exchangeId, gateway);
  return gateway;
}

export function removeGateway(exchangeId: string) {
  const gw = gateways.get(exchangeId);
  if (gw) {
    gw.disconnect();
    gateways.delete(exchangeId);
  }
}

export function getAllGateways(): Map<string, BinanceFuturesGateway> {
  return gateways;
}
