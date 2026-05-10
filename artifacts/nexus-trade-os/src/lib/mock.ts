import { useStore } from "./store";

export type MarketType = "spot" | "futures" | "perp" | "margin";

export type PairDef = {
  ex: string; sym: string; base: number;
  market: MarketType;
  category: string;
};

// ── Çift Tanımları ─────────────────────────────────────────────────────────
export const SIM_PAIRS: PairDef[] = [
  // SPOT — Binance
  { ex: "binance", sym: "BTCUSDT",   base: 67420,  market: "spot",    category: "major"  },
  { ex: "binance", sym: "ETHUSDT",   base: 3520,   market: "spot",    category: "major"  },
  { ex: "binance", sym: "SOLUSDT",   base: 178,    market: "spot",    category: "major"  },
  { ex: "binance", sym: "BNBUSDT",   base: 605,    market: "spot",    category: "major"  },
  { ex: "binance", sym: "XRPUSDT",   base: 0.625,  market: "spot",    category: "major"  },
  { ex: "binance", sym: "ADAUSDT",   base: 0.48,   market: "spot",    category: "major"  },
  { ex: "binance", sym: "DOGEUSDT",  base: 0.165,  market: "spot",    category: "meme"   },
  { ex: "binance", sym: "SHIBUSDT",  base: 0.000025,market:"spot",    category: "meme"   },
  { ex: "binance", sym: "LINKUSDT",  base: 14.2,   market: "spot",    category: "defi"   },
  { ex: "binance", sym: "AAVEUSDT",  base: 178,    market: "spot",    category: "defi"   },
  { ex: "binance", sym: "UNIUSDT",   base: 8.5,    market: "spot",    category: "defi"   },
  { ex: "binance", sym: "MATICUSDT", base: 0.72,   market: "spot",    category: "layer2" },
  { ex: "binance", sym: "ARBUSDT",   base: 0.92,   market: "spot",    category: "layer2" },
  { ex: "binance", sym: "OPUSDT",    base: 2.15,   market: "spot",    category: "layer2" },
  // PERPETUAL — Binance Futures
  { ex: "binance", sym: "BTCUSDT-PERP", base: 67435, market: "perp", category: "major"  },
  { ex: "binance", sym: "ETHUSDT-PERP", base: 3522,  market: "perp", category: "major"  },
  { ex: "binance", sym: "SOLUSDT-PERP", base: 178.5, market: "perp", category: "major"  },
  { ex: "binance", sym: "BNBUSDT-PERP", base: 606,   market: "perp", category: "major"  },
  // FUTURES — Binance Delivery
  { ex: "binance", sym: "BTCUSDT-240927", base: 67600, market: "futures", category: "major" },
  { ex: "binance", sym: "ETHUSDT-240927", base: 3535,  market: "futures", category: "major" },
  // MARGIN — Binance Cross Margin
  { ex: "binance", sym: "BTCUSDT-MARGIN", base: 67420, market: "margin", category: "major" },
  { ex: "binance", sym: "ETHUSDT-MARGIN", base: 3520,  market: "margin", category: "major" },
  // SPOT — Bybit
  { ex: "bybit",   sym: "BTCUSDT",   base: 67415, market: "spot",    category: "major"  },
  { ex: "bybit",   sym: "ETHUSDT",   base: 3518,  market: "spot",    category: "major"  },
  { ex: "bybit",   sym: "SOLUSDT",   base: 177.8, market: "spot",    category: "major"  },
  { ex: "bybit",   sym: "XRPUSDT",   base: 0.623, market: "spot",    category: "major"  },
  // PERPETUAL — Bybit
  { ex: "bybit",   sym: "BTCUSDT-PERP", base: 67430, market: "perp", category: "major"  },
  { ex: "bybit",   sym: "ETHUSDT-PERP", base: 3520,  market: "perp", category: "major"  },
  // SPOT — OKX
  { ex: "okx",     sym: "BTCUSDT",   base: 67422, market: "spot",    category: "major"  },
  { ex: "okx",     sym: "ETHUSDT",   base: 3521,  market: "spot",    category: "major"  },
  { ex: "okx",     sym: "SOLUSDT",   base: 177.9, market: "spot",    category: "major"  },
  { ex: "okx",     sym: "DOGEUSDT",  base: 0.166, market: "spot",    category: "meme"   },
  { ex: "okx",     sym: "MATICUSDT", base: 0.721, market: "spot",    category: "layer2" },
  { ex: "okx",     sym: "ARBUSDT",   base: 0.919, market: "spot",    category: "layer2" },
  { ex: "okx",     sym: "LINKUSDT",  base: 14.18, market: "spot",    category: "defi"   },
  // PERPETUAL — OKX Swap
  { ex: "okx",     sym: "BTCUSDT-PERP", base: 67440, market: "perp", category: "major"  },
  { ex: "okx",     sym: "ETHUSDT-PERP", base: 3523,  market: "perp", category: "major"  },
  { ex: "okx",     sym: "SOLUSDT-PERP", base: 178.2, market: "perp", category: "major"  },
  // FUTURES — OKX Delivery
  { ex: "okx",     sym: "BTCUSDT-240927", base: 67700, market: "futures", category: "major" },
  { ex: "okx",     sym: "ETHUSDT-240927", base: 3540,  market: "futures", category: "major" },
];

