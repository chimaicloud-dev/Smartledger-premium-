import { pool } from "@workspace/db";
import { sendCustomAdminEmail } from "./email";

type EmailTarget = {
  id: number;
  email: string;
  name: string;
};

type QueueLogger = {
  info: (data: unknown, message?: string) => void;
  error: (data: unknown, message?: string) => void;
};

export type AdminEmailJobResult = {
  jobId: number;
  status: "queued" | "processing" | "completed" | "partial";
  attempted: number;
  sent: number;
  failed: number;
  message: string;
};

const processingJobs = new Set<number>();
const PROCESSING_BUDGET_MS = 20_000;
const REQUIRED_SEND_BUDGET_MS = 14_000;

export async function enqueueAdminEmailJob(input: {
  adminUserId: number;
  audience: "single" | "all";
  subject: string;
  message: string;
  targets: EmailTarget[];
}): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const jobResult = await client.query<{ id: number }>(
      `INSERT INTO "admin_email_jobs"
        ("admin_user_id", "subject", "message", "audience", "total_count")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING "id"`,
      [input.adminUserId, input.subject, input.message, input.audience, input.targets.length]
    );
    const jobId = jobResult.rows[0].id;

    for (const target of input.targets) {
      await client.query(
        `INSERT INTO "admin_email_recipients"
          ("job_id", "user_id", "email", "name")
         VALUES ($1, $2, $3, $4)`,
        [jobId, target.id, target.email, target.name]
      );
    }

    await client.query("COMMIT");
    return jobId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function refreshJobStatus(jobId: number): Promise<AdminEmailJobResult | null> {
  const result = await pool.query<{
    id: number;
    status: AdminEmailJobResult["status"];
    total_count: number;
  }>(
    `SELECT "id", "status", "total_count"
     FROM "admin_email_jobs"
     WHERE "id" = $1`,
    [jobId]
  );
  const job = result.rows[0];
  if (!job) return null;

  const countsResult = await pool.query<{
    sent: string;
    failed: string;
    pending: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE "status" = 'sent')::text AS "sent",
       COUNT(*) FILTER (WHERE "status" = 'failed')::text AS "failed",
       COUNT(*) FILTER (WHERE "status" IN ('queued', 'sending'))::text AS "pending"
     FROM "admin_email_recipients"
     WHERE "job_id" = $1`,
    [jobId]
  );
  const sent = Number(countsResult.rows[0]?.sent ?? 0);
  const failed = Number(countsResult.rows[0]?.failed ?? 0);
  const pending = Number(countsResult.rows[0]?.pending ?? 0);
  const status: AdminEmailJobResult["status"] =
    pending > 0
      ? sent || failed
        ? "processing"
        : "queued"
      : failed > 0
        ? "partial"
        : "completed";

  await pool.query(
    `UPDATE "admin_email_jobs"
     SET "status" = $2,
         "sent_count" = $3,
         "failed_count" = $4,
         "completed_at" = CASE WHEN $2 IN ('completed', 'partial') THEN now() ELSE NULL END
     WHERE "id" = $1`,
    [jobId, status, sent, failed]
  );

  const message =
    status === "completed"
      ? `Email sent to ${sent} recipient${sent === 1 ? "" : "s"}`
      : status === "partial"
        ? `Sent ${sent}; ${failed} failed`
        : `Delivery in progress: ${sent} sent, ${failed} failed`;

  return {
    jobId,
    status,
    attempted: job.total_count,
    sent,
    failed,
    message,
  };
}

export async function getAdminEmailJob(jobId: number): Promise<AdminEmailJobResult | null> {
  return refreshJobStatus(jobId);
}

async function requestJobContinuation(jobId: number, log: QueueLogger): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL !== "1" || !secret || !productionHost) return;

  const url = new URL("/api/cron/email-queue", `https://${productionHost}`);
  url.searchParams.set("jobId", String(jobId));
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
      log.error(
        { jobId, attempt, statusCode: response.status },
        "admin.custom_email.continuation_rejected"
      );
    } catch (error) {
      log.error({ jobId, attempt, error }, "admin.custom_email.continuation_error");
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

export function startAdminEmailJob(jobId: number, log: QueueLogger): boolean {
  if (processingJobs.has(jobId)) return false;
  processingJobs.add(jobId);

  let shouldContinue = false;
  const execution = (async () => {
    const startedAt = Date.now();
    while (PROCESSING_BUDGET_MS - (Date.now() - startedAt) >= REQUIRED_SEND_BUDGET_MS) {
      const claimed = await pool.query<{
        id: number;
        email: string;
        name: string;
        subject: string;
        message: string;
      }>(
        `WITH next_recipient AS (
           SELECT r."id"
           FROM "admin_email_recipients" r
           WHERE r."job_id" = $1
             AND (
               r."status" = 'queued'
               OR (r."status" = 'sending' AND r."updated_at" < now() - interval '5 minutes')
             )
           ORDER BY r."id"
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE "admin_email_recipients" r
         SET "status" = 'sending', "attempts" = r."attempts" + 1, "updated_at" = now()
         FROM next_recipient n, "admin_email_jobs" j
         WHERE r."id" = n."id" AND j."id" = r."job_id"
         RETURNING r."id", r."email", r."name", j."subject", j."message"`,
        [jobId]
      );
      const recipient = claimed.rows[0];
      if (!recipient) break;

      try {
        await sendCustomAdminEmail(
          recipient.email,
          recipient.name,
          recipient.subject,
          recipient.message
        );
        await pool.query(
          `UPDATE "admin_email_recipients"
           SET "status" = 'sent', "sent_at" = now(), "updated_at" = now(), "error" = NULL
           WHERE "id" = $1`,
          [recipient.id]
        );
      } catch (error) {
        await pool.query(
          `UPDATE "admin_email_recipients"
           SET "status" = 'failed', "error" = $2, "updated_at" = now()
           WHERE "id" = $1`,
          [recipient.id, String(error).slice(0, 500)]
        );
      }
    }

    const result = await refreshJobStatus(jobId);
    log.info({ jobId, result }, "admin.custom_email.job_progress");
    shouldContinue = Boolean(
      result && (result.status === "queued" || result.status === "processing")
    );
  })();

  const work = execution
    .catch((error) => {
      log.error({ jobId, error }, "admin.custom_email.job_error");
    })
    .finally(async () => {
      processingJobs.delete(jobId);
      if (shouldContinue) {
        await requestJobContinuation(jobId, log);
      }
    });

  void (async () => {
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(work);
    } catch {
      await work;
    }
  })();
  return true;
}

export async function startPendingAdminEmailJobs(log: QueueLogger): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `SELECT DISTINCT j."id"
     FROM "admin_email_jobs" j
     JOIN "admin_email_recipients" r ON r."job_id" = j."id"
     WHERE j."status" IN ('queued', 'processing')
       AND r."status" IN ('queued', 'sending')
     ORDER BY j."id"
     LIMIT 5`
  );
  let started = 0;
  for (const job of result.rows) {
    if (startAdminEmailJob(job.id, log)) started += 1;
  }
  return started;
}