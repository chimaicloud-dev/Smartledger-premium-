import { pgTable, text, serial, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  country: text("country"),
  dateOfBirth: text("date_of_birth"),
  experience: text("experience").notNull().default("beginner"),
  usdBalance: real("usd_balance").notNull().default(0),
  kycStatus: text("kyc_status").notNull().default("unverified"),
  kycFullName: text("kyc_full_name"),
  kycDateOfBirth: text("kyc_date_of_birth"),
  kycCountry: text("kyc_country"),
  kycIdNumber: text("kyc_id_number"),
  kycSubmittedAt: timestamp("kyc_submitted_at"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  timezone: text("timezone"),
  referralCode: text("referral_code").notNull().unique(),
  referredByUserId: integer("referred_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
