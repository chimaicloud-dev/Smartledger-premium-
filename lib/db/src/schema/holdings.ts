import { pgTable, text, serial, numeric, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const holdingsTable = pgTable("holdings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  coin: text("coin").notNull(),
  symbol: text("symbol").notNull(),
  amount: numeric("amount", { precision: 30, scale: 8, mode: "number" }).notNull().default(0),
  avgBuyPrice: numeric("avg_buy_price", { precision: 30, scale: 8, mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("holdings_user_symbol_unique").on(table.userId, table.symbol)]);

export const insertHoldingSchema = createInsertSchema(holdingsTable).omit({ id: true, updatedAt: true });
export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdingsTable.$inferSelect;
