/**
 * CCXT Service — sunucu tarafında borsa bağlantıları.
 * API key'ler ASLA frontend'e gönderilmez.
 */
import * as ccxt from "ccxt";
import { vault, type ExchangeRecord } from "./vault.js";
import { logger } from "./logger.js";

type CcxtExchange = InstanceType<typeof ccxt.Exchange>;

const instances = new Map<string, CcxtExchange>();

function buildInstance(rec: ExchangeRecord): CcxtExchange {
  const opts: Record<string, unknown> = {
    enableRateLimit: true,
    timeout: 15000,
  };
  if (rec._apiKey)     opts["apiKey"]   = rec._apiKey;
  if (rec._apiSecret)  opts["secret"]   = rec._apiSecret;
  if (rec._passphrase) opts["password"] = rec._passphrase;
  if (rec.mode === "testnet") opts["sandbox"] = true;

  const ExClass = (ccxt as unknown as Record<string, new (o: Record<string, unknown>) => CcxtExchange>)[rec.exchange];
  if (!ExClass) throw new Error(`CCXT exchange '${rec.exchange}' bulunamadı`);
  return new ExClass(opts);
}

function getInstance(exchangeId: string): CcxtExchange {
  if (instances.has(exchangeId)) return instances.get(exchangeId)!;
  const rec = vault.rawGet(exchangeId);
  if (!rec) throw new Error(`Exchange ${exchangeId} bulunamadı`);
  const inst = buildInstance(rec);
  instances.set(exchangeId, inst);
  return inst;
}

export function invalidateInstance(exchangeId: string) {
  instances.delete(exchangeId);
}

// ── Public: Ticker (API key gerekmez) ──────────────────────────────────────
export async function fetchTicker(exchangeId: string, symbol: string) {
  const ex = getInstance(exchangeId);
  // paper modda direkt fetch, live modda gerçek
  const ticker = await ex.fetchTicker(symbol);
  return {
    sym:    symbol.replace("/", ""),
    px:     ticker.last ?? ticker.close ?? 0,
    bid:    ticker.bid  ?? 0,
    ask:    ticker.ask  ?? 0,
    high24h:ticker.high ?? 0,
    low24h: ticker.low  ?? 0,
    vol24h: ticker.quoteVolume ?? ticker.baseVolume ?? 0,
    change: ticker.percentage ? ticker.percentage / 100 : 0,
    ts:     ticker.timestamp ?? Date.now(),
  };
}

// ── Balance (API key gerektirir) ──────────────────────────────────────────
export async function fetchBalance(exchangeId: string) {
  const rec = vault.rawGet(exchangeId);
  if (!rec?.hasApiKey && rec?.mode !== "paper") {
    return { totalUsd: 0, assets: [], error: "API key eksik" };
  }
  if (rec.mode === "paper") {
    return { totalUsd: 10000, assets: [{ asset: "USDT", free: 10000, locked: 0, usdValue: 10000 }], error: null };
  }
  try {
    const ex      = getInstance(exchangeId);
    const balance = await ex.fetchBalance();
    const balTotal = (balance as unknown as Record<string, unknown>)["total"] as Record<string, number> ?? {};
    const balFree  = (balance as unknown as Record<string, unknown>)["free"]  as Record<string, number> ?? {};
    const balUsed  = (balance as unknown as Record<string, unknown>)["used"]  as Record<string, number> ?? {};
    const assets   = Object.entries(balTotal)
      .filter(([, v]) => (v as number) > 0)
      .map(([asset, total]) => ({
        asset,
        free:     balFree[asset]  ?? 0,
        locked:   balUsed[asset]  ?? 0,
        usdValue: 0,
        total:    total as number,
      }));
    const totalUsd = balTotal["USDT"] ?? 0;
    return { totalUsd, assets, error: null };
  } catch (err) {
    logger.warn({ exchangeId, err }, "fetchBalance hata");
    return { totalUsd: 0, assets: [], error: String(err) };
  }
}

// ── Place Order ────────────────────────────────────────────────────────────
export async function placeOrder(params: {
  exchangeId: string;
  symbol: string;    // "BTC/USDT"
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  price?: number;
  isPaper: boolean;
}) {
  if (params.isPaper) {
    // Paper sim — anlık ticker fiyatı ile doldur
    const ticker = await fetchTicker(params.exchangeId, params.symbol).catch(() => ({ px: params.price ?? 0 }));
    return {
      id:         `paper-${Date.now()}`,
      status:     "filled",
      avgFillPx:  (ticker as { px?: number }).px ?? params.price ?? 0,
      filledQty:  params.qty,
      fee:        params.qty * ((ticker as { px?: number }).px ?? 0) * 0.001,
      isPaper:    true,
    };
  }

  const rec = vault.rawGet(params.exchangeId);
  if (!rec?.hasApiKey) throw new Error("API key eksik — live emir gönderilemez");

  const ex     = getInstance(params.exchangeId);
  const ccxtSym = params.symbol.includes("/") ? params.symbol : params.symbol.replace("USDT", "/USDT");

  const order = await ex.createOrder(
    ccxtSym, params.type, params.side, params.qty,
    params.type === "limit" ? params.price : undefined
  );

  return {
    id:        order.id,
    status:    order.status ?? "open",
    avgFillPx: order.average ?? order.price ?? 0,
    filledQty: order.filled  ?? 0,
    fee:       order.fee?.cost ?? 0,
    isPaper:   false,
    raw:       order.id, // CCXT order id
  };
}

// ── Test Connection ────────────────────────────────────────────────────────
export async function testConnection(exchangeId: string) {
  const rec = vault.rawGet(exchangeId);
  if (!rec) throw new Error("Exchange bulunamadı");
  const start = Date.now();
  try {
    const ex = getInstance(exchangeId);
    await ex.fetchTicker("BTC/USDT");
    const latencyMs = Date.now() - start;
    vault.update(exchangeId, { wsConnected: true, latencyMs });
    return { ok: true, latencyMs };
  } catch (err) {
    vault.update(exchangeId, { wsConnected: false });
    return { ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}
