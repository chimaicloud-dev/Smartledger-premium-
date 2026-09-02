import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, holdingsTable, loansTable, transactionsTable } from "@workspace/db";
import {
  CreateLoanBody, GetLoansResponse, RepayLoanParams, RepayLoanResponse,
  GetAdminLoansResponse, ApproveAdminLoanParams, ApproveAdminLoanResponse,
  RejectAdminLoanParams, RejectAdminLoanBody, RejectAdminLoanResponse,
  GetAdminLoanIdNumberParams, GetAdminLoanIdNumberResponse,
} from "@workspace/api-zod";
import { decryptKycIdNumber, encryptKycIdNumber } from "../lib/kyc-id-crypto";
import { requireAdmin } from "../lib/admin";

declare module "express-session" { interface SessionData { userId: number; } }

const plans: Record<string, { name: string; min: number; max: number; apr: number; terms: number[] }> = {
  micro: { name: "Micro", min: 100, max: 2500, apr: 8.5, terms: [7, 14, 30] },
  standard: { name: "Standard", min: 2500, max: 25000, apr: 12, terms: [30, 60, 90] },
  premium: { name: "Premium", min: 25000, max: 100000, apr: 6.5, terms: [90, 180, 365] },
  elite: { name: "Elite", min: 100000, max: 500000, apr: 4.9, terms: [180, 365, 730] },
};

function loanResponse(loan: typeof loansTable.$inferSelect) {
  return {
    id: loan.id, planId: loan.planId, planName: loan.planName, amount: loan.amountCents / 100, apr: loan.apr,
    termDays: loan.termDays, collateralSymbol: loan.collateralSymbol, repaymentAmount: loan.repaymentAmountCents / 100,
    status: loan.status, requestedAt: loan.requestedAt.toISOString(),
    approvedAt: loan.approvedAt?.toISOString() ?? null, dueAt: loan.dueAt?.toISOString() ?? null,
    repaidAt: loan.repaidAt?.toISOString() ?? null, rejectionReason: loan.rejectionReason,
  };
}
function adminLoanResponse(loan: typeof loansTable.$inferSelect) {
  return { ...loanResponse(loan), userId: loan.userId, fullName: loan.fullName, dateOfBirth: loan.dateOfBirth,
    country: loan.country, residentialAddress: loan.residentialAddress, phone: loan.phone, idType: loan.idType,
    employmentStatus: loan.employmentStatus, monthlyIncome: loan.monthlyIncomeCents / 100, purpose: loan.purpose,
    reviewedByUserId: loan.reviewedByUserId };
}
function adult(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number);
  const dob = new Date(Date.UTC(y, m - 1, d));
  const now = new Date();
  return dob.getUTCFullYear() === y && dob.getUTCMonth() === m - 1 && dob.getUTCDate() === d &&
    new Date(Date.UTC(y + 18, m - 1, d)) <= now;
}

const router: IRouter = Router();
router.get("/loans", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const rows = await db.select().from(loansTable).where(eq(loansTable.userId, req.session.userId)).orderBy(desc(loansTable.requestedAt));
  res.json(GetLoansResponse.parse(rows.map(loanResponse)));
});
router.post("/loans", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = CreateLoanBody.safeParse(req.body);
  if (!parsed.success || !Number.isInteger(parsed.data?.termDays) || !adult(parsed.data?.dateOfBirth ?? "")) { res.status(400).json({ error: "Invalid loan application or applicant age" }); return; }
  const input = parsed.data;
  const plan = plans[input.planId];
  if (!plan || input.amount < plan.min || input.amount > plan.max || !plan.terms.includes(input.termDays)) { res.status(400).json({ error: "Invalid loan plan, amount, or term" }); return; }
  const amountCents = Math.round(input.amount * 100);
  const repaymentAmountCents = Math.round(amountCents * (1 + plan.apr / 100 * input.termDays / 365));
  const [loan] = await db.insert(loansTable).values({
    userId: req.session.userId, planId: input.planId, planName: plan.name, amountCents, apr: plan.apr,
    termDays: input.termDays, collateralSymbol: input.collateralSymbol.toUpperCase(), repaymentAmountCents,
    fullName: input.fullName.trim(), dateOfBirth: input.dateOfBirth, country: input.country.trim(),
    residentialAddress: input.residentialAddress.trim(), phone: input.phone.trim(), idType: input.idType,
    idNumber: encryptKycIdNumber(input.idNumber.trim()), employmentStatus: input.employmentStatus.trim(),
    monthlyIncomeCents: Math.round(input.monthlyIncome * 100), purpose: input.purpose.trim(),
  }).returning();
  res.status(201).json(RepayLoanResponse.parse(loanResponse(loan)));
});
router.post("/loans/:id/repay", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = RepayLoanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid loan id" }); return; }
  const [loan] = await db.select().from(loansTable).where(and(eq(loansTable.id, params.data.id), eq(loansTable.userId, req.session.userId))).limit(1);
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }
  if (loan.status !== "approved") { res.status(400).json({ error: "Loan is not eligible for repayment" }); return; }
  const repaid = await db.transaction(async (tx) => {
    const repaymentAmount = loan.repaymentAmountCents / 100;
    const debited = await tx.update(holdingsTable).set({ amount: sql`${holdingsTable.amount} - ${repaymentAmount}`, updatedAt: new Date() })
      .where(and(eq(holdingsTable.userId, loan.userId), eq(holdingsTable.symbol, "USDT"), sql`${holdingsTable.amount} >= ${repaymentAmount}`)).returning();
    if (!debited.length) return undefined;
    const [updated] = await tx.update(loansTable).set({ status: "repaid", repaidAt: new Date() })
      .where(and(eq(loansTable.id, loan.id), eq(loansTable.status, "approved"))).returning();
    if (!updated) throw new Error("Loan state changed during repayment");
    const repaymentLedger = await tx.insert(transactionsTable).values({ userId: loan.userId, loanId: loan.id, type: "loan_repayment", coin: "Tether", symbol: "USDT", amount: repaymentAmount, usdAmount: repaymentAmount, price: 1, status: "completed" }).onConflictDoNothing().returning({ id: transactionsTable.id });
    if (!repaymentLedger.length) throw new Error("Loan repayment ledger already exists");
    return updated;
  });
  if (!repaid) { res.status(400).json({ error: "Insufficient USDT balance" }); return; }
  res.json(RepayLoanResponse.parse(loanResponse(repaid)));
});

