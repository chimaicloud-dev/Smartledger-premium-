import { Router, type IRouter, type Request } from "express";
import { db, usersTable, holdingsTable, transactionsTable, withdrawalAddressesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { DepositBody, WithdrawBody, ConvertCryptoBody } from "@workspace/api-zod";
import { fetchForexPrices, getForexAssetMeta } from "../lib/forex";
import { COIN_INFO } from "../lib/coins";
import { getPriceMap } from "./market";
import { debitUsdAcrossHoldings } from "../lib/balance";

// Sentinel to roll back a multi-coin debit transaction on insufficient funds.
class InsufficientBalanceError extends Error {}
class SavedAddressMismatchError extends Error {}
import { isCanonicalWithdrawalMethod, methodToSymbol } from "../lib/withdraw-methods";
import { sendWithdrawalRequestedEmail, sendDepositReceivedEmail, notifyAdminDepositReceived, notifyAdminWithdrawalRequested } from "../lib/email";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

async function resolveAssetPrice(req: Request, symbol: string): Promise<{ name: string; price: number } | null> {
  const sym = symbol.toUpperCase();
  if (COIN_INFO[sym]) {
    // Prefer the live market rate; COIN_INFO's static price is only a fallback
    // (otherwise deposits get recorded at stale rates like BTC = $67,500).
    try {
      const live = (await getPriceMap(req))[sym];
      if (live && live > 0) return { name: COIN_INFO[sym].name, price: live };
    } catch {
      // fall through to static price
    }
    return COIN_INFO[sym];
  }

  const meta = getForexAssetMeta(sym);
  if (!meta) return null;

  const rows = await fetchForexPrices(req);
  const row = rows.find((r) => r.symbol === sym);
  if (!row) return null;
  return { name: meta.name, price: row.price };
}

const router: IRouter = Router();

router.get("/withdrawal-addresses", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select({ method: withdrawalAddressesTable.method, address: withdrawalAddressesTable.address })
    .from(withdrawalAddressesTable)
    .where(eq(withdrawalAddressesTable.userId, req.session.userId));
  res.json(rows);
});

router.delete("/withdrawal-addresses/:method", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  await db.delete(withdrawalAddressesTable).where(and(
    eq(withdrawalAddressesTable.userId, req.session.userId),
    eq(withdrawalAddressesTable.method, req.params.method),
  ));
  res.status(204).send();
});

router.get("/", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, req.session.userId))
    .orderBy(transactionsTable.createdAt);

  res.json(
    txs.reverse().map((tx) => ({
      id: tx.id,
      type: tx.type,
      coin: tx.coin,
      symbol: tx.symbol,
      amount: tx.amount,
      usdAmount: tx.usdAmount,
      price: tx.price,
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
    }))
  );
});

router.post("/buy", async (_req, res) => {
  res.status(410).json({ error: "USD trading has been removed. Use Convert to swap between coins." });
});

router.post("/sell", async (_req, res) => {
  res.status(410).json({ error: "USD trading has been removed. Use Convert to swap between coins." });
});

router.post("/deposit", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = DepositBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { amount, symbol } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);

  // Per-coin deposit: pending until admin approves
  if (symbol) {
    const sym = symbol.toUpperCase();
    const assetInfo = await resolveAssetPrice(req, sym);
    if (!assetInfo) {
      res.status(400).json({ error: "Unknown asset" });
      return;
    }

    const coinAmount = amount;
    const usdValue = coinAmount * assetInfo.price;

    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId: user.id,
        type: "deposit",
        coin: assetInfo.name,
        symbol: sym,
        amount: coinAmount,
        usdAmount: usdValue,
        price: assetInfo.price,
        status: "pending",
      })
      .returning();

    req.log.info({ userId: user.id, symbol: sym, coinAmount }, "deposit.pending");

    sendDepositReceivedEmail(user.email, user.name, { usdAmount: usdValue, coin: assetInfo.name, amount: coinAmount, symbol: sym });
    notifyAdminDepositReceived(user.name, { usdAmount: usdValue, coin: assetInfo.name, amount: coinAmount, symbol: sym });

    res.json({
      id: tx.id,
      type: tx.type,
      coin: tx.coin,
      symbol: tx.symbol,
      amount: tx.amount,
      usdAmount: tx.usdAmount,
      price: tx.price,
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
    });
    return;
  }

  // Fiat/USD deposits are no longer supported — every deposit must be a specific coin.
  res.status(400).json({ error: "Fiat deposits are not supported. Choose a coin to deposit." });
});

