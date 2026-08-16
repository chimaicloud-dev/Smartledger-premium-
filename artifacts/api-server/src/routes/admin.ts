import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, holdingsTable, transactionsTable, siteSettingsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/admin";
import { methodToSymbol } from "../lib/withdraw-methods";
import { COIN_INFO } from "../lib/coins";
import { DEFAULT_SETTINGS } from "./settings";
import {
  sendDepositApprovedEmail,
  sendDepositRejectedEmail,
  sendWithdrawalCompletedEmail,
  sendWithdrawalRejectedEmail,
  sendKycStatusEmail,
} from "../lib/email";

const router: IRouter = Router();

router.use(requireAdmin);

router.get("/stats", async (_req, res) => {
  const allUsers = await db.select().from(usersTable);
  const allHoldings = await db.select().from(holdingsTable);
  const allTxs = await db.select().from(transactionsTable);

  const totalCryptoValue = allHoldings.reduce((sum, h) => {
    const price = COIN_INFO[h.symbol]?.price ?? h.avgBuyPrice;
    return sum + h.amount * price;
  }, 0);

  const stats = {
    totalUsers: allUsers.length,
    totalAdmins: allUsers.filter((u) => u.role === "admin").length,
    verifiedUsers: allUsers.filter((u) => u.kycStatus === "verified").length,
    suspendedUsers: allUsers.filter((u) => u.status === "suspended").length,
    totalUsdBalance: 0,
    totalCryptoValue,
    pendingDeposits: allTxs.filter((t) => t.type === "deposit" && t.status === "pending").length,
    pendingWithdrawals: allTxs.filter((t) => t.type === "withdraw" && t.status === "pending").length,
    completedTransactions: allTxs.filter((t) => t.status === "completed").length,
    totalVolumeUsd: allTxs.filter((t) => t.status === "completed").reduce((s, t) => s + t.usdAmount, 0),
  };
  res.json(stats);
});

function userToResponse(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    experience: u.experience,
    usdBalance: u.usdBalance,
    kycStatus: u.kycStatus,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/users", async (req, res) => {
  const search = String(req.query.search || "").toLowerCase().trim();
  const all = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const filtered = search
    ? all.filter(
        (u) =>
          u.email.toLowerCase().includes(search) ||
          u.name.toLowerCase().includes(search) ||
          String(u.id) === search
      )
    : all;
  res.json(filtered.map(userToResponse));
});

router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = req.body as {
    kycStatus?: string;
    role?: string;
    status?: string;
    adjustSymbol?: string;
    adjustAmount?: number;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.kycStatus && ["unverified", "pending", "verified", "rejected"].includes(body.kycStatus)) updates.kycStatus = body.kycStatus;
  if (body.role && ["user", "admin"].includes(body.role)) updates.role = body.role;
  if (body.status && ["active", "suspended"].includes(body.status)) updates.status = body.status;

  // Per-coin balance adjustment (positive = credit, negative = debit)
  if (
    typeof body.adjustAmount === "number" &&
    Number.isFinite(body.adjustAmount) &&
    body.adjustAmount !== 0 &&
    typeof body.adjustSymbol === "string" &&
    body.adjustSymbol.trim()
  ) {
    const sym = body.adjustSymbol.trim().toUpperCase();
    const price = COIN_INFO[sym]?.price ?? 0;
    const coinName = COIN_INFO[sym]?.name ?? sym;
    const [holding] = await db
      .select()
      .from(holdingsTable)
      .where(and(eq(holdingsTable.userId, target.id), eq(holdingsTable.symbol, sym)))
      .limit(1);
    if (holding) {
      const newAmount = Math.max(0, holding.amount + body.adjustAmount);
      await db
        .update(holdingsTable)
        .set({ amount: newAmount, updatedAt: new Date() })
        .where(eq(holdingsTable.id, holding.id));
    } else if (body.adjustAmount > 0) {
      await db.insert(holdingsTable).values({
        userId: target.id,
        coin: coinName,
        symbol: sym,
        amount: body.adjustAmount,
        avgBuyPrice: price,
      });
    }
    await db.insert(transactionsTable).values({
      userId: target.id,
      type: body.adjustAmount > 0 ? "deposit" : "withdraw",
      coin: "Admin Adjustment",
      symbol: sym,
      amount: Math.abs(body.adjustAmount),
      usdAmount: Math.abs(body.adjustAmount) * price,
      status: "completed",
    });
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  req.log.info({ id, updates: Object.keys(updates) }, "admin.user.updated");
  res.json(userToResponse(updated));
});

