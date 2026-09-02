import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, isNull, sql } from "drizzle-orm";
import { RegisterBody, LoginBody, SubmitKycBody } from "@workspace/api-zod";
import { sendWelcomeEmail, sendPasswordResetEmail, notifyAdminNewUser, notifyAdminKycSubmitted } from "../lib/email";
import { encryptKycIdNumber } from "../lib/kyc-id-crypto";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

function referralCode(): string {
  return `SL${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}
function isReferralCodeCollision(error: unknown): boolean {
  return error instanceof Error && /users_referral_code(?:_lower)?_unique/.test(error.message);
}

function userResponse(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id, email: user.email, name: user.name, experience: user.experience,
    usdBalance: user.usdBalance, kycStatus: user.kycStatus, role: user.role,
    status: user.status, referralCode: user.referralCode, createdAt: user.createdAt.toISOString(),
  };
}

function validateDeviceTimezone(timezone?: string): string | undefined {
  if (!timezone) return undefined;
  new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  return timezone;
}

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password, name, phone, country, dateOfBirth, timezone, referralCode: suppliedReferralCode } = parsed.data;
  let deviceTimezone: string | undefined;
  try {
    deviceTimezone = validateDeviceTimezone(timezone);
  } catch {
    res.status(400).json({ error: "Invalid device timezone" });
    return;
  }

  // Must be exactly one valid email address (no lists, spaces, or brackets)
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email.trim())) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  let referredByUserId: number | undefined;
  if (suppliedReferralCode) {
    const [referrer] = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`lower(${usersTable.referralCode}) = lower(${suppliedReferralCode.trim()})`).limit(1);
    if (!referrer) {
      res.status(400).json({ error: "Invalid referral code" });
      return;
    }
    referredByUserId = referrer.id;
  }
  let user: typeof usersTable.$inferSelect | undefined;
  for (let attempts = 0; attempts < 3 && !user; attempts++) {
    try {
      const [created] = await db.insert(usersTable).values({
        email, password: hashedPassword, name, phone, country, dateOfBirth, timezone: deviceTimezone,
        experience: "beginner", usdBalance: 0, referralCode: referralCode(), referredByUserId,
      }).returning();
      user = created;
    } catch (error) {
      if (!isReferralCodeCollision(error) || attempts === 2) throw error;
    }
  }
  if (!user) throw new Error("Could not allocate a referral code");

  req.session.userId = user.id;

  sendWelcomeEmail(user.email, user.name, user.timezone);
  notifyAdminNewUser(user.name);

  res.status(201).json({
    user: userResponse(user),
    message: "Registration successful",
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password, timezone } = parsed.data;
  let deviceTimezone: string | undefined;
  try {
    deviceTimezone = validateDeviceTimezone(timezone);
  } catch {
    res.status(400).json({ error: "Invalid device timezone" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.status === "suspended") {
    res.status(403).json({ error: "Account suspended. Contact support." });
    return;
  }

  let authenticatedUser = user;
  if (deviceTimezone && deviceTimezone !== user.timezone) {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ timezone: deviceTimezone })
      .where(eq(usersTable.id, user.id))
      .returning();
    if (updatedUser) authenticatedUser = updatedUser;
  }

  req.session.userId = authenticatedUser.id;

  res.json({
    user: userResponse(authenticatedUser),
    message: "Login successful",
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ message: "Logged out" });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(userResponse(user));
});

router.post("/kyc/verify", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = SubmitKycBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid KYC details" });
    return;
  }

  const normalizedFullName = parsed.data.fullName.trim();
  const normalizedCountry = parsed.data.country.trim();
  const normalizedIdNumber = parsed.data.idNumber.trim();
  const dateOfBirth = parsed.data.dateOfBirth;
  if (!normalizedFullName || !normalizedCountry || !normalizedIdNumber) {
    res.status(400).json({ error: "Invalid KYC details" });
    return;
  }
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const dob = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const validCalendarDate =
    dob.getUTCFullYear() === year &&
    dob.getUTCMonth() === month - 1 &&
    dob.getUTCDate() === day;
  const eighteenthBirthday = new Date(Date.UTC(year + 18, month - 1, day));
  if (!validCalendarDate || eighteenthBirthday > today) {
    res.status(400).json({ error: "A valid date of birth for a user aged 18 or older is required" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      kycStatus: "pending",
      kycFullName: normalizedFullName,
      kycDateOfBirth: dateOfBirth,
      kycCountry: normalizedCountry,
      kycIdNumber: encryptKycIdNumber(normalizedIdNumber),
      kycSubmittedAt: new Date(),
    })
    .where(eq(usersTable.id, req.session.userId))
    .returning();

  if (!updated) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.log.info({ userId: updated.id }, "KYC submitted, awaiting admin approval");

  notifyAdminKycSubmitted(updated.name);

  res.json(userResponse(updated));
});

// ---------- Change Password ----------

router.post("/change-password", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { currentPassword, newPassword } = (req.body ?? {}) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || typeof currentPassword !== "string") {
    res.status(400).json({ error: "Current password is required" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db
    .update(usersTable)
    .set({ password: hashedPassword })
    .where(eq(usersTable.id, req.session.userId));

  res.json({ message: "Password changed successfully" });
});

// ---------- Forgot Password ----------

router.post("/forgot-password", async (req, res) => {
  const { email } = (req.body ?? {}) as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  // Always respond with success to avoid leaking which emails are registered
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()))
    .limit(1);

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Build the reset URL exclusively from server-controlled configuration —
    // never from caller-supplied Origin / Referer headers (host-header injection risk).
    const frontendBase =
      process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") ||
      "https://smartledger-premium.com";

    const resetUrl = `${frontendBase}/reset-password?token=${encodeURIComponent(token)}`;
    sendPasswordResetEmail(user.email, user.name, resetUrl);
  }

  res.json({ message: "If an account with that email exists, a reset link has been sent." });
});

// ---------- Reset Password ----------

router.post("/reset-password", async (req, res) => {
  const { token, password } = (req.body ?? {}) as { token?: string; password?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const now = new Date();

  // Atomically claim the token with a single conditional UPDATE … RETURNING.
  // Two concurrent requests cannot both succeed: only one UPDATE sees
  // used_at IS NULL and wins; the second returns an empty set and is rejected.
  // The password update then happens in the same transaction so no partial
  // state is ever committed.
  try {
    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokensTable.token, token),
            gt(passwordResetTokensTable.expiresAt, now),
            isNull(passwordResetTokensTable.usedAt),
          ),
        )
        .returning();

      if (!claimed) {
        // Roll back and surface a user-friendly error
        throw Object.assign(new Error("invalid_token"), { userFacing: true });
      }

      await tx
        .update(usersTable)
        .set({ password: hashedPassword })
        .where(eq(usersTable.id, claimed.userId));
    });
  } catch (err: any) {
    if (err?.userFacing) {
      res.status(400).json({ error: "This reset link is invalid or has expired." });
      return;
    }
    throw err;
  }

  res.json({ message: "Password updated successfully. You can now log in." });
});

export default router;
