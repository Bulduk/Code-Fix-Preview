/**
 * Sistem başladığında varsayılan verileri seed eder.
 * İdempotent — sadece yoksa ekler.
 * strategiesTable lib/db'de yoksa in-memory fallback yeterli.
 */
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, exchangesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

export async function seedDefaults() {
  try {
    // ── Admin kullanıcı ────────────────────────────────────────────────────
    const adminExists = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, "admin@nexus.local"))
      .limit(1);

    if (adminExists.length === 0) {
      const hash = await bcrypt.hash("nexus2024", 12);
      await db.insert(usersTable).values({
        id: "admin-1",
        email: "admin@nexus.local",
        passwordHash: hash,
        role: "admin",
        totpEnabled: false,
        isActive: true,
      });
      logger.info("Seed: admin kullanıcı oluşturuldu — admin@nexus.local / nexus2024");
    }

    // ── Varsayılan Borsalar ────────────────────────────────────────────────
    const excExists = await db
      .select({ id: exchangesTable.id })
      .from(exchangesTable)
      .limit(1);

    if (excExists.length === 0) {
      await db.insert(exchangesTable).values([
        {
          id: "exc-1",
          exchange: "binance",
          label: "main",
          mode: "live" as const,
          isActive: true,
          hasApiKey: false,
          wsConnected: true,
          latencyMs: 12,
        },
        {
          id: "exc-2",
          exchange: "bybit",
          label: "hedge",
          mode: "testnet" as const,
          isActive: true,
          hasApiKey: false,
          wsConnected: true,
          latencyMs: 18,
        },
        {
          id: "exc-3",
          exchange: "okx",
          label: "main",
          mode: "live" as const,
          isActive: true,
          hasApiKey: !!process.env["OKX_API_KEY"],
          apiKeyEnc: process.env["OKX_API_KEY"] ?? null,
          apiSecretEnc: process.env["OKX_SECRET"] ?? null,
          passphraseEnc: process.env["OKX_PASSPHRASE"] ?? null,
          wsConnected: true,
          latencyMs: 9,
        },
        {
          id: "exc-4",
          exchange: "okx",
          label: "paper",
          mode: "paper" as const,
          isActive: true,
          hasApiKey: false,
          wsConnected: true,
          latencyMs: 4,
        },
      ]);
      logger.info("Seed: varsayılan borsalar oluşturuldu (Binance/Bybit/OKX/OKX-Paper)");
    }
  } catch (err) {
    logger.warn({ err }, "Seed atlıldı — DB henüz hazır olmayabilir (normal durum)");
  }
}