router.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const adminUser = (req as any).adminUser as typeof usersTable.$inferSelect;
  if (id === adminUser.id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }
  await db.delete(holdingsTable).where(eq(holdingsTable.userId, id));
  await db.delete(transactionsTable).where(eq(transactionsTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  req.log.info({ id }, "admin.user.deleted");
  res.json({ message: "User deleted" });
});

router.get("/transactions", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const userIdFilter = req.query.userId ? Number(req.query.userId) : undefined;

  const rows = await db
    .select({
      id: transactionsTable.id,
      userId: transactionsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      type: transactionsTable.type,
      coin: transactionsTable.coin,
      symbol: transactionsTable.symbol,
      amount: transactionsTable.amount,
      usdAmount: transactionsTable.usdAmount,
      price: transactionsTable.price,
      status: transactionsTable.status,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(500);

  const filtered = rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (type && r.type !== type) return false;
    if (userIdFilter && r.userId !== userIdFilter) return false;
    return true;
  });

  res.json(
    filtered.map((r) => ({
      ...r,
      userEmail: r.userEmail ?? "(deleted)",
      userName: r.userName ?? "(deleted)",
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

async function fetchTxWithUser(id: number) {
  const [row] = await db
    .select({
      id: transactionsTable.id,
      userId: transactionsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      type: transactionsTable.type,
      coin: transactionsTable.coin,
      symbol: transactionsTable.symbol,
      amount: transactionsTable.amount,
      usdAmount: transactionsTable.usdAmount,
      price: transactionsTable.price,
      status: transactionsTable.status,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(eq(transactionsTable.id, id))
    .limit(1);
  return row;
}

router.post("/transactions/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (tx.status !== "pending") {
    res.status(400).json({ error: `Transaction is ${tx.status}, not pending` });
    return;
  }

  if (tx.type === "deposit") {
    // Deposits are now auto-credited on submission, so approval is a no-op for balance.
    // Kept for admin visibility / manual override of old pending deposits.
    if (tx.symbol && tx.amount && tx.amount > 0) {
      const sym = tx.symbol;
      const price = tx.price ?? COIN_INFO[sym]?.price ?? 0;
      const coinName = tx.coin ?? COIN_INFO[sym]?.name ?? sym;
      const [existing] = await db
        .select()
        .from(holdingsTable)
        .where(and(eq(holdingsTable.userId, tx.userId), eq(holdingsTable.symbol, sym)))
        .limit(1);
      if (existing) {
        const newAmount = existing.amount + tx.amount;
        const newAvg = newAmount > 0 ? (existing.avgBuyPrice * existing.amount + price * tx.amount) / newAmount : price;
        await db.update(holdingsTable).set({ amount: newAmount, avgBuyPrice: newAvg, updatedAt: new Date() }).where(eq(holdingsTable.id, existing.id));
      } else {
        await db.insert(holdingsTable).values({
          userId: tx.userId,
          coin: coinName,
          symbol: sym,
          amount: tx.amount,
          avgBuyPrice: price,
        });
      }
    }
    // Fiat deposits are no longer supported — legacy fiat pendings complete without crediting.
  } else if (tx.type === "withdraw") {
    // Balance was already deducted at request time. Approval just finalizes.
  }

  await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.id, id));
  req.log.info({ id, type: tx.type }, "admin.tx.approved");

  const [txUser] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId)).limit(1);
  if (txUser) {
    if (tx.type === "deposit") {
      sendDepositApprovedEmail(txUser.email, { usdAmount: tx.usdAmount, coin: tx.coin, amount: tx.amount, symbol: tx.symbol });
    } else if (tx.type === "withdraw") {
      sendWithdrawalCompletedEmail(txUser.email, { amount: tx.usdAmount, method: tx.coin ?? "USD", address: tx.symbol });
    }
  }
  res.json(await fetchTxWithUser(id));
});

router.post("/transactions/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (tx.status !== "pending") {
    res.status(400).json({ error: `Transaction is ${tx.status}, not pending` });
    return;
  }

  if (tx.type === "withdraw" && tx.amount && tx.amount > 0) {
    // Refund the coin that was debited at request time
    const sym = tx.coin ? methodToSymbol(tx.coin) : null;
    if (sym) {
      const [holding] = await db
        .select()
        .from(holdingsTable)
        .where(and(eq(holdingsTable.userId, tx.userId), eq(holdingsTable.symbol, sym)))
        .limit(1);
      if (holding) {
        await db
          .update(holdingsTable)
          .set({ amount: holding.amount + tx.amount, updatedAt: new Date() })
          .where(eq(holdingsTable.id, holding.id));
      } else {
        await db.insert(holdingsTable).values({
          userId: tx.userId,
          coin: COIN_INFO[sym]?.name ?? sym,
          symbol: sym,
          amount: tx.amount,
          avgBuyPrice: tx.price ?? COIN_INFO[sym]?.price ?? 0,
        });
      }
    }
  }
  // Deposits: nothing to refund (we never credited)

  await db.update(transactionsTable).set({ status: "rejected" }).where(eq(transactionsTable.id, id));
  req.log.info({ id, type: tx.type }, "admin.tx.rejected");

  const [txUser2] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId)).limit(1);
  if (txUser2) {
    if (tx.type === "deposit") {
      sendDepositRejectedEmail(txUser2.email, { usdAmount: tx.usdAmount });
    } else if (tx.type === "withdraw") {
      sendWithdrawalRejectedEmail(txUser2.email, { amount: tx.usdAmount, method: tx.coin ?? "USD" });
    }
  }
  res.json(await fetchTxWithUser(id));
});

