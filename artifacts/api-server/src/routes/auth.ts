import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { sendWelcomeEmail } from "../lib/email";

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

export default router;
