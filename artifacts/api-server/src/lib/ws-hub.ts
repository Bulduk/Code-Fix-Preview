/**
 * WebSocket Hub — OKX WS verilerini tüm frontend bağlantılarına broadcast eder.
 * Sunucu tarafında çalışır, API key gerekmez (public channel).
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger.js";

const OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
const OKX_PAIRS  = ["BTC-USDT","ETH-USDT","SOL-USDT","BNB-USDT","XRP-USDT","DOGE-USDT","MATIC-USDT","ARB-USDT","LINK-USDT","ADA-USDT","AVAX-USDT","DOT-USDT","OP-USDT","TRX-USDT"];

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

// ── OKX Upstream bağlantısı ────────────────────────────────────────────────
let okxWs: WebSocket | null = null;

function connectOKX() {
  if (okxWs && (okxWs.readyState === WebSocket.OPEN || okxWs.readyState === WebSocket.CONNECTING)) return;

  try { okxWs = new WebSocket(OKX_WS_URL); } catch { scheduleReconnect(); return; }

  okxWs.on("open", () => {
    logger.info("OKX WS bağlandı");
    broadcast({ type: "okx_status", connected: true });
    okxWs!.send(JSON.stringify({
      op: "subscribe",
      args: OKX_PAIRS.map((instId) => ({ channel: "tickers", instId })),
    }));
  });

  okxWs.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.arg?.channel === "tickers" && Array.isArray(msg.data) && msg.data[0]) {
        const d      = msg.data[0];
        const sym    = (d.instId as string).replace("-", "");
        const px     = parseFloat(d.last);
        const open24h = parseFloat(d.open24h);
        broadcast({
          type:    "tick",
          ex:      "okx",
          sym,
          px,
          vol24h:  parseFloat(d.volCcy24h),
          high24h: parseFloat(d.high24h),
          low24h:  parseFloat(d.low24h),
          change:  open24h > 0 ? (px - open24h) / open24h : 0,
          ts:      parseInt(d.ts),
        });
      }
    } catch { /* ignore malformed */ }
  });

  okxWs.on("close",  () => { logger.warn("OKX WS kapandı, yeniden bağlanılıyor…"); broadcast({ type:"okx_status", connected:false }); scheduleReconnect(); });
  okxWs.on("error",  (e) => logger.error({ err: e }, "OKX WS hata"));
}

function scheduleReconnect() {
  setTimeout(connectOKX, 5000);
}

function broadcast(payload: Record<string, unknown>) {
  const msg = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// ── Frontend istemci yönetimi ──────────────────────────────────────────────
export function initWsHub(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });
  logger.info("WS Hub başlatıldı — /ws");

  wss.on("connection", (ws) => {
    clients.add(ws);
    logger.info({ total: clients.size }, "WS client bağlandı");

    ws.send(JSON.stringify({ type: "welcome", msg: "Nexus WS Hub", ts: Date.now() }));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      } catch { /* ignore */ }
    });

    ws.on("close", () => { clients.delete(ws); logger.info({ total: clients.size }, "WS client ayrıldı"); });
    ws.on("error", (e) => logger.warn({ err: e }, "WS client hata"));
  });

  connectOKX();

  // Simüle tick'ler (Binance/Bybit için — gerçek WS sonraya)
  const SIM_PAIRS = [
    { ex:"binance", sym:"BTCUSDT",  base:67420 }, { ex:"binance", sym:"ETHUSDT",  base:3520  },
    { ex:"binance", sym:"SOLUSDT",  base:178   }, { ex:"binance", sym:"BNBUSDT",  base:605   },
    { ex:"bybit",   sym:"BTCUSDT",  base:67415 }, { ex:"bybit",   sym:"ETHUSDT",  base:3518  },
    { ex:"binance", sym:"XRPUSDT",  base:0.625 }, { ex:"binance", sym:"MATICUSDT",base:0.72  },
    { ex:"binance", sym:"ARBUSDT",  base:0.92  }, { ex:"binance", sym:"LINKUSDT", base:14.2  },
  ];
  const prices: Record<string, number> = {};
  for (const p of SIM_PAIRS) prices[`${p.ex}:${p.sym}`] = p.base;

  setInterval(() => {
    const pair = SIM_PAIRS[Math.floor(Math.random() * SIM_PAIRS.length)];
    const key  = `${pair.ex}:${pair.sym}`;
    const prev = prices[key] ?? pair.base;
    const next = prev * (1 + (Math.random() - 0.495) * 0.0018);
    prices[key] = next;
    broadcast({ type:"tick", ex:pair.ex, sym:pair.sym, px:Number(next.toFixed(6)), ts:Date.now() });
  }, 500);

  return wss;
}
