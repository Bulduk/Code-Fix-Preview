/**
 * Nexus Trade OS — Real WebSocket Client
 * Connects to /ws, authenticates with JWT, handles reconnects.
 * Replaces mock feed with real Binance Futures data.
 */

import { useStore } from "./store";

type WsMessage = {
  type: string;
  [key: string]: unknown;
};

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let isConnecting = false;
let shouldReconnect = true;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
}

function handleMessage(msg: WsMessage) {
  const store = useStore.getState();

  switch (msg.type) {
    case "welcome":
      // Authenticate immediately
      authenticate();
      break;

    case "auth_ok":
      store.setOkxConnected(true);
      reconnectDelay = 1000; // reset on successful auth
      break;

    case "auth_error":
      console.error("WS auth failed:", msg["error"]);
      store.setOkxConnected(false);
      break;

    case "tick": {
      const ex = msg["ex"] as string;
      const sym = msg["sym"] as string;
      const px = msg["px"] as number;
      const ts = msg["ts"] as number ?? Date.now();
      store.applyEvent({
        t: "tick", ex, sym, px, ts,
        vol24h: msg["vol24h"] as number,
        high24h: msg["high24h"] as number,
        low24h: msg["low24h"] as number,
        fundingRate: msg["fundingRate"] as number,
      });
      break;
    }

    case "signal": {
      store.applyEvent({
        t: "signal",
        id: msg["strategyId"] as string ?? `sig-${Date.now()}`,
        strategy: msg["strategyName"] as string ?? "Strategy",
        ex: msg["exchangeId"] as string ?? "binance",
        sym: msg["symbol"] as string,
        side: msg["side"] as "buy" | "sell",
        strength: msg["strength"] as number,
        ts: msg["ts"] as number ?? Date.now(),
        reason: (msg["reasons"] as string[])?.join(", "),
      });
      break;
    }

    case "account_update": {
      // Update balances from real account data
      const balances = msg["balances"] as Array<{ asset: string; walletBalance: number }>;
      if (balances) {
        const usdtBalance = balances.find((b) => b.asset === "USDT");
        if (usdtBalance) {
          store.applyEvent({
            t: "pnl",
            equity: usdtBalance.walletBalance,
            realized: 0,
            unrealized: 0,
          });
        }
      }
      break;
    }

    case "order_update": {
      store.applyEvent({
        t: "order",
        id: String(msg["orderId"] ?? Date.now()),
        ex: "binance",
        sym: msg["symbol"] as string,
        side: (msg["side"] as string)?.toLowerCase() as "buy" | "sell",
        type: (msg["type"] as string)?.toLowerCase() ?? "market",
        qty: msg["origQty"] as number ?? 0,
        px: msg["avgPrice"] as number ?? 0,
        status: (msg["status"] as string)?.toLowerCase() ?? "open",
        ts: msg["timestamp"] as number ?? Date.now(),
      });
      break;
    }

    case "pnl_snapshot": {
      store.applyEvent({
        t: "pnl",
        equity: msg["equity"] as number,
        realized: msg["realized"] as number ?? 0,
        unrealized: msg["unrealized"] as number ?? 0,
      });
      store.pushPnlHistory({
        ts: msg["ts"] as number ?? Date.now(),
        equity: msg["equity"] as number,
        realized: msg["realized"] as number ?? 0,
        unrealized: msg["unrealized"] as number ?? 0,
      });
      break;
    }

    case "risk_state": {
      // Update risk state in store
      break;
    }

    case "kill_switch": {
      store.addNotification({
        type: "risk",
        title: "🚨 Kill Switch Triggered",
        body: `Reason: ${msg["reason"] as string ?? "Unknown"}`,
      });
      break;
    }

    case "kill_switch_reset": {
      store.addNotification({
        type: "info",
        title: "✅ Kill Switch Reset",
        body: "Trading resumed",
      });
      break;
    }

    case "ai_decision": {
      const decision = msg as unknown as {
        symbol: string; finalDecision: string; confidence: number;
        reasoning: string; riskApproved: boolean;
      };
      if (decision.riskApproved && decision.finalDecision !== "hold") {
        store.applyEvent({
          t: "signal",
          id: `ai-${Date.now()}`,
          strategy: "AI Orchestrator",
          ex: "binance",
          sym: decision.symbol,
          side: decision.finalDecision as "buy" | "sell",
          strength: decision.confidence,
          ts: Date.now(),
          reason: decision.reasoning?.slice(0, 100),
        });
      }
      break;
    }

    case "gateway_connected": {
      store.setOkxConnected(true);
      break;
    }

    case "gateway_error": {
      store.setOkxConnected(false);
      break;
    }

    case "heartbeat": {
      // Connection alive
      break;
    }

    case "pong": {
      // Ping response
      break;
    }
  }
}

function authenticate() {
  const token = localStorage.getItem("tok");
  if (!token || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "auth", token }));
}

function startPing() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 20000);
}

export function connectWs(): () => void {
  shouldReconnect = true;

  function connect() {
    if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) return;
    isConnecting = true;

    const url = getWsUrl();

    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error("WS connect failed:", err);
      isConnecting = false;
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      isConnecting = false;
      console.log("[WS] Connected to Nexus Hub");
      startPing();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        handleMessage(msg);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = (event) => {
      isConnecting = false;
      useStore.getState().setOkxConnected(false);
      if (pingTimer) clearInterval(pingTimer);
      console.log(`[WS] Disconnected (code: ${event.code})`);
      if (shouldReconnect) scheduleReconnect();
    };

    ws.onerror = () => {
      isConnecting = false;
      useStore.getState().setOkxConnected(false);
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
      connect();
    }, reconnectDelay);
  }

  connect();

  // Return cleanup function
  return () => {
    shouldReconnect = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearInterval(pingTimer);
    ws?.close();
    ws = null;
  };
}

export function sendWsMessage(msg: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function getWsState(): "connecting" | "open" | "closing" | "closed" {
  if (!ws) return "closed";
  const states = ["connecting", "open", "closing", "closed"] as const;
  return states[ws.readyState] ?? "closed";
}
