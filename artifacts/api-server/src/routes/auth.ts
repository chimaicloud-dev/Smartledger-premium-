import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { sendWelcomeEmail, sendPasswordResetEmail, notifyAdminNewUser, notifyAdminKycSubmitted } from "../lib/email";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password, name, phone, country, dateOfBirth, experience } = parsed.data;

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
  const [user] = await db.insert(usersTable).values({
    email,
    password: hashedPassword,
    name,
    phone,
    country,
    dateOfBirth,
    experience,
    usdBalance: 0,
  }).returning();

  req.session.userId = user.id;

  sendWelcomeEmail(user.email, user.name);
  notifyAdminNewUser(user.email, user.name);

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      experience: user.experience,
      usdBalance: user.usdBalance,
      kycStatus: user.kycStatus,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    },
    message: "Registration successful",
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

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

  req.session.userId = user.id;

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      experience: user.experience,
      usdBalance: user.usdBalance,
      kycStatus: user.kycStatus,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    },
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

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    experience: user.experience,
    usdBalance: user.usdBalance,
    kycStatus: user.kycStatus,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/kyc/verify", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { fullName, dateOfBirth, country, idNumber } = (req.body ?? {}) as {
    fullName?: string;
    dateOfBirth?: string;
    country?: string;
    idNumber?: string;
  };

  if (!fullName || !dateOfBirth || !country || !idNumber) {
    res.status(400).json({ error: "All KYC fields are required" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ kycStatus: "pending" })
    .where(eq(usersTable.id, req.session.userId))
    .returning();

  if (!updated) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.log.info({ userId: updated.id, country }, "KYC submitted, awaiting admin approval");

  notifyAdminKycSubmitted(updated.email, updated.name);

  res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    experience: updated.experience,
    usdBalance: updated.usdBalance,
    kycStatus: updated.kycStatus,
    role: updated.role,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  });
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
      process.env.FRONTEND_URL?.replace(/\/+$/, "") ||
      (process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : "http://localhost:5173");

    const resetUrl = `${frontendBase}/reset-password?token=${encodeURIComponent(token)}`;
    sendPasswordResetEmail(user.email, resetUrl);
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
