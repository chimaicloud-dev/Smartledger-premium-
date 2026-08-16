import { Router, type IRouter, type Request } from "express";
import { db, usersTable, holdingsTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { DepositBody, WithdrawBody, ConvertCryptoBody } from "@workspace/api-zod";
import { fetchForexPrices, getForexAssetMeta } from "../lib/forex";
import { COIN_INFO } from "../lib/coins";
import { getPriceMap } from "./market";
import { methodToSymbol } from "../lib/withdraw-methods";
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

  const [fromHolding] = await db
    .select()
    .from(holdingsTable)
    .where(and(eq(holdingsTable.userId, req.session.userId), eq(holdingsTable.symbol, fromSym)))
    .limit(1);

  if (!fromHolding || fromHolding.amount < fromAmount) {
    res.status(400).json({ error: `Insufficient ${fromSym} balance` });
    return;
  }

  // Apply tiny conversion spread (0.1%) like Binance Convert
  const fromPrice = fromInfo.price;
  const toPrice = toInfo.price;
  const usdValue = fromAmount * fromPrice;
  const toAmount = (usdValue * 0.999) / toPrice;
  const rate = toAmount / fromAmount;

  // Deduct from-coin atomically — the WHERE guard prevents concurrent requests
  // from double-spending the same balance.
  const [debited] = await db
    .update(holdingsTable)
    .set({ amount: sql`${holdingsTable.amount} - ${fromAmount}`, updatedAt: new Date() })
    .where(and(eq(holdingsTable.id, fromHolding.id), sql`${holdingsTable.amount} >= ${fromAmount}`))
    .returning();
  if (!debited) {
    res.status(400).json({ error: `Insufficient ${fromSym} balance` });
    return;
  }
  if (debited.amount <= 0.0000001) {
    await db
      .delete(holdingsTable)
      .where(and(eq(holdingsTable.id, fromHolding.id), sql`${holdingsTable.amount} <= 0.0000001`));
  }

  // Credit to-coin
  const [toHolding] = await db
    .select()
    .from(holdingsTable)
    .where(and(eq(holdingsTable.userId, req.session.userId), eq(holdingsTable.symbol, toSym)))
    .limit(1);

  if (toHolding) {
    const newAmount = toHolding.amount + toAmount;
    const newAvg = (toHolding.avgBuyPrice * toHolding.amount + toPrice * toAmount) / newAmount;
    await db
      .update(holdingsTable)
      .set({
        amount: sql`${holdingsTable.amount} + ${toAmount}`,
        avgBuyPrice: newAvg,
        updatedAt: new Date(),
      })
      .where(eq(holdingsTable.id, toHolding.id));
  } else {
    await db.insert(holdingsTable).values({
      userId: req.session.userId,
      coin: toInfo.name,
      symbol: toSym,
      amount: toAmount,
      avgBuyPrice: toPrice,
    });
  }

  await db.insert(transactionsTable).values({
    userId: req.session.userId,
    type: "convert",
    coin: `${fromSym} → ${toSym}`,
    symbol: toSym,
    amount: toAmount,
    usdAmount: usdValue,
    price: toPrice,
    status: "completed",
  });

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

  const { amount, method, address } = parsed.data;

  const sym = methodToSymbol(method);
  if (!sym) {
    res.status(400).json({ error: "Unknown withdrawal method. Only crypto withdrawals are supported." });
    return;
  }
  if (amount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
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

  // amount is in coin units — check and debit the coin's balance
  const [holding] = await db
    .select()
    .from(holdingsTable)
    .where(and(eq(holdingsTable.userId, user.id), eq(holdingsTable.symbol, sym)))
    .limit(1);

  if (!holding || holding.amount < amount) {
    res.status(400).json({ error: `Insufficient ${sym} balance` });
    return;
  }

  // Atomic conditional debit — guards against concurrent withdrawals double-spending.
  const [debitedHolding] = await db
    .update(holdingsTable)
    .set({ amount: sql`${holdingsTable.amount} - ${amount}`, updatedAt: new Date() })
    .where(and(eq(holdingsTable.id, holding.id), sql`${holdingsTable.amount} >= ${amount}`))
    .returning();
  if (!debitedHolding) {
    res.status(400).json({ error: `Insufficient ${sym} balance` });
    return;
  }

  const assetInfo = await resolveAssetPrice(req, sym);
  const usdValue = amount * (assetInfo?.price ?? 0);

  const [tx] = await db
    .insert(transactionsTable)
    .values({
      userId: user.id,
      type: "withdraw",
      coin: method,
      symbol: address ?? null,
      amount,
      usdAmount: usdValue,
      price: assetInfo?.price ?? null,
      status: "pending",
    })
    .returning();

  sendWithdrawalRequestedEmail(user.email, user.name, { amount: usdValue, method: `${amount} ${sym} (${method})`, address });
  notifyAdminWithdrawalRequested(user.name, { amount: usdValue, method: `${amount} ${sym} (${method})`, address });

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
