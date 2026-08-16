import { Router, type IRouter } from "express";
import { db, usersTable, holdingsTable, investmentsTable, transactionsTable, siteSettingsTable } from "@workspace/db";
import { and, eq, sql, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { DEFAULT_SETTINGS } from "./settings";
import { getPriceMap } from "./market";
import { debitUsdAcrossHoldings } from "../lib/balance";

// Sentinel to roll back the investment transaction on insufficient funds.
class InsufficientBalanceError extends Error {}

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PLAN_DURATION_DAYS = 30;

// Server-side source of truth for plan tiers (mirrors the frontend cards).
// min/max/dailyPct are the built-in defaults; admins can override them via
// site settings (plan_<id>_min / _max / _daily_pct), edited in the admin panel.
const PLANS: Record<string, { name: string; min: number; max: number | null; dailyPct: number }> = {
  starter: { name: "Starter", min: 50, max: 499, dailyPct: 0.02 },
  balanced: { name: "Balanced", min: 500, max: 999, dailyPct: 0.015 },
  upgrade: { name: "Upgrade", min: 1000, max: 4999, dailyPct: 0.01 },
  "pro-trader": { name: "Pro Trader", min: 5000, max: 9999, dailyPct: 0.008 },
  professional: { name: "Professional", min: 10000, max: null, dailyPct: 0.005 },
};

/**
 * Returns the effective plan config: built-in defaults overridden by any
 * admin-edited site settings. Invalid/empty overrides fall back to defaults
 * ("" or invalid max = unlimited only for plans whose default max is null).
 */
export async function getEffectivePlan(planId: string): Promise<{ name: string; min: number; max: number | null; dailyPct: number } | null> {
  const base = PLANS[planId];
  if (!base) return null;

  const keys = [`plan_${planId}_min`, `plan_${planId}_max`, `plan_${planId}_daily_pct`];
  const rows = await db.select().from(siteSettingsTable);
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? DEFAULT_SETTINGS[k] ?? "";

  const minRaw = parseFloat(get(keys[0]));
  const maxStr = get(keys[1]).trim();
  const maxRaw = maxStr === "" ? null : parseFloat(maxStr);
  const pctRaw = parseFloat(get(keys[2]));

  const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : base.min;
  const max = maxRaw === null ? null : Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : base.max;
  // Setting stores percent per day (e.g. "2" = 2%); clamp to a sane 0–100%.
  const dailyPct = Number.isFinite(pctRaw) && pctRaw > 0 && pctRaw <= 100 ? pctRaw / 100 : base.dailyPct;

  return { name: base.name, min, max, dailyPct };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function creditUsdt(tx: Tx, userId: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  const updated = await tx
    .update(holdingsTable)
    .set({ amount: sql`${holdingsTable.amount} + ${amount}`, updatedAt: new Date() })
    .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.symbol, "USDT")))
    .returning({ id: holdingsTable.id });
  if (updated.length === 0) {
    await tx.insert(holdingsTable).values({
      userId,
      coin: "Tether",
      symbol: "USDT",
      amount,
      avgBuyPrice: 1,
    });
  }
}

/**
 * Lazily accrues daily earnings for a user's active investments and releases
 * capital for matured ones. Safe to call on every read; each 24h period is
 * paid at most once because the period counter is claimed atomically.
 */
