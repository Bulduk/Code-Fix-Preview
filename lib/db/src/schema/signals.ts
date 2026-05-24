import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signalsTable = pgTable("signals", {
  id:            text("id").primaryKey(),
  strategyId:    text("strategy_id"),
  exchangeId:    text("exchange_id"),
  exchange:      text("exchange").notNull(),
  sym:           text("sym").notNull(),
  side:          text("side").notNull(),
  strength:      real("strength").notNull(),
  confidence:    real("confidence").default(0),
  reasons:       text("reasons"),
  indicators:    text("indicators"),
  suggestedEntry: real("suggested_entry"),
  suggestedSl:   real("suggested_sl"),
  suggestedTp:   real("suggested_tp"),
  suggestedQty:  real("suggested_qty"),
  generatedAt:   timestamp("generated_at").notNull().defaultNow(),
});

export const riskEventsTable = pgTable("risk_events", {
  id:        text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  reason:    text("reason"),
  meta:      text("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ generatedAt: true });
export const insertRiskEventSchema = createInsertSchema(riskEventsTable).omit({ createdAt: true });

export type Signal = typeof signalsTable.$inferSelect;
export type RiskEvent = typeof riskEventsTable.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;
