import app, { sessionStore } from "./app";
import { logger } from "./lib/logger";
import { bootstrapAdmin } from "./lib/admin";
import { scheduleResetTokenCleanup } from "./lib/cleanupResetTokens";
import { ensureSchema } from "./lib/ensureSchema";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function waitForDatabase(maxAttempts = 10, baseDelayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      logger.info({ attempt }, "db.ready");
      return;
    } catch (err: any) {
      const isDisabled = err?.message?.includes("endpoint has been disabled") ||
        err?.message?.includes("endpoint is disabled");
      const isStarting = err?.message?.includes("endpoint is starting") ||
        err?.message?.includes("server closed the connection");
      if ((isDisabled || isStarting) && attempt < maxAttempts) {
        const delay = baseDelayMs * attempt;
        logger.warn({ attempt, delay, err: err?.message }, "db.waking");
        await new Promise((r) => setTimeout(r, delay));
      } else if (attempt < maxAttempts) {
        const delay = baseDelayMs;
        logger.warn({ attempt, delay, err: err?.message }, "db.retrying");
        await new Promise((r) => setTimeout(r, delay));
      } else {
        logger.error({ err }, "db.unavailable");
      }
    }
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void waitForDatabase().then(async () => {
    await sessionStore.init();
    await bootstrapAdmin(logger);
    await ensureSchema(logger);
    scheduleResetTokenCleanup(logger);
  });
});