// OKX public WS pairs (no auth required)
const OKX_WS_PAIRS = [
  "BTC-USDT","ETH-USDT","SOL-USDT","BNB-USDT","XRP-USDT",
  "DOGE-USDT","MATIC-USDT","ARB-USDT","OP-USDT","LINK-USDT",
  "AAVE-USDT","ADA-USDT","UNI-USDT","TRX-USDT","AVAX-USDT",
];

const STRATEGIES = [
  "BTC Scalper","ETH Momentum","SOL Mean Rev",
  "BTC/ETH Grid","Breakout Hunter","DCA Engine","Perp Arbitrage",
];

const SIGNAL_REASONS: Record<string, string[]> = {
  buy: [
    "RSI aşırı satım bölgesinden çıkış",
    "MACD pozitif crossover",
    "Fibonacci %61.8 destek tuttu",
    "Hacim artışı + fiyat kırılımı",
    "BB alt bandı test edildi",
    "Funding rate negatif — long cazipçe",
    "Open interest artışı + fiyat yukarı",
  ],
  sell: [
    "RSI aşırı alım bölgesi (%78+)",
    "Direnç bölgesine yaklaşım",
    "MACD negatif crossover",
    "Düşen hacimle yükselen fiyat",
    "BB üst bant kırılımı",
    "Funding rate pozitif — short avantajlı",
    "Long/Short oranı aşırı uzun",
  ],
};

let sigId = 0;
let okxWs: WebSocket | null = null;
let okxConnected = false;

// ── OKX Public WebSocket ───────────────────────────────────────────────────
function connectOKXWebSocket(onStatus: (ok: boolean) => void): () => void {
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (closed) return;
    try {
      okxWs = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");
    } catch { scheduleReconnect(); return; }

    okxWs.onopen = () => {
      okxConnected = true;
      onStatus(true);
      okxWs!.send(JSON.stringify({
        op: "subscribe",
        args: OKX_WS_PAIRS.map((instId) => ({ channel: "tickers", instId })),
      }));
    };

    okxWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.arg?.channel === "tickers" && Array.isArray(msg.data) && msg.data[0]) {
          const d = msg.data[0];
          const sym = (d.instId as string).replace("-", "");
          const px  = parseFloat(d.last);
          const open24h = parseFloat(d.open24h);
          useStore.getState().applyEvent({
            t: "tick", ex: "okx", sym, px,
            ts: parseInt(d.ts),
            vol24h:   parseFloat(d.volCcy24h),
            high24h:  parseFloat(d.high24h),
            low24h:   parseFloat(d.low24h),
            change24h: open24h > 0 ? (px - open24h) / open24h : 0,
          });
        }
      } catch { /* malformed */ }
    };

    okxWs.onclose  = () => { okxConnected = false; onStatus(false); scheduleReconnect(); };
    okxWs.onerror  = () => { okxConnected = false; onStatus(false); };
  }

  function scheduleReconnect() {
    if (!closed) reconnectTimer = setTimeout(connect, 4000);
  }

  connect();
  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    okxWs?.close(); okxWs = null;
  };
}

