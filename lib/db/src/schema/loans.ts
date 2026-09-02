import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  apr: real("apr").notNull(),
  termDays: integer("term_days").notNull(),
  collateralSymbol: text("collateral_symbol").notNull(),
  repaymentAmountCents: integer("repayment_amount_cents").notNull(),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  country: text("country").notNull(),
  residentialAddress: text("residential_address").notNull(),
  phone: text("phone").notNull(),
  idType: text("id_type").notNull(),
  idNumber: text("id_number").notNull(),
  employmentStatus: text("employment_status").notNull(),
  monthlyIncomeCents: integer("monthly_income_cents").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedByUserId: integer("reviewed_by_user_id"),
  rejectionReason: text("rejection_reason"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  dueAt: timestamp("due_at"),
  repaidAt: timestamp("repaid_at"),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, requestedAt: true });
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loansTable.$inferSelect;