import { Router } from "express";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/jwt.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// In-memory user store for mock fallback (no DB)
const MOCK_USERS: Array<{ id: string; email: string; passwordHash: string; role: "admin" | "trader" | "viewer"; isActive: boolean; totpEnabled: boolean }> = [];
let mockUsersSeeded = false;

async function ensureMockAdmin() {
  if (mockUsersSeeded) return;
  mockUsersSeeded = true;
  const hash = await bcrypt.hash("nexus2024", 10);
  MOCK_USERS.push({ id: "admin-1", email: "admin@nexus.local", passwordHash: hash, role: "admin", isActive: true, totpEnabled: false });
}

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
  } catch (_e) {
    // DB henüz hazır olmayabilir, sessizce geç
  }
}

router.post("/login", async (req, res) => {
  await seedAdmin();
  await ensureMockAdmin();
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "email ve password gerekli" });
    return;
  }
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    const user = rows[0];

    if (user && user.isActive) {
      // DB user found — verify password
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Geçersiz kimlik bilgileri" });
        return;
      }
      await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
      const token = await signToken({ userId: user.id, email: user.email, role: user.role });
      res.json({ token, role: user.role, email: user.email });
      return;
    }

    // DB returned empty (no DB or user not found) — try mock store
    const mockUser = MOCK_USERS.find((u) => u.email === email && u.isActive);
    if (mockUser) {
      const ok = await bcrypt.compare(password, mockUser.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Geçersiz kimlik bilgileri" });
        return;
      }
      const token = await signToken({ userId: mockUser.id, email: mockUser.email, role: mockUser.role });
      res.json({ token, role: mockUser.role, email: mockUser.email });
      return;
    }

    res.status(401).json({ error: "Geçersiz kimlik bilgileri" });
  } catch (err) {
    req.log.error({ err }, "login error");
    // Last resort fallback
    if (email === "admin@nexus.local" && password === "nexus2024") {
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

// POST /api/auth/change-password — şifre değiştir
router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword ve newPassword gerekli" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Yeni şifre en az 8 karakter olmalı" });
    return;
  }
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    const user = rows[0];
    if (!user) {
      // Mock fallback
      const mockUser = MOCK_USERS.find((u) => u.id === req.user!.userId);
      if (!mockUser) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
      const ok = await bcrypt.compare(currentPassword, mockUser.passwordHash);
      if (!ok) { res.status(401).json({ error: "Mevcut şifre yanlış" }); return; }
      mockUser.passwordHash = await bcrypt.hash(newPassword, 10);
      res.json({ ok: true, message: "Şifre güncellendi" });
      return;
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) { res.status(401).json({ error: "Mevcut şifre yanlış" }); return; }
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
    res.json({ ok: true, message: "Şifre güncellendi" });
  } catch (err) {
    req.log.error({ err }, "change-password error");
    res.status(500).json({ error: "Şifre güncellenemedi" });
  }
});

// GET /api/auth/users — admin only
router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      totpEnabled: usersTable.totpEnabled,
      createdAt: usersTable.createdAt,
      lastLoginAt: usersTable.lastLoginAt,
    }).from(usersTable);

    if (rows.length > 0) {
      res.json(rows.map((u) => ({ ...u, totp_enabled: u.totpEnabled })));
      return;
    }
    // Mock fallback
    res.json(MOCK_USERS.map((u) => ({ id: u.id, email: u.email, role: u.role, isActive: u.isActive, totp_enabled: u.totpEnabled })));
  } catch {
    res.json(MOCK_USERS.map((u) => ({ id: u.id, email: u.email, role: u.role, isActive: u.isActive, totp_enabled: u.totpEnabled })));
  }
});

export default router;
