import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const investmentsTable = pgTable("investments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  // Principal locked in the plan, in USDT.
  amount: real("amount").notNull(),
  // Daily return as a fraction (e.g. 0.02 = 2% per day).
  dailyPct: real("daily_pct").notNull(),
  // Total profit credited to the user's USDT balance so far.
  earned: real("earned").notNull().default(0),
  // Number of completed 24h periods already paid out.
  daysAccrued: integer("days_accrued").notNull().default(0),
  status: text("status").notNull().default("active"), // active | completed
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at").notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertInvestmentSchema = createInsertSchema(investmentsTable).omit({ id: true, startedAt: true });
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type Investment = typeof investmentsTable.$inferSelect;
