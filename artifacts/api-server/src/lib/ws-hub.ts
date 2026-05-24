/**
 * Nexus Trade OS — WebSocket Hub
 * Broadcasts: Binance Futures mark prices, signals, positions, PnL, system events.
 * Handles: client auth, subscriptions, reconnects, heartbeat.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger.js";
import { verifyToken } from "./jwt.js";
import { strategyEngine } from "./strategy-engine.js";
import { riskEngine } from "./risk-engine.js";
import { aiOrchestrator } from "./ai-orchestrator.js";
import { pluginEngine } from "./plugin-engine.js";
import { getAllGateways, createGateway } from "./binance-futures.js";
import { vault } from "./vault.js";

// ── Types ─────────────────────────────────────────────────────────────────

interface WsClient {
  ws: WebSocket;
  userId?: string;
  role?: string;
  authenticated: boolean;
  subscriptions: Set<string>;
  connectedAt: number;
  lastPingAt: number;
  messageCount: number;
}

type WsMessage = {
  type: string;
  [key: string]: unknown;
};

// ── Hub State ─────────────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;
const clients = new Map<WebSocket, WsClient>();

// ── Broadcast ─────────────────────────────────────────────────────────────

export function broadcast(payload: Record<string, unknown>, filter?: (client: WsClient) => boolean) {
  const msg = JSON.stringify(payload);
  for (const [ws, client] of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (filter && !filter(client)) continue;
    try {
      ws.send(msg);
    } catch { /* ignore */ }
  }
}

export function broadcastToAuthenticated(payload: Record<string, unknown>) {
  broadcast(payload, (c) => c.authenticated);
}

// ── Message Handler ───────────────────────────────────────────────────────

async function handleMessage(ws: WebSocket, client: WsClient, raw: string) {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw) as WsMessage;
  } catch {
    ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
    return;
  }

  client.messageCount++;

  switch (msg.type) {
    case "auth": {
      const token = msg["token"] as string;
      if (!token) {
        ws.send(JSON.stringify({ type: "auth_error", error: "Token required" }));
        return;
      }
      try {
        const payload = await verifyToken(token);
        client.authenticated = true;
        client.userId = payload.userId;
        client.role = payload.role;
        ws.send(JSON.stringify({
          type: "auth_ok",
          userId: payload.userId,
          role: payload.role,
          ts: Date.now(),
        }));
        logger.info({ userId: payload.userId }, "WS client authenticated");

        // Send initial state
        sendInitialState(ws, client);
      } catch {
        ws.send(JSON.stringify({ type: "auth_error", error: "Invalid token" }));
      }
      break;
    }

    case "ping": {
      client.lastPingAt = Date.now();
      ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      break;
    }

    case "subscribe": {
      const channels = msg["channels"] as string[] ?? [];
      for (const ch of channels) {
        client.subscriptions.add(ch);
      }
      ws.send(JSON.stringify({ type: "subscribed", channels, ts: Date.now() }));
      break;
    }

    case "unsubscribe": {
      const channels = msg["channels"] as string[] ?? [];
      for (const ch of channels) {
        client.subscriptions.delete(ch);
      }
      break;
    }

    case "get_status": {
      if (!client.authenticated) {
        ws.send(JSON.stringify({ type: "error", error: "Authentication required" }));
        return;
      }
      ws.send(JSON.stringify({
        type: "status",
        risk: riskEngine.getSummary(),
        strategies: strategyEngine.getAll().map((s) => ({
          id: s.id, name: s.name, status: s.status, lastSignal: s.lastSignal,
        })),
        plugins: pluginEngine.getAll().map((p) => ({
          id: p.manifest.id, name: p.manifest.name, status: p.status,
        })),
        gateways: [...getAllGateways().entries()].map(([id, gw]) => ({
          id, ...gw.getStatus(),
        })),
        clients: clients.size,
        ts: Date.now(),
      }));
      break;
    }

    case "kill_switch": {
      if (!client.authenticated || client.role !== "admin") {
        ws.send(JSON.stringify({ type: "error", error: "Admin required" }));
        return;
      }
      const action = msg["action"] as string;
      if (action === "trigger") {
        riskEngine.triggerKillSwitch(`Manual kill switch by ${client.userId}`);
        broadcastToAuthenticated({ type: "kill_switch_triggered", by: client.userId, ts: Date.now() });
      } else if (action === "reset") {
        riskEngine.resetKillSwitch();
        broadcastToAuthenticated({ type: "kill_switch_reset", by: client.userId, ts: Date.now() });
      }
      break;
    }

    default: {
      ws.send(JSON.stringify({ type: "error", error: `Unknown message type: ${msg.type}` }));
    }
  }
}