export async function accrueInvestments(userId?: number): Promise<void> {
  const now = new Date();
  const active = await db
    .select()
    .from(investmentsTable)
    .where(
      userId !== undefined
        ? and(eq(investmentsTable.status, "active"), eq(investmentsTable.userId, userId))
        : eq(investmentsTable.status, "active")
    );

  for (const inv of active) {
    const elapsedDays = Math.min(
      Math.floor((now.getTime() - inv.startedAt.getTime()) / DAY_MS),
      PLAN_DURATION_DAYS
    );
    const daysToPay = elapsedDays - inv.daysAccrued;

    if (daysToPay > 0) {
      const profit = inv.amount * inv.dailyPct * daysToPay;
      // One transaction: claim the periods (compare-and-set so a concurrent
      // request can't double-pay), credit the balance, and write the ledger
      // row. All commit or roll back together.
      await db.transaction(async (tx) => {
        const claimed = await tx
          .update(investmentsTable)
          .set({
            daysAccrued: elapsedDays,
            earned: sql`${investmentsTable.earned} + ${profit}`,
          })
          .where(and(eq(investmentsTable.id, inv.id), eq(investmentsTable.daysAccrued, inv.daysAccrued)))
          .returning({ id: investmentsTable.id });
        if (claimed.length === 0) return; // another request already paid these periods
        await creditUsdt(tx, inv.userId, profit);
        await tx.insert(transactionsTable).values({
          userId: inv.userId,
          type: "deposit",
          coin: "Tether",
          symbol: "USDT",
          amount: profit,
          usdAmount: profit,
          price: 1,
          status: "completed",
        });
      });
    }

    // Matured: release the locked capital back to the USDT balance, in one
    // transaction with the status flip so it can't complete without paying.
    if (now.getTime() >= inv.endsAt.getTime()) {
      await db.transaction(async (tx) => {
        const completed = await tx
          .update(investmentsTable)
          .set({ status: "completed", completedAt: now })
          .where(and(eq(investmentsTable.id, inv.id), eq(investmentsTable.status, "active")))
          .returning({ id: investmentsTable.id });
        if (completed.length === 0) return; // already released elsewhere
        await creditUsdt(tx, inv.userId, inv.amount);
      });
    }
  }
}

const router: IRouter = Router();

function serialize(inv: typeof investmentsTable.$inferSelect) {
  return {
    id: inv.id,
    planId: inv.planId,
    planName: inv.planName,
    amount: inv.amount,
    dailyPct: inv.dailyPct,
    earned: inv.earned,
    daysAccrued: inv.daysAccrued,
    status: inv.status,
    startedAt: inv.startedAt.toISOString(),
    endsAt: inv.endsAt.toISOString(),
    completedAt: inv.completedAt ? inv.completedAt.toISOString() : null,
  };
}

router.get("/investments", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  // Never blank the invest page if the investments table is missing (e.g. a
  // not-yet-migrated production DB) — return an empty list instead of a 500.
  try {
    await accrueInvestments(req.session.userId);
    const rows = await db
      .select()
      .from(investmentsTable)
      .where(eq(investmentsTable.userId, req.session.userId))
      .orderBy(desc(investmentsTable.startedAt));
    res.json(rows.map(serialize));
  } catch (err) {
    req.log.error({ err }, "investments.list_failed");
    res.json([]);
  }
});

const CreateInvestmentBody = z.object({
  planId: z.string(),
  amount: z.number().positive(),
});

router.post("/investments", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateInvestmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { planId, amount } = parsed.data;
  const plan = await getEffectivePlan(planId);
  if (!plan) {
    res.status(400).json({ error: "Unknown plan" });
    return;
  }
  if (amount < plan.min || (plan.max !== null && amount > plan.max)) {
    res.status(400).json({
      error: `Amount for the ${plan.name} plan must be between $${plan.min}${plan.max !== null ? ` and $${plan.max}` : " and up"}`,
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  // One transaction: debit the invested USD across ALL holdings (USDT first,
  // then other coins at live prices — conditional updates, so a concurrent
  // request can't overdraw) and create the locked investment together.
  const priceMap = await getPriceMap(req);
  const now = new Date();
  const inv = await db.transaction(async (tx) => {
    const legs = await debitUsdAcrossHoldings(tx, user.id, amount, priceMap);
    if (!legs) {
      throw new InsufficientBalanceError();
    }

    const [created] = await tx
      .insert(investmentsTable)
      .values({
        userId: user.id,
        planId,
        planName: plan.name,
        amount,
        dailyPct: plan.dailyPct,
        earned: 0,
        daysAccrued: 0,
        status: "active",
        endsAt: new Date(now.getTime() + PLAN_DURATION_DAYS * DAY_MS),
      })
      .returning();
    return created;
  }).catch((err) => {
    if (err instanceof InsufficientBalanceError) return null;
    throw err;
  });

  if (!inv) {
    res.status(400).json({ error: "Insufficient balance — your total account value doesn't cover this amount" });
    return;
  }

  req.log.info({ userId: user.id, planId, amount }, "investment.created");
  res.json(serialize(inv));
});

export default router;
