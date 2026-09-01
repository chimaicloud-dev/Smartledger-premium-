import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const withdrawalAddressesTable = pgTable("withdrawal_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  method: text("method").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("withdrawal_addresses_user_method_unique").on(table.userId, table.method),
]);

export const insertWithdrawalAddressSchema = createInsertSchema(withdrawalAddressesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWithdrawalAddress = z.infer<typeof insertWithdrawalAddressSchema>;
export type WithdrawalAddress = typeof withdrawalAddressesTable.$inferSelect;