import { Router } from "express";
import { cleanupExpiredResetTokens } from "../lib/cleanupResetTokens";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/cron/cleanup
 *
 * Called by the Vercel cron scheduler once per day to delete expired or used
 * password reset tokens. Protected by the CRON_SECRET environment variable so
 * arbitrary callers cannot trigger it.
 */
router.get("/cron/cleanup", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers["authorization"];

  if (!secret || authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await cleanupExpiredResetTokens(logger);
  res.json({ ok: true });
});

export default router;
