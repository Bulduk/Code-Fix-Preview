# Nexus Trade OS — Sistem Analiz Raporu
> Tarih: Mayıs 2026 | Versiyon: Sprint-4 | Analist: AI Sistem Değerlendirmesi

---

## 1. MEVCUT SİSTEM HARİTASI

```
Frontend (React+Vite+Zustand)           HAZIR ✅
├── Home — Dashboard, Watchlist         HAZIR ✅
├── Markets — Spot/Perp/Fut/Marjin      HAZIR ✅
├── Trade — Emir Formu                  YÜZEYSEL ⚠️
├── P&L — Bakiye + K/Z Takip            HAZIR ✅ (bakiye mock)
├── Orchestrator — LangGraph Akış       HAZIR (tam mock) 🔴
├── Agents — LLM + Nautilus Chat        HAZIR (tam mock) 🔴
├── Risk Manager                        HAZIR ✅
├── Exchanges — API Key Yönetimi        UI HAZIR / backend yok 🔴
├── Strategies — Strateji Editörü       UI HAZIR / çalışmıyor 🔴
└── System Settings — Trade Modu       HAZIR ✅

Veri Katmanı (src/lib/)
├── mock.ts  — Simüle tick/sinyal       40+ çift, 400ms döngü ✅
├── api.ts   — Tüm CRUD                 Browser belleği (localStorage yok) 🔴
├── store.ts — Zustand state            Çalışıyor, persist yok (sadece config) ✅
└── OKX WS   — Gerçek WebSocket        GERÇEK VERİ ✅ (tek gerçek bağlantı)

Backend
└── YOK — tüm veri frontend bellekte   🔴
```

---

## 2. GERÇEK vs MOCK DAĞILIMI

| Bileşen | Durum | Açıklama |
|---|---|---|
| OKX Public WS Fiyatları | ✅ GERÇEK | wss://ws.okx.com — BTC/ETH/SOL canlı tick |
| Binance/Bybit Fiyatları | 🟡 SİMÜLE | 400ms aralıkla random walk |
| RSI / MACD Sinyaller | 🔴 SAHTE | Rastgele üretilen, teknik analiz yok |
| LLM (Claude/Gemini) Kararı | 🔴 SAHTE | Şablon metin, gerçek API çağrısı yok |
| Emir Yerleştirme | 🔴 SAHTE | `orderStore` dizisine yazıyor, borsaya gidilmiyor |
| Borsa Bakiyeleri | 🔴 SAHTE | Sabit sayılar, API çağrısı yok |
| P&L / Equity | 🔴 SAHTE | 3sn'de random drift ile değişiyor |
| Açık Pozisyonlar | 🔴 SAHTE | Seed verisi, gerçek pozisyon yok |
| Telegram Onay | 🔴 SAHTE | Simüle edilmiş gecikme |
| Nautilus Agent | 🔴 SAHTE | Şablon cevap döndürüyor |
| API Key Güvenliği | ⚠️ RİSKLİ | Anahtarlar frontend state'e yazılıyor |
| Kullanıcı Auth | 🟡 TEMEL | "admin" içeriyorsa token ver |
| Risk Limitleri | 🟡 UI ONLY | Config kayıt var ama hiçbir emir kontrol edilmiyor |
| Audit Log | 🟡 ÇALIŞIYOR | Sadece mock CRUD'larda log atılıyor |

**Özet: 1/14 bileşen gerçek veri kullanıyor (OKX WS)**

---

## 3. GERÇEK TRADEYE HAZIRLIK PUANI

```
┌─────────────────────────────────────────────────────────────┐
│                   GENEL HAZIRLIK: %18                       │
│                                                             │
│  UI/UX Tasarım          ████████████████░░░░  %82          │
│  Veri Görüntüleme       ████████░░░░░░░░░░░░  %45          │
│  Emir Yönetimi          ████░░░░░░░░░░░░░░░░  %20          │
│  Backend / API          ██░░░░░░░░░░░░░░░░░░  %10          │
│  Gerçek Bağlantı        █░░░░░░░░░░░░░░░░░░░  %7           │
│  Güvenlik               ████░░░░░░░░░░░░░░░░  %22          │
│  Risk Motoru            ██░░░░░░░░░░░░░░░░░░  %12          │
│  LLM Entegrasyon        ░░░░░░░░░░░░░░░░░░░░  %0           │
└─────────────────────────────────────────────────────────────┘
```

### Kategori Detayı

#### UI/UX — %82 ✅ Güçlü
- Responsive mobil tasarım tamamlandı
- Tüm sayfalar navigate edilebilir
- Toast bildirimleri, trade modu badge, FAB menü
- Borsa bakiye kartları, asset dağılım çubukları
- Strateji kod editörü (syntax yok ama alan var)
- **Eksik:** Gerçek grafik (TradingView / Recharts candlestick)

