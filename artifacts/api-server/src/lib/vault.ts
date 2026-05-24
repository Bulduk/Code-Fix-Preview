/**
 * Nexus Trade OS — API Key Vault
 * Keys are AES-256-GCM encrypted at rest in PostgreSQL.
 * Keys NEVER leave this module — frontend only gets masked info.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { exchangesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

// ── Encryption ────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = process.env["ENCRYPTION_KEY"] ?? "nexus-dev-key-change-in-prod-32ch";
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"), "utf8");

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const tag = Buffer.from(tagHex!, "hex");
  const encrypted = Buffer.from(encHex!, "hex");
  const decipher = createDecipheriv("aes-256-gcm", KEY_BUFFER, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

function safeDecrypt(ciphertext: string | null | undefined): string | undefined {
  if (!ciphertext) return undefined;
  try {
    return decrypt(ciphertext);
  } catch {
    // Legacy: might be stored unencrypted (env var passthrough)
    return ciphertext;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ExchangeRecord {
  id: string;
  exchange: string;
  label: string;
  mode: "live" | "testnet" | "paper";
  is_active: boolean;
  _apiKey?: string;
  _apiSecret?: string;
  _passphrase?: string;
  hasApiKey: boolean;
  createdAt: number;
  latencyMs?: number;
  wsConnected?: boolean;
}

// ── In-memory cache (populated from DB) ──────────────────────────────────

const store = new Map<string, ExchangeRecord>();
let storeLoaded = false;

async function ensureLoaded() {
  if (storeLoaded) return;
  storeLoaded = true;
  try {
    const rows = await db.select().from(exchangesTable);
    for (const row of rows) {
      store.set(row.id, {
        id: row.id,
        exchange: row.exchange,
        label: row.label,
        mode: row.mode,
        is_active: row.isActive,
        hasApiKey: row.hasApiKey,
        createdAt: row.createdAt.getTime(),
        latencyMs: row.latencyMs ?? undefined,
        wsConnected: row.wsConnected,
        _apiKey: safeDecrypt(row.apiKeyEnc),
        _apiSecret: safeDecrypt(row.apiSecretEnc),
        _passphrase: safeDecrypt(row.passphraseEnc),
      });
    }
    logger.info({ count: rows.length }, "Vault loaded from DB");
  } catch (err) {
    logger.warn({ err }, "Vault DB load failed, using in-memory defaults");
    // Seed from env vars
    if (process.env["BINANCE_API_KEY"]) {
      store.set("binance-main", {
        id: "binance-main",
        exchange: "binance",
        label: "main",
        mode: process.env["BINANCE_TESTNET"] === "true" ? "testnet" : "live",
        is_active: true,
        hasApiKey: true,
        createdAt: Date.now(),
        _apiKey: process.env["BINANCE_API_KEY"],
        _apiSecret: process.env["BINANCE_SECRET"],
      });
    }
  }
}

export function safeRecord(r: ExchangeRecord) {
  const { _apiKey: _k, _apiSecret: _s, _passphrase: _p, ...pub } = r;
  return pub;
}

export const vault = {
  list: async () => {
    await ensureLoaded();
    return [...store.values()].map(safeRecord);
  },

  listSync: () => [...store.values()].map(safeRecord),

  get: async (id: string) => {
    await ensureLoaded();
    return store.get(id);
  },

  rawGet: (id: string) => store.get(id),

  async create(data: {
    exchange: string; label: string; mode: ExchangeRecord["mode"];
    api_key?: string; api_secret?: string; passphrase?: string; is_active?: boolean;
  }): Promise<ReturnType<typeof safeRecord>> {
    await ensureLoaded();
    const id = `${data.exchange}-${Date.now()}`;

    const rec: ExchangeRecord = {
      id,
      exchange: data.exchange,
      label: data.label,
      mode: data.mode,
      is_active: data.is_active ?? true,
      hasApiKey: !!data.api_key,
      createdAt: Date.now(),
      _apiKey: data.api_key,
      _apiSecret: data.api_secret,
      _passphrase: data.passphrase,
    };

    store.set(id, rec);

    // Persist to DB
    try {
      await db.insert(exchangesTable).values({
        id,
        exchange: data.exchange,
        label: data.label,
        mode: data.mode,
        isActive: data.is_active ?? true,
        hasApiKey: !!data.api_key,
        apiKeyEnc: data.api_key ? encrypt(data.api_key) : null,
        apiSecretEnc: data.api_secret ? encrypt(data.api_secret) : null,
        passphraseEnc: data.passphrase ? encrypt(data.passphrase) : null,
      });
    } catch (err) {
      logger.warn({ err }, "Failed to persist exchange to DB");
    }

    return safeRecord(rec);
  },

  async update(id: string, data: Partial<{
    label: string; mode: ExchangeRecord["mode"]; is_active: boolean;
    api_key: string; api_secret: string; passphrase: string;
    latencyMs: number; wsConnected: boolean;
  }>): Promise<ReturnType<typeof safeRecord> | null> {
    await ensureLoaded();
    const rec = store.get(id);
    if (!rec) return null;

    if (data.api_key !== undefined) { rec._apiKey = data.api_key; rec.hasApiKey = !!data.api_key; }
    if (data.api_secret !== undefined) rec._apiSecret = data.api_secret;
    if (data.passphrase !== undefined) rec._passphrase = data.passphrase;
    if (data.label !== undefined) rec.label = data.label;
    if (data.mode !== undefined) rec.mode = data.mode;
    if (data.is_active !== undefined) rec.is_active = data.is_active;
    if (data.latencyMs !== undefined) rec.latencyMs = data.latencyMs;
    if (data.wsConnected !== undefined) rec.wsConnected = data.wsConnected;

    // Persist to DB
    try {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (data.label !== undefined) patch["label"] = data.label;
      if (data.mode !== undefined) patch["mode"] = data.mode;
      if (data.is_active !== undefined) patch["isActive"] = data.is_active;
      if (data.latencyMs !== undefined) patch["latencyMs"] = data.latencyMs;
      if (data.wsConnected !== undefined) patch["wsConnected"] = data.wsConnected;
      if (data.api_key !== undefined) {
        patch["apiKeyEnc"] = data.api_key ? encrypt(data.api_key) : null;
        patch["hasApiKey"] = !!data.api_key;
      }
      if (data.api_secret !== undefined) patch["apiSecretEnc"] = data.api_secret ? encrypt(data.api_secret) : null;
      if (data.passphrase !== undefined) patch["passphraseEnc"] = data.passphrase ? encrypt(data.passphrase) : null;

      await db.update(exchangesTable).set(patch).where(eq(exchangesTable.id, id));
    } catch (err) {
      logger.warn({ err }, "Failed to update exchange in DB");
    }

    return safeRecord(rec);
  },

  async delete(id: string): Promise<boolean> {
    await ensureLoaded();
    const existed = store.delete(id);
    if (existed) {
      try {
        await db.delete(exchangesTable).where(eq(exchangesTable.id, id));
      } catch (err) {
        logger.warn({ err }, "Failed to delete exchange from DB");
      }
    }
    return existed;
  },

  invalidate() {
    storeLoaded = false;
    store.clear();
  },
};