router.post("/convert", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = ConvertCryptoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { fromSymbol, toSymbol, fromAmount } = parsed.data;
  const fromSym = fromSymbol.toUpperCase();
  const toSym = toSymbol.toUpperCase();

  if (fromSym === toSym) {
    res.status(400).json({ error: "Cannot convert to the same coin" });
    return;
  }
  if (fromAmount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
  }

  const fromInfo = await resolveAssetPrice(req, fromSym);
  const toInfo = await resolveAssetPrice(req, toSym);
  if (!fromInfo || !toInfo) {
    res.status(400).json({ error: "Unknown asset" });
    return;
  }

  // Apply tiny conversion spread (0.1%) like Binance Convert
  const fromPrice = fromInfo.price;
  const toPrice = toInfo.price;
  const usdValue = fromAmount * fromPrice;
  const toAmount = (usdValue * 0.999) / toPrice;
  const rate = toAmount / fromAmount;

  // ONE transaction for the whole conversion — debit, credit, and ledger row
  // commit together, so a crash mid-way can never destroy funds and a
  // concurrent spend can't race the credit.
  const userId = req.session.userId;
  const priceMap = fromSym === "USDT" ? await getPriceMap(req) : null;
  const ok = await db
    .transaction(async (tx) => {
      if (fromSym === "USDT") {
        // Spending USDT (buys / forex orders): draw the USD value from the
        // user's WHOLE account — USDT first, then other coins at live prices —
        // so users aren't limited to their USDT balance only.
        const legs = await debitUsdAcrossHoldings(tx, userId, usdValue, priceMap!);
        if (!legs) throw new InsufficientBalanceError();
      } else {
        // Deduct from-coin atomically — the WHERE guard prevents concurrent
        // requests from double-spending the same balance.
        const debited = await tx
          .update(holdingsTable)
          .set({ amount: sql`${holdingsTable.amount} - ${fromAmount}`, updatedAt: new Date() })
          .where(
            and(
              eq(holdingsTable.userId, userId),
              eq(holdingsTable.symbol, fromSym),
              sql`${holdingsTable.amount} >= ${fromAmount}`
            )
          )
          .returning({ id: holdingsTable.id });
        if (debited.length === 0) throw new InsufficientBalanceError();
        await tx
          .delete(holdingsTable)
          .where(and(eq(holdingsTable.id, debited[0].id), sql`${holdingsTable.amount} <= 0.0000001`));
      }

      // Credit to-coin. Atomic increment; if no row was updated (row missing
      // or deleted by a concurrent spend), insert a fresh one — all inside
      // this transaction, so the credit can never be lost.
      const [toHolding] = await tx
        .select()
        .from(holdingsTable)
        .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.symbol, toSym)))
        .limit(1);

      let credited = false;
      if (toHolding) {
        const newAmount = toHolding.amount + toAmount;
        const newAvg = (toHolding.avgBuyPrice * toHolding.amount + toPrice * toAmount) / newAmount;
        const updated = await tx
          .update(holdingsTable)
          .set({
            amount: sql`${holdingsTable.amount} + ${toAmount}`,
            avgBuyPrice: newAvg,
            updatedAt: new Date(),
          })
          .where(eq(holdingsTable.id, toHolding.id))
          .returning({ id: holdingsTable.id });
        credited = updated.length > 0;
      }
      if (!credited) {
        await tx.insert(holdingsTable).values({
          userId,
          coin: toInfo.name,
          symbol: toSym,
          amount: toAmount,
          avgBuyPrice: toPrice,
        });
      }

      await tx.insert(transactionsTable).values({
        userId,
        type: "convert",
        coin: `${fromSym} → ${toSym}`,
        symbol: toSym,
        amount: toAmount,
        usdAmount: usdValue,
        price: toPrice,
        status: "completed",
      });
      return true;
    })
    .catch((err: unknown) => {
      if (err instanceof InsufficientBalanceError) return false;
      throw err;
    });

  if (!ok) {
    res.status(400).json({
      error:
        fromSym === "USDT"
          ? "Insufficient balance — your total account value doesn't cover this amount"
          : `Insufficient ${fromSym} balance`,
    });
    return;
  }

  req.log.info({ fromSym, toSym, fromAmount, toAmount, usdValue }, "convert.completed");

  res.json({ fromSymbol: fromSym, toSymbol: toSym, fromAmount, toAmount, rate, usdValue });
});