#### Veri Görüntüleme — %45 🟡 Orta
- OKX WS'den BTCUSDT/ETHUSDT/SOL gerçek fiyat geliyor
- Markets sayfası Spot/Perp/Futures/Margin filtreleri çalışıyor
- **Eksik:** Binance/Bybit gerçek WS bağlantısı yok
- **Eksik:** Orderbook derinliği, trade history yok
- **Eksik:** RSI/MACD hesaplama gerçek değil

#### Emir Yönetimi — %20 🔴 Yetersiz
- Emir formu UI var (borsa, sembol, miktar, fiyat, tür)
- "Emir gönder" butonu var ama hiçbir yere gitmiyor
- `orderStore` dizisine yazıyor = her sayfayenileme sıfırlanıyor
- **Eksik:** CCXT Pro entegrasyonu
- **Eksik:** Stop-loss / take-profit otomasyonu
- **Eksik:** Emir durumu takibi (filled/cancelled/partial)
- **Eksik:** Kaldıraç ayarı (futures/perp için)

#### Backend / API — %10 🔴 Yok
- Tüm "API" çağrıları `src/lib/api.ts` içinde browser'da çalışıyor
- Sayfa yenilenince tüm veri sıfırlanıyor (exchanges, strategies, agents)
- Gerçek bir Express/FastAPI server yok
- **Eksik:** PostgreSQL / Drizzle ORM entegrasyonu (şema var ama kullanılmıyor)
- **Eksik:** WebSocket sunucu tarafı

#### Güvenlik — %22 ⚠️ Riskli
- Login sayfası var ama `email.includes("admin")` kontrolü = güvensiz
- JWT token "mock-token-admin" = imzasız, doğrulanmıyor
- **KRİTİK:** API key'ler frontend state'e yazılıyor — ASLA yapılmamalı
- TOTP alanı var ama doğrulama yok
- Rate limiting, CORS, CSRF koruması yok
- **Eksik:** Oturum süresi, token yenileme

#### Risk Motoru — %12 🔴 Dekoratif
- Risk parametreleri ayarlanabiliyor (SL%, TP%, max pozisyon)
- **Ama:** Hiçbir emir bu limitleri kontrol etmiyor
- Strateji tahsis sınırı (%100) sadece UI'da gösteriliyor
- Max drawdown hesabı yapılmıyor
- **Eksik:** Gerçek pozisyon büyüklüğü hesabı (Kelly / fixed risk)

#### LLM Entegrasyon — %0 🔴 Yok
- Orchestrator sayfası LangGraph akışını simüle ediyor
- Claude/Gemini API çağrısı yapılmıyor
- Nautilus Agent şablon metin döndürüyor
- **Eksik:** Anthropic/Gemini/OpenAI SDK bağlantısı
- **Eksik:** LangGraph state machine gerçek implementasyonu

---

## 4. BÜYÜK RİSKLER (Gerçek Trade İçin Bloker)

```
🚨 KRİTİK RİSKLER
─────────────────
1. API Key Güvenliği
   ❌ Frontend state'e api_key yazılıyor
   ❌ localStorage'a konursa hacker okuyabilir
   ✅ Olması gereken: Sadece backend bilmeli, env var olarak

2. Emir Onayı Yok
   ❌ Tam oto modda hiçbir kontrol yok
   ❌ Yanlış emir gönderilirse geri alınamaz
   ✅ Olması gereken: İkili onay, paper mod zorunlu ilk ay

3. Veri Kayıt Edilmiyor
   ❌ Sayfa yenilenince tüm işlemler, pozisyonlar sıfırlanıyor
   ✅ Olması gereken: PostgreSQL + WAL log

4. Sahte P&L
   ❌ Equity 3 saniyede random değişiyor
   ❌ Borsa bakiyeleri sabit hardcoded sayılar
   ✅ Olması gereken: CCXT fetchBalance() gerçek API

5. Kimlik Doğrulama
   ❌ "admin" string kontrolü = çocuk seviyesi güvenlik
   ✅ Olması gereken: JWT + bcrypt + TOTP gerçek doğrulama
```

---

## 5. %70'E ÇIKARMAK İÇİN ROADMAP

### Faz 1 — Backend Kurulumu (1-2 Hafta) → %35
```
✦ FastAPI (Python) veya Express (Node) server kur
✦ PostgreSQL + Drizzle bağla (şema zaten var)
✦ Gerçek JWT auth (jose + bcrypt)
✦ API key'leri YALNIZCA server env'e taşı
✦ /api/exchanges, /api/strategies gerçek CRUD
```

### Faz 2 — Gerçek Veri Bağlantısı (1 Hafta) → %50
```
✦ CCXT Pro WS: Binance + Bybit + OKX bağla
  - fetchTicker(), watchTicker() → gerçek fiyat
  - fetchBalance() → gerçek bakiye
  - fetchOpenOrders() → gerçek pozisyon
✦ RSI/MACD hesaplama: pandas-ta veya ta-lib
✦ TradingView Lightweight Charts → candlestick grafik
```

