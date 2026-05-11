import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { vault } from "../lib/vault.js";
import { invalidateInstance, testConnection, fetchBalance } from "../lib/ccxt-service.js";
import { db } from "@workspace/db";
import { auditLogTable } from "@workspace/db";

const router = Router();

type ExchangeMode = "live" | "testnet" | "paper";
const VALID_MODES: ExchangeMode[] = ["live", "testnet", "paper"];

function uid() { return Math.random().toString(36).slice(2, 11); }

async function audit(action: string, target: string, actor: string, ip: string) {
  try {
    await db.insert(auditLogTable).values({ id: uid(), action, target, actor, ipAddress: ip });
  } catch { /* DB yoksa sessizce geç */ }
}

function pid(p: string | string[]): string {
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

router.use(requireAuth);

// GET /api/exchanges — masked list (no secrets)
router.get("/", (_req, res) => {
  res.json(vault.list());
});

// POST /api/exchanges — yeni hesap ekle
router.post("/", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const exchange   = String(body["exchange"] ?? "");
  const label      = String(body["label"]    ?? "");
  const modeRaw    = String(body["mode"]     ?? "paper");
  const mode: ExchangeMode = VALID_MODES.includes(modeRaw as ExchangeMode) ? (modeRaw as ExchangeMode) : "paper";
  const api_key    = String(body["api_key"]    ?? "");
  const api_secret = String(body["api_secret"] ?? "");
  const passphrase = String(body["passphrase"] ?? "");
  const is_active  = body["is_active"] === true || body["is_active"] === "true" || body["is_active"] === 1;

  if (!exchange || !label) { res.status(400).json({ error: "exchange ve label gerekli" }); return; }

  const rec = vault.create({ exchange, label, mode, api_key, api_secret, passphrase, is_active });
  await audit("EXCHANGE_ADD", `${exchange}/${label}`, req.user!.email, String(req.ip ?? ""));
  res.status(201).json(rec);
});

// PATCH /api/exchanges/:id — güncelle
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = pid(req.params["id"] ?? "");
  invalidateInstance(id);
  const updated = vault.update(id, req.body as Record<string, unknown>);
  if (!updated) { res.status(404).json({ error: "Bulunamadı" }); return; }
  await audit("EXCHANGE_EDIT", id, req.user!.email, String(req.ip ?? ""));
  res.json(updated);
});

// DELETE /api/exchanges/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = pid(req.params["id"] ?? "");
  const ok = vault.delete(id);
  if (!ok) { res.status(404).json({ error: "Bulunamadı" }); return; }
  invalidateInstance(id);
  await audit("EXCHANGE_DELETE", id, req.user!.email, String(req.ip ?? ""));
  res.json({ ok: true });
});

// POST /api/exchanges/:id/test — bağlantı testi
router.post("/:id/test", async (req, res) => {
  const id = pid(req.params["id"] ?? "");
  try {
    const result = await testConnection(id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

// GET /api/exchanges/:id/balance — gerçek bakiye
router.get("/:id/balance", async (req, res) => {
  const id = pid(req.params["id"] ?? "");
  try {
    const balance = await fetchBalance(id);
    res.json(balance);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/exchanges/balances/all — tüm hesapların bakiyeleri
router.get("/balances/all", async (_req, res) => {
  const list    = vault.list();
  const results = await Promise.allSettled(
    list.map((ex) =>
      fetchBalance(ex.id).then((b) => ({
        ...b, exchangeId: ex.id, exchange: ex.exchange, label: ex.label, mode: ex.mode, fetchedAt: Date.now(),
      }))
    )
  );
  res.json(
    results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { exchangeId: list[i]?.id, totalUsd: 0, assets: [], error: "fetch failed" }
    )
  );
});

export default router;
