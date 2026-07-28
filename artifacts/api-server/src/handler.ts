import app, { sessionStore } from "./app";
import { pool } from "@workspace/db";
import { bootstrapAdmin } from "./lib/admin";
import { logger } from "./lib/logger";

let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      logger.info({ attempt }, "db.ready");
      break;
    } catch (err: any) {
      if (attempt < 10) {
        const delay = 2000 * attempt;
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

void init();

export default app;
