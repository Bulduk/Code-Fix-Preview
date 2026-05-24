/**
 * WebSocket Hub — OKX WS verilerini tüm frontend bağlantılarına broadcast eder.
 * Sunucu tarafında çalışır, API key gerekmez (public channel).
 * Ek: Sinyal broadcast + PnL snapshot otomatik kayıt.
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger.js";
import { db } from "@workspace/db";
import { pnlSnapshotsTable } from "@workspace/db";

const OKX_WS_URL     = "wss://ws.okx.com:8443/ws/v5/public";
const BINANCE_WS_URL = "wss://stream.binance.com:9443/stream";

const OKX_PAIRS = ["BTC-USDT","ETH-USDT","SOL-USDT","BNB-USDT","XRP-USDT","DOGE-USDT","MATIC-USDT","ARB-USDT","LINK-USDT","ADA-USDT","AVAX-USDT","DOT-USDT","OP-USDT","TRX-USDT"];

// Binance combined stream — public, API key gerekmez
const BINANCE_STREAMS = [
  "btcusdt@miniTicker","ethusdt@miniTicker","bnbusdt@miniTicker",
  "solusdt@miniTicker","xrpusdt@miniTicker","adausdt@miniTicker",
  "dogeusdt@miniTicker","linkusdt@miniTicker","arbusdt@miniTicker",
  "maticusdt@miniTicker","aaveusdt@miniTicker","uniusdt@miniTicker",
  "opusdt@miniTicker",
];

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

// ── Binance Public WebSocket (miniTicker) ──────────────────────────────────
let binanceWs: WebSocket | null = null;

function connectBinance() {
  if (binanceWs && (binanceWs.readyState === WebSocket.OPEN || binanceWs.readyState === WebSocket.CONNECTING)) return;

  const url = `${BINANCE_WS_URL}?streams=${BINANCE_STREAMS.join("/")}`;
  try { binanceWs = new WebSocket(url); } catch { scheduleBinanceReconnect(); return; }

  binanceWs.on("open", () => {
    logger.info("Binance WS bağlandı");
    broadcast({ type: "binance_status", connected: true });
  });

  binanceWs.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { stream?: string; data?: Record<string, string> };
      if (msg.data && msg.stream?.includes("miniTicker")) {
        const d      = msg.data;
        const sym    = (d["s"] as string) ?? "";
        const px     = parseFloat(d["c"] as string);  // close price
        const open   = parseFloat(d["o"] as string);  // open price
        const high   = parseFloat(d["h"] as string);
        const low    = parseFloat(d["l"] as string);
        const vol    = parseFloat(d["q"] as string);  // quote volume
        const change = open > 0 ? (px - open) / open : 0;
        broadcast({
          type: "tick",
          ex:   "binance",
          sym,
          px,
          vol24h:  vol,
          high24h: high,
          low24h:  low,
          change,
          ts: parseInt(d["E"] as string) || Date.now(),
        });
      }
    } catch { /* ignore malformed */ }
  });

  binanceWs.on("close", () => {
    logger.warn("Binance WS kapandı, yeniden bağlanılıyor…");
    broadcast({ type: "binance_status", connected: false });
    scheduleBinanceReconnect();
  });
  binanceWs.on("error", (e) => logger.error({ err: e }, "Binance WS hata"));
}

function scheduleBinanceReconnect() {
  setTimeout(connectBinance, 6000);
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
  connectBinance();

  // Simüle tick'ler (Bybit için — Binance artık gerçek WS'den geliyor)
  // Sadece Bybit simüle ediliyor — Binance artık gerçek WS'den, OKX de gerçek WS'den geliyor
  const SIM_PAIRS = [
    { ex:"bybit", sym:"BTCUSDT",  base:67415 },
    { ex:"bybit", sym:"ETHUSDT",  base:3518  },
    { ex:"bybit", sym:"SOLUSDT",  base:177.8 },
    { ex:"bybit", sym:"XRPUSDT",  base:0.623 },
    { ex:"bybit", sym:"BNBUSDT",  base:604   },
    { ex:"bybit", sym:"DOGEUSDT", base:0.165 },
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

  // ── Sinyal üreteci — 3s döngü ─────────────────────────────────────────
  const STRATEGIES = ["BTC Scalper","ETH Momentum","SOL Mean Rev","BTC/ETH Grid","Breakout Hunter","DCA Engine","Perp Arbitrage"];
  const SIGNAL_REASONS = {
    buy: ["RSI aşırı satım bölgesinden çıkış","MACD pozitif crossover","Fibonacci %61.8 destek tuttu","Hacim artışı + fiyat kırılımı","BB alt bandı test edildi"],
    sell: ["RSI aşırı alım bölgesi (%78+)","Direnç bölgesine yaklaşım","MACD negatif crossover","Düşen hacimle yükselen fiyat","BB üst bant kırılımı"],
  };
  let sigId = 0;

  setInterval(() => {
    const pair = SIM_PAIRS[Math.floor(Math.random() * SIM_PAIRS.length)];
    const side = Math.random() > 0.48 ? "buy" : "sell";
    const strength = 0.52 + Math.random() * 0.46;
    const reasons = SIGNAL_REASONS[side as "buy" | "sell"];
    const signal = {
      type: "signal",
      id: `s${++sigId}`,
      strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
      ex: pair.ex,
      sym: pair.sym,
      side,
      strength,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      ts: Date.now(),
    };
    broadcast(signal);
  }, 3000);

  // ── PnL snapshot otomatik kayıt — 5 dakikada bir ─────────────────────
  let simEquity = 12450;
  let simRealized = 240;
  let simUnrealized = 200;

  setInterval(async () => {
    // Simüle drift
    simEquity     += (Math.random() - 0.47) * 8;
    simRealized   += Math.random() > 0.8 ? (Math.random() - 0.35) * 5 : 0;
    simUnrealized += (Math.random() - 0.5) * 12;

    // Broadcast live PnL to all clients
    broadcast({
      type: "pnl",
      equity: Number(simEquity.toFixed(2)),
      realized: Number(simRealized.toFixed(2)),
      unrealized: Number(simUnrealized.toFixed(2)),
      ts: Date.now(),
    });

    // DB'ye snapshot kaydet (5 dakikada bir)
    try {
      await db.insert(pnlSnapshotsTable).values({
        id: Math.random().toString(36).slice(2, 11),
        equity: simEquity,
        realized: simRealized,
        unrealized: simUnrealized,
        totalBalance: simEquity,
      });
    } catch { /* DB yoksa sessizce geç */ }
  }, 5 * 60 * 1000); // 5 dakika

  return wss;
}
