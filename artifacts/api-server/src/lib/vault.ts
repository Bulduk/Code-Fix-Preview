/**
 * Server-side API key vault.
 * Keys NEVER leave this module — frontend only gets masked info.
 * Production: replace Map with encrypted DB column (pgcrypto / AES-256).
 */

export interface ExchangeRecord {
  id: string;
  exchange: string; // ccxt exchange id  (binance | bybit | okx | ...)
  label: string;
  mode: "live" | "testnet" | "paper";
  is_active: boolean;
  // private — never serialized to client
  _apiKey?: string;
  _apiSecret?: string;
  _passphrase?: string;
  // public metadata
  hasApiKey: boolean;
  createdAt: number;
  latencyMs?: number;
  wsConnected?: boolean;
}

function uid() { return Math.random().toString(36).slice(2, 11); }

const store = new Map<string, ExchangeRecord>([
  ["1", { id:"1", exchange:"binance", label:"main",  mode:"live",    is_active:true,  hasApiKey:false, createdAt:Date.now(), wsConnected:true,  latencyMs:12 }],
  ["2", { id:"2", exchange:"bybit",   label:"hedge", mode:"testnet", is_active:true,  hasApiKey:false, createdAt:Date.now(), wsConnected:true,  latencyMs:18 }],
  ["3", { id:"3", exchange:"okx",     label:"main",  mode:"live",    is_active:true,  hasApiKey:!!process.env["OKX_API_KEY"], createdAt:Date.now(), wsConnected:true, latencyMs:9,
    _apiKey: process.env["OKX_API_KEY"], _apiSecret: process.env["OKX_SECRET"], _passphrase: process.env["OKX_PASSPHRASE"] }],
  ["4", { id:"4", exchange:"okx",     label:"paper", mode:"paper",   is_active:true,  hasApiKey:false, createdAt:Date.now(), wsConnected:true,  latencyMs:4  }],
]);

export function safeRecord(r: ExchangeRecord) {
  const { _apiKey: _k, _apiSecret: _s, _passphrase: _p, ...pub } = r;
  return pub;
}

export const vault = {
  list: () => [...store.values()].map(safeRecord),

  get: (id: string) => store.get(id),

  create(data: {
    exchange: string; label: string; mode: ExchangeRecord["mode"];
    api_key?: string; api_secret?: string; passphrase?: string; is_active?: boolean;
  }): ReturnType<typeof safeRecord> {
    const id = uid();
    const rec: ExchangeRecord = {
      id, exchange: data.exchange, label: data.label, mode: data.mode,
      is_active: data.is_active ?? true,
      hasApiKey: !!data.api_key,
      createdAt: Date.now(),
      _apiKey:     data.api_key,
      _apiSecret:  data.api_secret,
      _passphrase: data.passphrase,
    };
    store.set(id, rec);
    return safeRecord(rec);
  },

  update(id: string, data: Partial<{
    label: string; mode: ExchangeRecord["mode"]; is_active: boolean;
    api_key: string; api_secret: string; passphrase: string;
    latencyMs: number; wsConnected: boolean;
  }>): ReturnType<typeof safeRecord> | null {
    const rec = store.get(id);
    if (!rec) return null;
    if (data.api_key !== undefined) {
      rec._apiKey = data.api_key;
      rec.hasApiKey = !!data.api_key;
    }
    if (data.api_secret !== undefined) rec._apiSecret = data.api_secret;
    if (data.passphrase  !== undefined) rec._passphrase = data.passphrase;
    if (data.label       !== undefined) rec.label       = data.label;
    if (data.mode        !== undefined) rec.mode        = data.mode;
    if (data.is_active   !== undefined) rec.is_active   = data.is_active;
    if (data.latencyMs   !== undefined) rec.latencyMs   = data.latencyMs;
    if (data.wsConnected !== undefined) rec.wsConnected = data.wsConnected;
    return safeRecord(rec);
  },

  delete: (id: string) => store.delete(id),

  // Returns raw record with keys — server-use ONLY
  rawGet: (id: string) => store.get(id),
};