router.post("/withdraw", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = WithdrawBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { amount, method, address, timezone } = parsed.data;
  const normalizedAddress = address?.trim();
  if (!normalizedAddress) {
    res.status(400).json({ error: "A withdrawal wallet address is required" });
    return;
  }

  const sym = methodToSymbol(method);
  if (!sym || !isCanonicalWithdrawalMethod(method)) {
    res.status(400).json({ error: "Unknown withdrawal method. Only crypto withdrawals are supported." });
    return;
  }
  if (amount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
  }
  let deviceTimezone: string | undefined;
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      deviceTimezone = timezone;
    } catch {
      res.status(400).json({ error: "Invalid device timezone" });
      return;
    }
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  // Withdrawals require a verified KYC. Deposits, investments, and everything
  // else remain open to unverified users.
  if (user.kycStatus !== "verified") {
    res.status(403).json({
      error: "KYC_REQUIRED",
      message: "Please complete KYC verification before making a withdrawal.",
    });
    return;
  }

  const assetInfo = await resolveAssetPrice(req, sym);
  const usdValue = amount * (assetInfo?.price ?? 0);
  let tx;
  try {
    tx = await db.transaction(async (trx) => {
      // First use claims the permanent address for this network. The unique
      // constraint makes concurrent first withdrawals agree on one address.
      await trx.insert(withdrawalAddressesTable)
        .values({ userId: user.id, method, address: normalizedAddress })
        .onConflictDoNothing();

      const [savedAddress] = await trx
        .select()
        .from(withdrawalAddressesTable)
        .where(and(
          eq(withdrawalAddressesTable.userId, user.id),
          eq(withdrawalAddressesTable.method, method),
        ))
        .limit(1);
      if (!savedAddress || savedAddress.address !== normalizedAddress) {
        throw new SavedAddressMismatchError();
      }

      const [holding] = await trx
        .select()
        .from(holdingsTable)
        .where(and(eq(holdingsTable.userId, user.id), eq(holdingsTable.symbol, sym)))
        .limit(1);
      if (!holding) throw new InsufficientBalanceError();

      const [debitedHolding] = await trx
        .update(holdingsTable)
        .set({ amount: sql`${holdingsTable.amount} - ${amount}`, updatedAt: new Date() })
        .where(and(eq(holdingsTable.id, holding.id), sql`${holdingsTable.amount} >= ${amount}`))
        .returning();
      if (!debitedHolding) throw new InsufficientBalanceError();

      const [created] = await trx
        .insert(transactionsTable)
        .values({
          userId: user.id,
          type: "withdraw",
          coin: method,
          symbol: normalizedAddress,
          amount,
          usdAmount: usdValue,
          price: assetInfo?.price ?? null,
          status: "pending",
        })
        .returning();
      if (deviceTimezone && deviceTimezone !== user.timezone) {
        await trx.update(usersTable)
          .set({ timezone: deviceTimezone })
          .where(eq(usersTable.id, user.id));
      }
      return created;
    });
  } catch (err) {
    if (err instanceof SavedAddressMismatchError) {
      res.status(409).json({
        error: "Delete your saved address before using a different one for this network.",
      });
      return;
    }
    if (err instanceof InsufficientBalanceError) {
      res.status(400).json({ error: `Insufficient ${sym} balance` });
      return;
    }
    throw err;
  }

  sendWithdrawalRequestedEmail(user.email, user.name, {
    amount: usdValue,
    method: `${amount} ${sym} (${method})`,
    address: normalizedAddress,
    timezone: deviceTimezone ?? user.timezone,
  });
  notifyAdminWithdrawalRequested(user.name, { amount: usdValue, method: `${amount} ${sym} (${method})`, address: normalizedAddress });

  res.json({
    id: tx.id,
    type: tx.type,
    coin: tx.coin,
    symbol: tx.symbol,
    amount: tx.amount,
    usdAmount: tx.usdAmount,
    price: tx.price,
    status: tx.status,
    createdAt: tx.createdAt.toISOString(),
  });
});

export default router;
