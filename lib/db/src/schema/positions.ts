import { pgTable, text, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const positionsTable = pgTable("positions", {
  id:          text("id").primaryKey(),
  exchangeId:  text("exchange_id").notNull(),
  exchange:    text("exchange").notNull(),
  sym:         text("sym").notNull(),
  side:        text("side").notNull(),   // long | short
  qty:         real("qty").notNull(),
  entryPx:     real("entry_px").notNull(),
  markPx:      real("mark_px").notNull(),
  liqPx:       real("liq_px"),
  leverage:    real("leverage").default(1),
  unrealizedPnl: real("unrealized_pnl").default(0),
  realizedPnl:   real("realized_pnl").default(0),
  isPaper:     boolean("is_paper").notNull().default(false),
  openedAt:    timestamp("opened_at").notNull().defaultNow(),
  closedAt:    timestamp("closed_at"),
  isOpen:      boolean("is_open").notNull().default(true),
});

export const insertPositionSchema = createInsertSchema(positionsTable).omit({ openedAt: true, closedAt: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positionsTable.$inferSelect;
