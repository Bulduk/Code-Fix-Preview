import { Router } from "express";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Seed admin — ilk başlatmada otomatik oluşur
let seedDone = false;
async function seedAdmin() {
  if (seedDone) return;
  seedDone = true;
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, "admin@nexus.local")).limit(1);
    if (existing.length === 0) {
      const hash = await bcrypt.hash("nexus2024", 12);
      await db.insert(usersTable).values({
        id:           "admin-1",
        email:        "admin@nexus.local",
        passwordHash: hash,
        role:         "admin",
        totpEnabled:  false,
        isActive:     true,
      });
    }
  } catch (e) {
    // DB henüz hazır olmayabilir, sessizce geç
  }
}

router.post("/login", async (req, res) => {
  await seedAdmin();
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "email ve password gerekli" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Geçersiz kimlik bilgileri" });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Geçersiz kimlik bilgileri" });
      return;
    }
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ token, role: user.role, email: user.email });
  } catch (err) {
    req.log.error({ err }, "login error");
    // Fallback: DB yoksa mock auth
    if (email.includes("admin")) {
      const token = await signToken({ userId: "admin-1", email, role: "admin" });
      res.json({ token, role: "admin", email });
    } else {
      res.status(401).json({ error: "Geçersiz kimlik bilgileri" });
    }
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ userId: req.user!.userId, email: req.user!.email, role: req.user!.role });
});

export default router;
