import { pool } from "@workspace/db";
import type { logger as Logger } from "./logger";

/**
 * Idempotent safety net: creates tables the app requires if they're missing.
 * Production (Vercel Postgres) has no migration pipeline, so newly added
 * tables never appear there and their features 500. CREATE TABLE IF NOT
 * EXISTS is a no-op when the table already exists, so this is safe to run
 * on every cold start.
 */
export async function ensureSchema(log: typeof Logger): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "investments" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL,
        "plan_id" text NOT NULL,
        "plan_name" text NOT NULL,
        "amount" real NOT NULL,
        "daily_pct" real NOT NULL,
        "earned" real NOT NULL DEFAULT 0,
        "days_accrued" integer NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'active',
        "started_at" timestamp NOT NULL DEFAULT now(),
        "ends_at" timestamp NOT NULL,
        "completed_at" timestamp
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "withdrawal_addresses" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL,
        "method" text NOT NULL,
        "address" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "withdrawal_addresses_user_method_unique" UNIQUE ("user_id", "method")
      )
    `);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" text`);
    log.info("schema.ensured");
  } catch (err) {
    log.error({ err }, "schema.ensure_failed");
  }
}