router.get("/admin/loans", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(loansTable).orderBy(desc(loansTable.requestedAt));
  res.json(GetAdminLoansResponse.parse(rows.map(adminLoanResponse)));
});
router.post("/admin/loans/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const params = ApproveAdminLoanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid loan id" }); return; }
  const adminId = req.session.userId;
  if (!adminId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [existing] = await db.select().from(loansTable).where(eq(loansTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Loan not found" }); return; }
  const approved = await db.transaction(async (tx) => {
    const now = new Date();
    const [loan] = await tx.update(loansTable).set({ status: "approved", reviewedByUserId: adminId, approvedAt: now, dueAt: new Date(now.getTime() + 86400000 * existing.termDays) })
      .where(and(eq(loansTable.id, params.data.id), eq(loansTable.status, "pending"))).returning();
    if (!loan) return undefined;
    const amount = loan.amountCents / 100;
    await tx.insert(holdingsTable).values({ userId: loan.userId, coin: "Tether", symbol: "USDT", amount, avgBuyPrice: 1 })
      .onConflictDoUpdate({ target: [holdingsTable.userId, holdingsTable.symbol], set: { amount: sql`${holdingsTable.amount} + EXCLUDED.amount`, updatedAt: now } });
    const disbursementLedger = await tx.insert(transactionsTable).values({ userId: loan.userId, loanId: loan.id, type: "loan_disbursement", coin: "Tether", symbol: "USDT", amount, usdAmount: amount, price: 1, status: "completed" }).onConflictDoNothing().returning({ id: transactionsTable.id });
    if (!disbursementLedger.length) throw new Error("Loan disbursement ledger already exists");
    return loan;
  });
  if (!approved) { res.status(400).json({ error: "Loan is not pending or does not exist" }); return; }
  res.json(ApproveAdminLoanResponse.parse(adminLoanResponse(approved)));
});
router.post("/admin/loans/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const params = RejectAdminLoanParams.safeParse(req.params);
  const body = RejectAdminLoanBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid rejection" }); return; }
  const adminId = req.session.userId;
  if (!adminId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [existing] = await db.select().from(loansTable).where(eq(loansTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Loan not found" }); return; }
  const [loan] = await db.update(loansTable).set({ status: "rejected", reviewedByUserId: adminId, rejectionReason: body.data.reason.trim() })
    .where(and(eq(loansTable.id, params.data.id), eq(loansTable.status, "pending"))).returning();
  if (!loan) { res.status(400).json({ error: "Loan is not pending" }); return; }
  res.json(RejectAdminLoanResponse.parse(adminLoanResponse(loan)));
});
router.get("/admin/loans/:id/id-number", requireAdmin, async (req, res): Promise<void> => {
  const params = GetAdminLoanIdNumberParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid loan id" }); return; }
  const [loan] = await db.select({ idNumber: loansTable.idNumber }).from(loansTable).where(eq(loansTable.id, params.data.id)).limit(1);
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }
  try {
    const adminId = req.session.userId;
    if (!adminId) { res.status(401).json({ error: "Not authenticated" }); return; }
    req.log.warn({ adminUserId: adminId, loanId: params.data.id }, "admin.loan.id_number.revealed");
    res.json(GetAdminLoanIdNumberResponse.parse({ idNumber: decryptKycIdNumber(loan.idNumber) }));
  }
  catch { res.status(500).json({ error: "Loan ID number could not be decrypted" }); }
});

export default router;