function sendInitialState(ws: WebSocket, _client: WsClient) {
  // Send risk state
  ws.send(JSON.stringify({
    type: "risk_state",
    ...riskEngine.getSummary(),
    ts: Date.now(),
  }));

  // Send strategy states
  ws.send(JSON.stringify({
    type: "strategies_state",
    strategies: strategyEngine.getAll(),
    ts: Date.now(),
  }));
}

// ── Binance Futures Gateway Integration ───────────────────────────────────

function initBinanceGateways() {
  const exchanges = vault.listSync();
  const binanceExchanges = exchanges.filter((e) => e.exchange === "binance");

  for (const ex of binanceExchanges) {
    const raw = vault.rawGet(ex.id);
    if (!raw) continue;

    const gateway = createGateway({
      exchangeId: ex.id,
      mode: ex.mode as "live" | "testnet" | "paper",
      apiKey: raw._apiKey,
      apiSecret: raw._apiSecret,
    });

    // Forward mark prices to all clients
    gateway.on("markPrice", (data: Record<string, unknown>) => {
      broadcastToAuthenticated({
        type: "tick",
        ex: "binance",
        sym: data["symbol"],
        px: data["markPrice"],
        fundingRate: data["fundingRate"],
        ts: data["ts"],
      });

      // Dispatch to plugins
      pluginEngine.dispatch("onTick", data).catch(() => {});
    });

    // Forward account updates
    gateway.on("accountUpdate", (data: Record<string, unknown>) => {
      broadcastToAuthenticated({ type: "account_update", ...data, ts: Date.now() });
    });

    // Forward order updates
    gateway.on("orderUpdate", (data: Record<string, unknown>) => {
      broadcastToAuthenticated({ type: "order_update", ...data, ts: Date.now() });
      pluginEngine.dispatch("afterOrder", data).catch(() => {});
    });

    gateway.on("connected", (data: Record<string, unknown>) => {
      broadcastToAuthenticated({ type: "gateway_connected", exchangeId: ex.id, ...data, ts: Date.now() });
    });

    gateway.on("error", (err: unknown) => {
      logger.error({ err, exchangeId: ex.id }, "Gateway error");
      broadcastToAuthenticated({ type: "gateway_error", exchangeId: ex.id, error: String(err), ts: Date.now() });
    });

    // Connect
    gateway.connect().catch((err) => logger.error({ err, exchangeId: ex.id }, "Gateway connect failed"));

    // Start market data for common symbols
    gateway.startMarketDataStream(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "LINKUSDT"]);
  }

  // If no Binance exchanges, create a paper trading gateway
  if (binanceExchanges.length === 0) {
    const gateway = createGateway({
      exchangeId: "paper-default",
      mode: "paper",
    });
    gateway.connect().catch(() => {});
    gateway.startMarketDataStream(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]);

    gateway.on("markPrice", (data: Record<string, unknown>) => {
      broadcastToAuthenticated({
        type: "tick",
        ex: "binance",
        sym: data["symbol"],
        px: data["markPrice"],
        ts: data["ts"],
      });
    });
  }
}

// ── Strategy Engine Integration ───────────────────────────────────────────

function initStrategyEngine() {
  strategyEngine.on("signal", (signal: Record<string, unknown>) => {
    broadcastToAuthenticated({
      type: "signal",
      ...signal,
      ts: Date.now(),
    });

    // Dispatch to plugins
    pluginEngine.dispatch("onSignal", signal).catch(() => {});

    logger.info({
      strategy: signal["strategyName"],
      symbol: signal["symbol"],
      side: signal["side"],
      strength: signal["strength"],
    }, "Signal broadcast");
  });

  // Load strategies from DB
  strategyEngine.loadFromDB().catch((err) => logger.warn({ err }, "Strategy load failed"));
}

// ── Risk Engine Integration ───────────────────────────────────────────────

