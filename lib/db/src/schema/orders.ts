import { pgTable, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderSideEnum   = pgEnum("order_side",   ["buy", "sell"]);
export const orderTypeEnum   = pgEnum("order_type",   ["market", "limit", "stop_market", "stop_limit"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "open", "filled", "cancelled", "rejected", "partial"]);

export const ordersTable = pgTable("orders", {
  id:           text("id").primaryKey(),
  exchangeId:   text("exchange_id").notNull(),
  exchangeOid:  text("exchange_oid"),  // borsa tarafından dönen id
  exchange:     text("exchange").notNull(),
  sym:          text("sym").notNull(),
  side:         orderSideEnum("side").notNull(),
  type:         orderTypeEnum("type").notNull(),
  qty:          real("qty").notNull(),
  px:           real("px"),
  avgFillPx:    real("avg_fill_px"),
  filledQty:    real("filled_qty").default(0),
  fee:          real("fee").default(0),
  status:       orderStatusEnum("status").notNull().default("pending"),
  isPaper:      text("is_paper").default("false"),
  placedBy:     text("placed_by"),  // user id or agent id
  strategyId:   text("strategy_id"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
  filledAt:     timestamp("filled_at"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ createdAt: true, updatedAt: true, filledAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
