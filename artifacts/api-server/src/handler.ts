import app, { sessionStore } from "./app";
import { pool } from "@workspace/db";
import { bootstrapAdmin } from "./lib/admin";
import { logger } from "./lib/logger";

// Single shared init promise — all requests wait for it on cold start
let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      logger.info({ attempt }, "db.ready");
      break;
    } catch (err: any) {
      if (attempt < 10) {
        const delay = Math.min(2000 * attempt, 8000);
        logger.warn({ attempt, delay, msg: err?.message }, "db.waking");
        await new Promise((r) => setTimeout(r, delay));
      } else {
        logger.error({ err }, "db.unavailable");
      }
    }
  }
  await sessionStore.init().catch((err) => {
    logger.error({ err }, "session.store.init.failed");
  });
  await bootstrapAdmin(logger).catch((err) => {
    logger.error({ err }, "admin.bootstrap.failed");
  });
}

// Export a handler that guarantees init is complete before Express handles the request
export default function handler(req: any, res: any): void {
  if (!initPromise) initPromise = init();
  initPromise
    .then(() => app(req, res))
    .catch((err) => {
      logger.error({ err }, "init.failed");
      if (!res.headersSent) {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: "Service starting, please retry" }));
      }
    });
}