// ── KYC management ──────────────────────────────────────────────────────────

router.get("/kyc", async (_req, res) => {
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.kycStatus, "pending"))
    .orderBy(desc(usersTable.createdAt));
  res.json(users.map(userToResponse));
});

router.post("/kyc/:userId/approve", async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const [updated] = await db
    .update(usersTable)
    .set({ kycStatus: "verified" })
    .where(eq(usersTable.id, userId))
    .returning();
  req.log.info({ userId }, "admin.kyc.approved");
  sendKycStatusEmail(user.email, true);
  res.json(userToResponse(updated));
});

router.post("/kyc/:userId/reject", async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const [updated] = await db
    .update(usersTable)
    .set({ kycStatus: "rejected" })
    .where(eq(usersTable.id, userId))
    .returning();
  req.log.info({ userId }, "admin.kyc.rejected");
  sendKycStatusEmail(user.email, false);
  res.json(userToResponse(updated));
});

// ── Create / promote admin ───────────────────────────────────────────────────

router.post("/create-admin", async (req, res) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password and name are required" });
    return;
  }
  const normalised = email.toLowerCase().trim();

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, normalised)).limit(1);
  if (existing) {
    // Promote existing user to admin
    const [updated] = await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, existing.id))
      .returning();
    req.log.info({ id: existing.id, email: normalised }, "admin.create-admin.promoted");
    res.status(201).json(userToResponse(updated));
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(usersTable)
    .values({
      email: normalised,
      password: hashed,
      name: name.trim(),
      experience: "expert",
      usdBalance: 0,
      role: "admin",
      status: "active",
      kycStatus: "verified",
    })
    .returning();
  req.log.info({ id: created.id, email: normalised }, "admin.create-admin.created");
  res.status(201).json(userToResponse(created));
});

// ── Site Settings ────────────────────────────────────────────────────────────

router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  rows.forEach((r) => { result[r.key] = r.value; });
  res.json(result);
});

router.put("/settings", async (req, res) => {
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    res.status(400).json({ error: "Invalid body — expected a flat key/value object" });
    return;
  }
  for (const [key, value] of Object.entries(updates)) {
    if (typeof key !== "string" || typeof value !== "string") continue;
    await db
      .insert(siteSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  req.log.info({ keys: Object.keys(updates) }, "admin.settings.updated");
  res.json({ ok: true });
});

export default router;
