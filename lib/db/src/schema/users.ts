import { pgTable, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("user_role", ["admin", "trader", "viewer"]);

export const usersTable = pgTable("users", {
  id:           text("id").primaryKey(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role:         roleEnum("role").notNull().default("trader"),
  totpSecret:   text("totp_secret"),
  totpEnabled:  boolean("totp_enabled").notNull().default(false),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  lastLoginAt:  timestamp("last_login_at"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, lastLoginAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
