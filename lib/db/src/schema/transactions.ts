import { pgTable, text, serial, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  loanId: integer("loan_id"),
  type: text("type").notNull(),
  coin: text("coin"),
  symbol: text("symbol"),
  amount: numeric("amount", { precision: 30, scale: 8, mode: "number" }),
  usdAmount: numeric("usd_amount", { precision: 30, scale: 8, mode: "number" }).notNull(),
  price: numeric("price", { precision: 30, scale: 8, mode: "number" }),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
