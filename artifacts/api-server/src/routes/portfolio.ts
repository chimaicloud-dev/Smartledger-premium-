import { Router, type IRouter } from "express";
import { db, usersTable, holdingsTable, transactionsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { COIN_INFO } from "../lib/coins";
import { getPriceMap } from "./market";
import { accrueInvestments } from "./investments";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

router.get("/", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  // Pay out any due daily investment earnings / release matured capital first
  // so the balances below are always up to date.
  await accrueInvestments(req.session.userId);

  const holdings = await db.select().from(holdingsTable).where(eq(holdingsTable.userId, req.session.userId));
  const priceMap = await getPriceMap(req);

  // Sum all pending deposit USD amounts for this user
  const pendingResult = await db
    .select({ total: sql<number>`COALESCE(SUM(usd_amount), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, req.session.userId!),
        eq(transactionsTable.type, "deposit"),
        eq(transactionsTable.status, "pending")
      )
    );
  const pendingDeposits = Number(pendingResult[0]?.total ?? 0);

  const holdingsWithValue = holdings
    .filter((h) => h.amount > 0)
    .map((h) => {
      const currentPrice = priceMap[h.symbol] ?? COIN_INFO[h.symbol]?.price ?? h.avgBuyPrice;
      const currentValue = h.amount * currentPrice;
      const costBasis = h.amount * h.avgBuyPrice;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      return {
        coin: h.coin,
        symbol: h.symbol,
        amount: h.amount,
        avgBuyPrice: h.avgBuyPrice,
        currentPrice,
        currentValue,
        pnl,
        pnlPercent,
      };
    });

  const totalValue = holdingsWithValue.reduce((sum, h) => sum + h.currentValue, 0);

  res.json({
    usdBalance: 0,
    pendingDeposits,
    totalValue,
    holdings: holdingsWithValue,
  });
});

export default router;
