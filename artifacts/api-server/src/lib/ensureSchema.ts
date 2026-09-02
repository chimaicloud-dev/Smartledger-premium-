import { pool } from "@workspace/db";
import type { logger as Logger } from "./logger";

const HOLDINGS_MIGRATION_LOCK = 734918205731n;

async function ensureFixedPrecisionHoldingsAndTransactions(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [HOLDINGS_MIGRATION_LOCK.toString()]);
    const index = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.holdings_user_symbol_unique') IS NOT NULL AS exists",
    );
    const columns = await client.query<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name = 'holdings' AND column_name IN ('amount', 'avg_buy_price')
          OR table_name = 'transactions' AND column_name IN ('amount', 'usd_amount', 'price'))
        AND data_type <> 'numeric'
    `);
    if (!index.rows[0]?.exists || columns.rows.length > 0) {
      await client.query('LOCK TABLE holdings, transactions IN ACCESS EXCLUSIVE MODE');
      for (const column of columns.rows) {
        await client.query(
          `ALTER TABLE "${column.table_name}" ALTER COLUMN "${column.column_name}" TYPE numeric(30,8) USING "${column.column_name}"::numeric(30,8)`,
        );
      }
      if (!index.rows[0]?.exists) {
        await client.query(`
          WITH grouped AS (
            SELECT user_id, symbol, min(id) AS keeper_id, sum(amount) AS total_amount,
              CASE WHEN sum(amount) = 0 THEN 0 ELSE sum(amount * avg_buy_price) / sum(amount) END AS weighted_price
            FROM holdings GROUP BY user_id, symbol
          )
          UPDATE holdings h SET amount = grouped.total_amount, avg_buy_price = grouped.weighted_price, updated_at = now()
          FROM grouped WHERE h.id = grouped.keeper_id
        `);
        await client.query(`
          DELETE FROM holdings h USING (
            SELECT user_id, symbol, min(id) AS keeper_id FROM holdings GROUP BY user_id, symbol
          ) grouped WHERE h.user_id = grouped.user_id AND h.symbol = grouped.symbol AND h.id <> grouped.keeper_id
        `);
        await client.query('CREATE UNIQUE INDEX holdings_user_symbol_unique ON holdings (user_id, symbol)');
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

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
    await ensureFixedPrecisionHoldingsAndTransactions();
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text`);
    await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_user_id" integer`);
    await pool.query(`
      UPDATE "users"
      SET "referral_code" = 'SL' || id::text || substr(md5(email || id::text), 1, 10)
      WHERE "referral_code" IS NULL OR "referral_code" = ''
    `);
    await pool.query(`ALTER TABLE "users" ALTER COLUMN "referral_code" SET NOT NULL`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique" ON "users" ("referral_code")`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_lower_unique" ON "users" (lower("referral_code"))`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "referral_rewards" (
        "id" serial PRIMARY KEY,
        "referrer_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "referred_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "qualifying_transaction_id" integer NOT NULL UNIQUE REFERENCES "transactions"("id") ON DELETE CASCADE,
        "amount_cents" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'completed',
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "loans" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "plan_id" text NOT NULL,
        "plan_name" text NOT NULL,
        "amount_cents" integer NOT NULL,
        "apr" real NOT NULL,
        "term_days" integer NOT NULL,
        "collateral_symbol" text NOT NULL,
        "repayment_amount_cents" integer NOT NULL,
        "full_name" text NOT NULL,
        "date_of_birth" text NOT NULL,
        "country" text NOT NULL,
        "residential_address" text NOT NULL,
        "phone" text NOT NULL,
        "id_type" text NOT NULL,
        "id_number" text NOT NULL,
        "employment_status" text NOT NULL,
        "monthly_income_cents" integer NOT NULL,
        "purpose" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "reviewed_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "rejection_reason" text,
        "requested_at" timestamp NOT NULL DEFAULT now(),
        "approved_at" timestamp,
        "due_at" timestamp,
        "repaid_at" timestamp
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "loans_user_id_idx" ON "loans" ("user_id")`);
    // Upgrade the short-lived pre-release table shape safely if it exists.
    await pool.query(`ALTER TABLE "referral_rewards" ADD COLUMN IF NOT EXISTS "amount" real`);
    await pool.query(`ALTER TABLE "referral_rewards" ADD COLUMN IF NOT EXISTS "amount_cents" integer`);
    await pool.query(`UPDATE "referral_rewards" SET "amount_cents" = round("amount" * 100)::integer WHERE "amount_cents" IS NULL AND "amount" IS NOT NULL`);
    await pool.query(`ALTER TABLE "referral_rewards" ALTER COLUMN "amount_cents" SET NOT NULL`);
    await pool.query(`ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "amount_cents" integer`);
    await pool.query(`ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "amount" real`);
    await pool.query(`ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "repayment_amount_cents" integer`);
    await pool.query(`ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "repayment_amount" real`);
    await pool.query(`ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "monthly_income_cents" integer`);
    await pool.query(`ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "monthly_income" real`);
    await pool.query(`UPDATE "loans" SET "amount_cents" = round("amount" * 100)::integer WHERE "amount_cents" IS NULL AND "amount" IS NOT NULL`);
    await pool.query(`UPDATE "loans" SET "repayment_amount_cents" = round("repayment_amount" * 100)::integer WHERE "repayment_amount_cents" IS NULL AND "repayment_amount" IS NOT NULL`);
    await pool.query(`UPDATE "loans" SET "monthly_income_cents" = round("monthly_income" * 100)::integer WHERE "monthly_income_cents" IS NULL AND "monthly_income" IS NOT NULL`);
    await pool.query(`ALTER TABLE "loans" ALTER COLUMN "amount_cents" SET NOT NULL`);
    await pool.query(`ALTER TABLE "loans" ALTER COLUMN "repayment_amount_cents" SET NOT NULL`);
    await pool.query(`ALTER TABLE "loans" ALTER COLUMN "monthly_income_cents" SET NOT NULL`);
    await pool.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "loan_id" integer`);
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
          ADD CONSTRAINT "transactions_loan_id_loans_id_fk"
          FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "transactions_loan_disbursement_unique" ON "transactions" ("loan_id") WHERE "type" = 'loan_disbursement' AND "loan_id" IS NOT NULL`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "transactions_loan_repayment_unique" ON "transactions" ("loan_id") WHERE "type" = 'loan_repayment' AND "loan_id" IS NOT NULL`);
    log.info("schema.ensured");
  } catch (err) {
    log.error({ err }, "schema.ensure_failed");
  }
}
