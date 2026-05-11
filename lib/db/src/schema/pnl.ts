import { pgTable, text, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pnlSnapshotsTable = pgTable("pnl_snapshots", {
  id:          text("id").primaryKey(),
  exchangeId:  text("exchange_id"),
  equity:      real("equity").notNull(),
  totalBalance:real("total_balance").notNull().default(0),
  realized:    real("realized").notNull().default(0),
  unrealized:  real("unrealized").notNull().default(0),
  dailyPnl:    real("daily_pnl").default(0),
  snapshotAt:  timestamp("snapshot_at").notNull().defaultNow(),
});

export const auditLogTable = pgTable("audit_log", {
  id:        text("id").primaryKey(),
  action:    text("action").notNull(),
  target:    text("target").notNull(),
  actor:     text("actor").notNull(),
  meta:      text("meta"),   // JSON string
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const strategiesTable = pgTable("strategies", {
  id:           text("id").primaryKey(),
  name:         text("name").notNull(),
  kind:         text("kind").notNull(),
  enabled:      integer("enabled").notNull().default(0),
  allocation:   real("allocation").notNull().default(10),
  provider:     text("provider").notNull().default("anthropic"),
  model:        text("model").notNull(),
  exchangeId:   text("exchange_id").notNull(),
  paramsJson:   text("params_json").notNull().default("{}"),
  code:         text("code"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

export const insertPnlSchema      = createInsertSchema(pnlSnapshotsTable).omit({ snapshotAt: true });
export const insertAuditSchema    = createInsertSchema(auditLogTable).omit({ createdAt: true });
export const insertStrategySchema = createInsertSchema(strategiesTable).omit({ createdAt: true, updatedAt: true });

export type PnlSnapshot = typeof pnlSnapshotsTable.$inferSelect;
export type AuditLog    = typeof auditLogTable.$inferSelect;
export type Strategy    = typeof strategiesTable.$inferSelect;
export type InsertPnl   = z.infer<typeof insertPnlSchema>;
