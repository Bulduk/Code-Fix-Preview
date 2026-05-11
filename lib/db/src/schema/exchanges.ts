import { pgTable, text, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exchangeModeEnum = pgEnum("exchange_mode", ["live", "testnet", "paper"]);

export const exchangesTable = pgTable("exchanges", {
  id:          text("id").primaryKey(),
  exchange:    text("exchange").notNull(),
  label:       text("label").notNull(),
  mode:        exchangeModeEnum("mode").notNull().default("paper"),
  isActive:    boolean("is_active").notNull().default(true),
  // Encrypted in prod — stored server-side only
  apiKeyEnc:   text("api_key_enc"),
  apiSecretEnc:text("api_secret_enc"),
  passphraseEnc:text("passphrase_enc"),
  hasApiKey:   boolean("has_api_key").notNull().default(false),
  wsConnected: boolean("ws_connected").notNull().default(false),
  latencyMs:   integer("latency_ms"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export const insertExchangeSchema = createInsertSchema(exchangesTable).omit({ createdAt: true, updatedAt: true });
export type InsertExchange = z.infer<typeof insertExchangeSchema>;
export type Exchange = typeof exchangesTable.$inferSelect;
