/**
 * Risk Middleware — emir gönderiminden önce risk limitlerini kontrol eder.
 * Rapordaki "Risk Motoru %12 — Dekoratif" sorununu çözer.
 * Gerçek Rust/Polars entegrasyonu VPS'te yapılır; bu Express katmanı ilk savunma hattı.
 */
import type { Request, Response, NextFunction } from "express";
import { systemState } from "../routes/config.js";

// Basit in-memory pozisyon takibi (production'da DB'den okunur)
const dailyLossTracker = new Map<string, { loss: number; date: string }>();
const openOrdersTracker = new Map<string, number>(); // userId → açık emir sayısı

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export interface RiskLimits {
  maxPositionPct: number;   // Portföyün max %'si
  stopLossPct: number;      // Max SL oranı
  takeProfitPct: number;    // TP oranı
  maxDailyLossPct: number;  // Günlük max kayıp
  maxOpenPositions: number; // Max açık pozisyon
  riskPerTradePct: number;  // İşlem başına risk
}

// Varsayılan risk limitleri (SystemSettings'ten override edilebilir)
const DEFAULT_LIMITS: RiskLimits = {
  maxPositionPct: 5,
  stopLossPct: 2,
  takeProfitPct: 4,
  maxDailyLossPct: 8,
  maxOpenPositions: 5,
  riskPerTradePct: 1,
};

// Aktif risk limitleri (PATCH /api/config ile güncellenebilir)
export let activeLimits: RiskLimits = { ...DEFAULT_LIMITS };

export function updateRiskLimits(limits: Partial<RiskLimits>) {
  activeLimits = { ...activeLimits, ...limits };
}

export function riskCheck(req: Request, res: Response, next: NextFunction) {
  const { qty, price, side, sym } = req.body as {
    qty: number; price?: number; side: string; sym: string;
    exchangeId: string;
  };
  const userId = req.user?.userId ?? "unknown";

  // ── 1. Max eş zamanlı emir kontrolü ──────────────────────────────────
  const openCount = openOrdersTracker.get(userId) ?? 0;
  const maxOrders = systemState.maxConcurrentOrders ?? activeLimits.maxOpenPositions;
  if (openCount >= maxOrders) {
    res.status(429).json({
      error: `Risk limiti: Max ${maxOrders} eş zamanlı emir. Mevcut: ${openCount}`,
      code: "MAX_ORDERS_EXCEEDED",
      limit: maxOrders,
      current: openCount,
    });
    return;
  }

  // ── 2. Miktar sıfır/negatif kontrolü ─────────────────────────────────
  if (!qty || qty <= 0) {
    res.status(400).json({ error: "Geçersiz miktar: qty > 0 olmalı", code: "INVALID_QTY" });
    return;
  }

  // ── 3. Fiyat kontrolü (limit emirler için) ────────────────────────────
  if (price !== undefined && price <= 0) {
    res.status(400).json({ error: "Geçersiz fiyat: price > 0 olmalı", code: "INVALID_PRICE" });
    return;
  }

  // ── 4. Günlük kayıp limiti kontrolü ──────────────────────────────────
  const today = todayStr();
  const tracker = dailyLossTracker.get(userId);
  if (tracker && tracker.date === today) {
    // Tahmini kayıp: qty * price * stopLossPct / 100
    const estimatedLoss = qty * (price ?? 0) * (activeLimits.stopLossPct / 100);
    const portfolioValue = 10000; // TODO: gerçek bakiyeden al
    const dailyLossPct = ((tracker.loss + estimatedLoss) / portfolioValue) * 100;
    if (dailyLossPct > activeLimits.maxDailyLossPct) {
      res.status(429).json({
        error: `Risk limiti: Günlük kayıp limiti aşıldı (%${activeLimits.maxDailyLossPct})`,
        code: "DAILY_LOSS_LIMIT",
        limit: activeLimits.maxDailyLossPct,
        current: dailyLossPct.toFixed(2),
      });
      return;
    }
  }

  // ── 5. Trade modu kontrolü ────────────────────────────────────────────
  // Manuel modda sadece paper emirlere izin ver
  if (systemState.tradeMode === "manual") {
    // Manuel modda emir gönderilmez — sadece sinyal üretilir
    // Ama paper emirlere izin ver
    req.body.forcePaper = true;
  }

  // ── 6. Risk geçti — açık emir sayısını artır ──────────────────────────
  openOrdersTracker.set(userId, openCount + 1);

  // Emir tamamlandığında sayacı düşür (response hook)
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    // Emir başarılıysa sayacı düşür
    const current = openOrdersTracker.get(userId) ?? 1;
    openOrdersTracker.set(userId, Math.max(0, current - 1));

    // Kayıp takibi güncelle (filled emirler için)
    if (body && typeof body === "object" && (body as Record<string, unknown>)["status"] === "filled") {
      const loss = qty * (price ?? 0) * (activeLimits.stopLossPct / 100);
      const existing = dailyLossTracker.get(userId);
      if (existing && existing.date === todayStr()) {
        existing.loss += loss;
      } else {
        dailyLossTracker.set(userId, { loss, date: todayStr() });
      }
    }

    return originalJson(body);
  };

  // Risk kontrolü geçti — devam et
  next();
}

// Risk durumu endpoint'i için
export function getRiskStatus(userId: string) {
  const today = todayStr();
  const tracker = dailyLossTracker.get(userId);
  const openCount = openOrdersTracker.get(userId) ?? 0;
  return {
    openOrders: openCount,
    maxOrders: systemState.maxConcurrentOrders,
    dailyLoss: tracker?.date === today ? tracker.loss : 0,
    maxDailyLossPct: activeLimits.maxDailyLossPct,
    limits: activeLimits,
  };
}