function initRiskEngine() {
  riskEngine.on("killSwitch", (data: Record<string, unknown>) => {
    broadcastToAuthenticated({ type: "kill_switch", ...data });
    logger.error(data, "Kill switch broadcast");
  });

  riskEngine.on("killSwitchReset", (data: Record<string, unknown>) => {
    broadcastToAuthenticated({ type: "kill_switch_reset", ...data });
  });

  riskEngine.on("trailingStopHit", (data: Record<string, unknown>) => {
    broadcastToAuthenticated({ type: "trailing_stop_hit", ...data });
  });

  riskEngine.on("dailyReset", (data: Record<string, unknown>) => {
    broadcastToAuthenticated({ type: "daily_reset", ...data });
  });
}

// ── AI Orchestrator Integration ───────────────────────────────────────────

function initAIOrchestrator() {
  aiOrchestrator.on("decision", (result: Record<string, unknown>) => {
    broadcastToAuthenticated({ type: "ai_decision", ...result });
  });
}

// ── Heartbeat ─────────────────────────────────────────────────────────────

function startHeartbeat() {
  setInterval(() => {
    const now = Date.now();
    for (const [ws, client] of clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        clients.delete(ws);
        continue;
      }

      // Terminate stale connections (no ping in 60s)
      if (client.authenticated && now - client.lastPingAt > 60000) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }

      // Send heartbeat
      try {
        ws.send(JSON.stringify({ type: "heartbeat", ts: now, clients: clients.size }));
      } catch {
        clients.delete(ws);
      }
    }
  }, 30000);
}

// ── PnL Snapshot Timer ────────────────────────────────────────────────────

function startPnLSnapshots() {
  setInterval(async () => {
    try {
      const gateways = getAllGateways();
      let totalBalance = 0;
      let totalUnrealized = 0;

      for (const [, gateway] of gateways) {
        try {
          const balance = await gateway.getBalance();
          totalBalance += balance.totalWalletBalance;
          totalUnrealized += balance.totalUnrealizedProfit;
        } catch { /* skip */ }
      }

      if (totalBalance > 0) {
        riskEngine.updateBalance(totalBalance, totalUnrealized);

        const snapshot = {
          type: "pnl_snapshot",
          equity: totalBalance + totalUnrealized,
          totalBalance,
          unrealized: totalUnrealized,
          realized: 0,
          ts: Date.now(),
        };

        broadcastToAuthenticated(snapshot);
        pluginEngine.dispatch("onPnLSnapshot", snapshot).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err }, "PnL snapshot failed");
    }
  }, 60000); // Every minute
}

// ── Main Init ─────────────────────────────────────────────────────────────

export function initWsHub(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });
  logger.info("WS Hub starting on /ws");

  wss.on("connection", (ws, req) => {
    const client: WsClient = {
      ws,
      authenticated: false,
      subscriptions: new Set(),
      connectedAt: Date.now(),
      lastPingAt: Date.now(),
      messageCount: 0,
    };

    clients.set(ws, client);
    logger.info({ total: clients.size, ip: req.socket.remoteAddress }, "WS client connected");

    // Welcome message
    ws.send(JSON.stringify({
      type: "welcome",
      msg: "Nexus Trade OS WS Hub",
      version: "2.0.0",
      requiresAuth: true,
      ts: Date.now(),
    }));

    ws.on("message", (raw) => {
      handleMessage(ws, client, raw.toString()).catch((err) =>
        logger.warn({ err }, "WS message handler error")
      );
    });

    ws.on("close", () => {
      clients.delete(ws);
      logger.info({ total: clients.size }, "WS client disconnected");
    });

    ws.on("error", (err) => {
      logger.warn({ err }, "WS client error");
      clients.delete(ws);
    });
  });

  // Initialize subsystems
  initBinanceGateways();
  initStrategyEngine();
  initRiskEngine();
  initAIOrchestrator();
  startHeartbeat();
  startPnLSnapshots();

  logger.info("WS Hub initialized with Binance Futures, Strategy Engine, Risk Engine, AI Orchestrator");
  return wss;
}

export function getClientCount(): number {
  return clients.size;
}

export function getAuthenticatedClientCount(): number {
  return [...clients.values()].filter((c) => c.authenticated).length;
}
