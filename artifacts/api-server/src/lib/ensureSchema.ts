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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" text NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "admin_email_jobs" (
        "id" serial PRIMARY KEY,
        "admin_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "subject" text NOT NULL,
        "message" text NOT NULL,
        "audience" text NOT NULL,
        "status" text NOT NULL DEFAULT 'queued',
        "total_count" integer NOT NULL DEFAULT 0,
        "sent_count" integer NOT NULL DEFAULT 0,
        "failed_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "completed_at" timestamp
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "admin_email_recipients" (
        "id" serial PRIMARY KEY,
        "job_id" integer NOT NULL REFERENCES "admin_email_jobs"("id") ON DELETE CASCADE,
        "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "email" text NOT NULL,
        "name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'queued',
        "attempts" integer NOT NULL DEFAULT 0,
        "error" text,
        "sent_at" timestamp,
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "admin_email_recipients_job_status_idx"
      ON "admin_email_recipients" ("job_id", "status")
    `);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" text`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_full_name" text`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_date_of_birth" text`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_country" text`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_id_number" text`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_submitted_at" timestamp`);
    log.info("schema.ensured");
  } catch (err) {
    log.error({ err }, "schema.ensure_failed");
  }
}
