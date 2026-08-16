import { Router } from "express";
import { cleanupExpiredResetTokens } from "../lib/cleanupResetTokens";
import { accrueInvestments } from "./investments";
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
  // Pay out daily investment earnings / release matured capital for all users,
  // so balances stay current even for users who don't log in.
  try {
    await accrueInvestments();
  } catch (err) {
    logger.error({ err }, "cron.accrueInvestments.error");
    // Report failure so the Vercel cron dashboard shows a failed invocation
    // and the run is visibly retryable.
    res.status(500).json({ ok: false, error: "investment accrual failed" });
    return;
  }
  res.json({ ok: true });
});

export default router;
