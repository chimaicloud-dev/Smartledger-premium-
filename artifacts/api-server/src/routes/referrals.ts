import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, referralRewardsTable, usersTable } from "@workspace/db";
import { GetReferralSummaryResponse } from "@workspace/api-zod";

declare module "express-session" { interface SessionData { userId: number; } }

const router: IRouter = Router();
router.get("/referrals/summary", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db.select({ referralCode: usersTable.referralCode }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const [referrals] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable)
    .where(eq(usersTable.referredByUserId, req.session.userId));
  const [rewards] = await db.select({ earningsCents: sql<number>`coalesce(sum(${referralRewardsTable.amountCents}), 0)` })
    .from(referralRewardsTable).where(eq(referralRewardsTable.referrerUserId, req.session.userId));
  res.json(GetReferralSummaryResponse.parse({
    referralCode: user.referralCode, referralCount: referrals?.count ?? 0,
    referralEarnings: (rewards?.earningsCents ?? 0) / 100,
  }));
});
export default router;