### Faz 3 — LLM Orkestrasyon (1 Hafta) → %62
```
✦ Anthropic Claude API gerçek çağrı
  - Prompt: tick verisi + RSI + MACD → karar üret
✦ LangGraph state machine: market_data → llm → risk → execute
✦ Telegram Bot gerçek mesaj gönderimi
✦ Human-in-the-loop: onay gelmeden emir gitmesin
```

### Faz 4 — Risk + Emir Motoru (1 Hafta) → %72
```
✦ placeOrder() → CCXT createOrder() gerçek bağlantı
✦ Risk middleware: her emri çalıştırmadan önce kontrol
  - Position size hesabı (Kelly criterion)
  - Daily loss limit takibi
  - Max concurrent orders kontrolü
✦ SL/TP otomatik yerleştirme
✦ Gerçek P&L hesabı (realized + unrealized)
```

---

## 6. KOLAY KAZANLAR (Bu Hafta Yapılabilir)

| Geliştirme | Etki | Süre |
|---|---|---|
| OKX REST API → Gerçek bakiye çek | Yüksek | 2 saat |
| Binance WS bağla (spot tickers) | Yüksek | 3 saat |
| TradingView Lightweight Charts | Orta | 4 saat |
| Gerçek JWT auth (jose) | Kritik | 4 saat |
| LocalStorage persist (orders/positions) | Orta | 2 saat |
| Recharts equity grafiği P&L sayfasında | Orta | 2 saat |

---

## 7. VPS MİMARİSİ (Üretim İçin)

```
┌──────────────────────────────────────────────┐
│  Replit (Frontend + BFF API)                 │
│  ├── React+Vite → kullanıcı arayüzü          │
│  └── Express → auth, proxy, WebSocket hub    │
└────────────────┬─────────────────────────────┘
                 │ HTTPS + WSS
┌────────────────▼─────────────────────────────┐
│  VPS — Ubuntu 22.04 (DigitalOcean/Hetzner)   │
│  ├── Python Orchestrator (FastAPI + LangGraph)│
│  │   ├── CCXT Pro (Binance/Bybit/OKX)        │
│  │   ├── Anthropic Claude API                │
│  │   ├── Google Gemini API                   │
│  │   └── Telegram Bot API                    │
│  ├── Rust Risk Engine (PyO3 + Polars)        │
│  ├── PostgreSQL 16 (pozisyonlar, P&L, log)  │
│  └── Redis (tick cache, rate limiting)       │
└──────────────────────────────────────────────┘

Tahmini Aylık Maliyet:
  VPS 4GB RAM: ~$20/ay (Hetzner CX31)
  Anthropic API: ~$30-80/ay (kullanıma göre)
  PostgreSQL: dahil (self-hosted)
  Toplam: ~$50-100/ay
```

---

## 8. SONUÇ TABLOSU

```
KATEGORİ                    PUAN    DURUM
─────────────────────────────────────────
UI/UX Tasarım               82%     ✅ Güçlü
Piyasa Veri Görüntüleme     45%     🟡 Geliştirilmeli
Trade Çalıştırma            20%     🔴 Yok
Backend/Kalıcılık           10%     🔴 Yok
Güvenlik                    22%     🔴 Riskli
Risk Yönetimi               12%     🔴 Dekoratif
LLM/AI Entegrasyon          0%      🔴 Sadece UI
─────────────────────────────────────────
TOPLAM AĞIRLIKLI ORTALAMA:  18%

%100'e ulaşmak için tahmini süre: 4-6 hafta (tek geliştirici)
Gerçek trade için minimum: %55 (Faz 1+2 tamamlanmalı)
```

---

## 9. MEVCUT SİSTEMİN GÜÇLİ YÖNLERİ

Şunu atlamamak gerekir — mevcut frontend **olağanüstü** bir temel:

- ✅ Profesyonel UI: mobil-first, smooth animasyonlar, tutarlı design system
- ✅ Trade modu altyapısı: Manuel/Yarı Oto/Tam Oto state management
- ✅ OKX WS gerçek veri akışı (tek gerçek bileşen ama kritik)
- ✅ LangGraph akış görselleştirmesi (backend bağlanınca anında çalışır)
- ✅ Borsa/Strateji/Ajan CRUD UI (backend bağlanınca anında çalışır)
- ✅ Risk konfigürasyonu (sadece executor bağlanmalı)
- ✅ Nautilus paper trading altyapısı (VPS'te Nautilus kurulunca çalışır)
- ✅ Audit log altyapısı
- ✅ Telegram onay akışı (bot token eklenince çalışır)

**Bu sistem bir demo için %82, bir MVP için %45, gerçek trade için %18 hazırdır.**
**Frontend işi tamamdır — asıl iş backend ve entegrasyon katmanındadır.**

---

*Rapor: Nexus Trade OS Sprint-4 — nexus-trade-os-rapor.md*