// ── Ana Feed ──────────────────────────────────────────────────────────────
export function startMockFeed(): () => void {
  const { applyEvent, setOkxConnected, systemConfig } = useStore.getState();

  // Seed fiyatlar
  SIM_PAIRS.forEach(({ ex, sym, base, market }) => {
    applyEvent({
      t: "tick", ex, sym: `${sym}`, ts: Date.now(),
      px: base + (Math.random() - 0.5) * base * 0.001,
      vol24h:  market === "perp" || market === "futures" ? Math.random() * 3e10 : Math.random() * 8e9,
      high24h: base * 1.018,
      low24h:  base * 0.982,
      market,
    });
  });

  // Seed pozisyonlar
  applyEvent({ t: "position", ex: "binance", sym: "BTCUSDT",       side: "long",  qty: 0.05, entry: 65100, mark: 67420, pnl: 116 });
  applyEvent({ t: "position", ex: "bybit",   sym: "ETHUSDT",       side: "long",  qty: 0.5,  entry: 3480,  mark: 3520,  pnl: 20  });
  applyEvent({ t: "position", ex: "okx",     sym: "BTCUSDT-PERP",  side: "short", qty: 0.1,  entry: 68000, mark: 67440, pnl: 56  });
  applyEvent({ t: "position", ex: "okx",     sym: "SOLUSDT",       side: "short", qty: 2.0,  entry: 182,   mark: 178,   pnl: 8   });
  applyEvent({ t: "pnl", equity: 12450.36, realized: 240.12, unrealized: 200.0 });

  // OKX WS
  let stopOkxWs = () => {};
  if (systemConfig.okxWsEnabled) {
    stopOkxWs = connectOKXWebSocket((ok) => setOkxConnected(ok));
  }

  // Binance/Bybit/OKX fallback simülasyon — 400ms (düşük gecikme hedefi)
  const tickInterval = setInterval(() => {
    const pair = SIM_PAIRS[Math.floor(Math.random() * SIM_PAIRS.length)];
    const key  = `${pair.ex}:${pair.sym}`;
    const prev = useStore.getState().ticks[key]?.px ?? pair.base;
    const volatility = pair.market === "perp" || pair.market === "futures" ? 0.002 : 0.0018;
    const noise = (Math.random() - 0.495) * volatility;
    applyEvent({
      t: "tick", ex: pair.ex, sym: pair.sym, ts: Date.now(),
      px: Number((prev * (1 + noise)).toFixed(6)),
      market: pair.market,
    });
  }, 400);

  // Sinyal üreteci — 2800ms (2.8s döngü hedefi)
  const sigInterval = setInterval(() => {
    const ticks = useStore.getState().ticks;
    const keys  = Object.keys(ticks);
    if (keys.length === 0) return;
    const key   = keys[Math.floor(Math.random() * keys.length)];
    const [ex, sym] = key.split(":");
    const strength  = 0.52 + Math.random() * 0.46;
    const side      = Math.random() > 0.48 ? "buy" : "sell";
    const reasons   = SIGNAL_REASONS[side];
    const pair      = SIM_PAIRS.find((p) => p.ex === ex && p.sym === sym);
    applyEvent({
      t: "signal",
      id: `s${++sigId}`,
      strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
      ex, sym, side, strength,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      market: pair?.market ?? "spot",
      ts: Date.now(),
    });
  }, 2800);

  // PnL drift — 3s
  const pnlInterval = setInterval(() => {
    const cur = useStore.getState().pnl ?? { equity: 12450, realized: 240, unrealized: 200 };
    applyEvent({
      t: "pnl",
      equity:     cur.equity     + (Math.random() - 0.47) * 4,
      realized:   cur.realized   + (Math.random() > 0.8 ? (Math.random() - 0.35) * 2.5 : 0),
      unrealized: cur.unrealized + (Math.random() - 0.5) * 6,
    });
  }, 3000);

  return () => {
    clearInterval(tickInterval);
    clearInterval(sigInterval);
    clearInterval(pnlInterval);
    stopOkxWs();
  };
}
