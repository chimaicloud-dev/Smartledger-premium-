import { holdingsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

// Minimal transaction-or-db interface used below (drizzle tx and db both satisfy it).
type DbLike = {
  select: any;
  update: any;
  delete: any;
};

export type DebitLeg = { symbol: string; amount: number; usd: number };

/**
 * Debits `usd` worth of value from a user's holdings: USDT first (1:1), then
 * other coins at the supplied live prices, largest USD value first.
 *
 * Money-safety: every deduction is a conditional UPDATE (amount >= needed), so
 * a concurrent spend can't double-spend the same balance; call inside a DB
 * transaction and treat a null return as "insufficient funds" (the transaction
 * will roll back any partial legs when the caller throws/returns null).
 *
 * Returns the list of debited legs, or null if the user's total value at the
 * given prices can't cover `usd`.
 */
export async function debitUsdAcrossHoldings(
  tx: DbLike,
  userId: number,
  usd: number,
  priceMap: Record<string, number>
): Promise<DebitLeg[] | null> {
  if (!(usd > 0)) return null;

  const holdings: { id: number; symbol: string; amount: number }[] = await tx
    .select({ id: holdingsTable.id, symbol: holdingsTable.symbol, amount: holdingsTable.amount })
    .from(holdingsTable)
    .where(eq(holdingsTable.userId, userId));

  const priced = holdings
    .filter((h) => h.amount > 0)
    .map((h) => {
      const price = h.symbol === "USDT" ? 1 : priceMap[h.symbol] ?? 0;
      return { ...h, price, usdValue: h.amount * price };
    })
    .filter((h) => h.price > 0);

  // USDT first, then largest balances — minimizes the number of coins touched.
  priced.sort((a, b) => (a.symbol === "USDT" ? -1 : b.symbol === "USDT" ? 1 : b.usdValue - a.usdValue));

  const total = priced.reduce((s, h) => s + h.usdValue, 0);
  // Tiny epsilon so float rounding doesn't reject a full-balance spend.
  if (total < usd - 1e-6) return null;

  const legs: DebitLeg[] = [];
  let remaining = usd;

  for (const h of priced) {
    if (remaining <= 1e-9) break;
    const takeUsd = Math.min(remaining, h.usdValue);
    // Cap at the held amount so float division can't overdraw the guard.
    const takeCoin = Math.min(takeUsd / h.price, h.amount);

    const debited = await tx
      .update(holdingsTable)
      .set({ amount: sql`${holdingsTable.amount} - ${takeCoin}`, updatedAt: new Date() })
      .where(and(eq(holdingsTable.id, h.id), sql`${holdingsTable.amount} >= ${takeCoin}`))
      .returning({ id: holdingsTable.id });
    if (debited.length === 0) return null; // concurrent spend won the race — abort

    await tx
      .delete(holdingsTable)
      .where(and(eq(holdingsTable.id, h.id), sql`${holdingsTable.amount} <= 0.0000001`));

    legs.push({ symbol: h.symbol, amount: takeCoin, usd: takeUsd });
    remaining -= takeUsd;
  }

  if (remaining > 1e-6) return null; // shouldn't happen given the total check
  return legs;
}
