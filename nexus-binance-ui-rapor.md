# Nexus Trade OS — Binance Odaklı UI/UX Kapsamlı Rapor
> Tarih: Mayıs 2026 | Hedef: Binance Kalitesinde Arayüz | Analist: Blackbox AI

---

## 0. YÖNETİCİ ÖZETİ

Mevcut sistem **iyi bir temel** üzerine kurulu ancak Binance kalitesine ulaşmak için
ciddi UX revizyonu gerekiyor. Binance'in gücü şuradan gelir:
- Her şey **tek ekranda** — fiyat, orderbook, grafik, emir formu yan yana
- **Sıfır tıklama** ile kritik bilgiye ulaşım
- **Renk dili tutarlı** — yeşil/kırmızı evrensel, hiçbir yerde amber/turuncu karışıklığı yok
- **Mobil ≡ Desktop** — aynı bilgi yoğunluğu, farklı layout

Nexus şu an: **7 farklı sayfaya dağılmış bilgi, FAB menü arkasında gizli kritik aksiyonlar,
OKX-first tasarım dili, Binance'e özgü hiçbir UX pattern yok.**

---

## 1. MEVCUT SAYFA ANALİZİ

### 1.1 Shell / Navigation

**Mevcut Durum:**
```
Header: Nexus. | Trade OS badge | OKX Live | [Mode] [Onay] [Bildirim] [Dark] [Komut]
Bottom Nav: Home | Markets | [FAB +] | Agents | Admin
FAB Menu: Hızlı Emir / Orkestratör / Risk / PnL / Pluginler / Telegram / Ayarlar
```

**Sorunlar:**
- ❌ "OKX Live" yazıyor — Binance odaklı sistemde OKX branding yanlış
- ❌ FAB arkasında gizli kritik sayfalar (Trade, Risk, PnL) — Binance'de bunlar ana nav'da
- ❌ Bottom nav sadece 4 item + FAB — Binance'de tab bar daha zengin
- ❌ "Komut" butonu (⌘K) — trader kitlesi için gereksiz karmaşıklık
- ❌ Trade Mode badge header'da küçük — en kritik bilgi en az görünür yerde
- ❌ Bildirim merkezi ayrı popup — Binance'de inline feed var
- ❌ "Nexus." branding — Binance'e geçişte marka tutarsızlığı

**Binance Referansı:**
```
Header: Logo | [Spot] [Futures] [Options] | Arama | [Cüzdan] [Bildirim] [Profil]
Tab Bar: Piyasalar | Trade | Portföy | Futures | Daha Fazla
```

**Önerilen Yapı:**
```
Header: 
  Sol: Logo + "Binance" badge (veya "Nexus for Binance")
  Orta: [Spot] [Futures] [Margin] sekmeleri (inline)
  Sağ: [Paper/Live badge] [Bakiye özeti] [Bildirim] [Profil]

Bottom Nav (5 tab, FAB yok):
  📊 Piyasalar | 📈 Trade | 🏠 Ana Sayfa | 💰 Portföy | ⚙️ Sistem
```

---

### 1.2 Home / Dashboard

**Mevcut Durum:**
```
- Equity kartı (mock random drift)
- Borsa bakiye kartları (OKX/Binance/Bybit)
- Watchlist (8 parite, mini sparkline + RSI)
- Sinyal istatistikleri (AL/SAT oranı)
- Aktif pozisyonlar
- Son emirler
- Güçlü sinyaller listesi
```

**Sorunlar:**
- ❌ Watchlist'te `okx:BTCUSDT`, `binance:BNBUSDT` karışık — Binance odaklı sistemde tek borsa
- ❌ Equity "random drift" ile değişiyor — güven kırıcı
- ❌ Sinyal istatistikleri dashboard'da — bu bir analytics sayfası bilgisi
- ❌ Borsa bakiye kartları çok yer kaplıyor (OKX/Bybit kartları gereksiz)
- ❌ MiniSparkline her render'da yeni random nokta üretiyor — tutarsız görüntü
- ❌ "Canlı Feed" yazısı var ama Binance WS bağlantısı yok
- ❌ Dashboard'da "Güçlü Sinyaller" listesi — Trade sayfasına ait

**Binance Dashboard Referansı:**
```
- Toplam bakiye (USDT cinsinden, büyük font)
- Bugünkü PnL (realized, %)
- Hızlı işlem butonları (Al / Sat / Transfer)
- Favori çiftler (fiyat + 24h değişim)
- Son işlemler
- Piyasa özeti (BTC dominance, Fear & Greed)
```

**Önerilen Yapı:**
```
┌─────────────────────────────────────────────────────┐
│  Toplam Bakiye: $XX,XXX.XX USDT    [Yenile]        │
│  Bugün: +$XXX (+X.XX%)  📈                         │
│  [Hızlı Al]  [Hızlı Sat]  [Transfer]               │
├─────────────────────────────────────────────────────┤
│  Binance Spot Bakiye    │  Futures Bakiye           │
│  $XX,XXX USDT           │  $X,XXX USDT              │
├─────────────────────────────────────────────────────┤
│  Favori Çiftler (Binance)                           │
│  BTC/USDT  $XX,XXX  +2.3%  [Grafik mini]           │
│  ETH/USDT  $X,XXX   -0.8%  [Grafik mini]           │
│  BNB/USDT  $XXX     +1.2%  [Grafik mini]           │
├─────────────────────────────────────────────────────┤
│  Aktif Pozisyonlar (Futures)                        │
│  Son Emirler                                        │
└─────────────────────────────────────────────────────┘
```

---

### 1.3 Markets / Piyasalar

**Mevcut Durum:**
```
Tabs: Spot | Sürekli | Vadeli | Marjin | Polymarket
Liste: Sembol | Fiyat | 24h% | Hacim | RSI | Sparkline
Modal: Coin detay (fiyat, sparkline, stats, hızlı emir)
```

**Sorunlar:**
- ❌ "Polymarket" tab'ı — Binance'de yok, kafa karıştırıcı
- ❌ Tüm borsalar karışık (OKX/Binance/Bybit) — Binance odaklı sistemde sadece Binance
- ❌ Coin modal'da "okx" / "binance" badge'leri — tek borsa olunca gereksiz
- ❌ Sparkline her render'da random — gerçek veri yok
- ❌ Arama kutusu var ama filtre yok (sadece isim filtresi)
- ❌ Sıralama yok (hacme, değişime göre)
- ❌ Tab geçişinde veri değişmiyor (hepsi aynı mock data)
- ❌ "Polymarket" mock data Türkçe tahmin piyasaları — Binance ile alakasız

**Binance Markets Referansı:**
```
- Tabs: Favoriler | Spot | Futures | Yeni Listelemeler
- Sıralama: Hacim ↕ | Değişim ↕ | Fiyat ↕
- Filtre: USDT | BTC | BNB | FDUSD çiftleri
- Her satır: Logo | Sembol | Fiyat | 24h% | 24h Hacim
- Tıklayınca: Direkt Trade sayfasına git (modal değil)
```

**Önerilen Değişiklikler:**
```
1. Polymarket tab'ını kaldır
2. Tabs: Spot | Futures | Margin | Yeni
3. Sadece Binance çiftleri göster
4. Sıralama butonları ekle
5. Modal yerine → Trade sayfasına yönlendir
6. Gerçek Binance WS verisi (şu an OKX WS var, Binance ekle)
```

---

### 1.4 Trade / Emir Ekranı

**Mevcut Durum:**
```
Sol: Sembol seçici + fiyat bilgisi + sparkline
Orta: Emir formu (borsa, sembol, AL/SAT, market/limit, miktar, fiyat)
Gelişmiş: SL/TP toggle, kaldıraç slider, not alanı
Sağ: Risk hesaplama paneli
Alt: Emir geçmişi tablosu
```

**Sorunlar:**
- ❌ EXCHANGES listesinde: `["binance", "bybit", "okx", "coinbase", "kraken"]` — Binance odaklı sistemde tek seçenek
- ❌ Orderbook yok — Binance'in en kritik bileşeni
- ❌ Gerçek grafik yok (TradingView / Recharts candlestick)
- ❌ Emir formu tek sütun, dar — Binance'de 3 sütun (grafik | orderbook | form)
- ❌ "Borsa" dropdown'ı var — gereksiz (tek borsa: Binance)
- ❌ Kaldıraç slider 1-100 ama futures/spot ayrımı yok
- ❌ Emir geçmişi sayfanın altında — Binance'de ayrı tab
- ❌ Fiyat bilgisi küçük, sparkline random
- ❌ "Paper" modu göstergesi yok — kullanıcı gerçek mi paper mı bilmiyor

**Binance Trade Sayfası Referansı:**
```
┌──────────────────────────────────────────────────────────────┐
│ BTC/USDT  $67,234.50  +2.34%  24h Vol: $28.4B              │
├─────────────────────┬──────────────┬────────────────────────┤
│                     │  Orderbook   │  Emir Formu            │
│   TradingView       │  Asks (Sat)  │  [Spot] [Margin] [Fut] │
│   Candlestick       │  ─────────── │  [AL]        [SAT]     │
│   Grafik            │  $67,234     │  Fiyat: ___            │
│                     │  ─────────── │  Miktar: ___           │
│                     │  Bids (Al)   │  Toplam: ___           │
│                     │              │  [Emir Ver]            │
├─────────────────────┴──────────────┴────────────────────────┤
│  Açık Emirler | Emir Geçmişi | Pozisyonlar | İşlem Geçmişi │
└──────────────────────────────────────────────────────────────┘
```

**Kritik Eksikler:**
1. **Orderbook** — en kritik bileşen, hiç yok
2. **Candlestick grafik** — sparkline yeterli değil
3. **Borsa seçici kaldırılmalı** — sadece Binance
4. **Paper/Live badge** — her zaman görünür olmalı
5. **Kaldıraç** — sadece Futures modunda göster

---

### 1.5 PnL / Portföy

**Mevcut Durum:**
```
- Toplam bakiye (tüm borsalar)
- Live/Paper ayrımı
- Equity grafiği (Recharts AreaChart)
- Borsa bakiye kartları (expand/collapse)
- Asset dağılım çubukları
- Snapshot tablosu
- Export (CSV/JSON) + Purge
```

**Sorunlar:**
- ❌ OKX/Bybit bakiye kartları — Binance odaklı sistemde gereksiz
- ❌ Equity grafiği mock data ile başlıyor (random drift)
- ❌ "Live" bakiye kartı gerçek API çağrısı yapmıyor
- ❌ Asset dağılımı mock — gerçek Binance bakiyesi yok
- ❌ Grafik zaman aralığı: 1h/24h/7d/all — Binance'de 1D/1W/1M/3M/YTD/All
- ❌ Realized/Unrealized PnL mock random değerler
- ❌ "Purge" butonu — kullanıcı dostu değil, tehlikeli

**Binance Portföy Referansı:**
```
- Toplam Bakiye: XX,XXX USDT (büyük, merkezi)
- Bugünkü PnL: +$XXX (+X.XX%)
- Spot | Futures | Earn | NFT bakiyeleri ayrı
- Asset listesi: Logo | Coin | Miktar | USDT Değer | 24h%
- Grafik: Equity eğrisi (gerçek veri)
- Gizle küçük bakiyeleri toggle
```

---

### 1.6 Agents / AI Ajanlar

**Mevcut Durum:**
```
Sol: Ajan listesi (Claude/Gemini/GPT/Nautilus)
Orta: Chat arayüzü (mesaj gönder, hızlı promptlar)
Sağ: Ajan detay + düzenleme modal
```

**Sorunlar:**
- ❌ Ajan listesi ve chat aynı anda görünüyor — mobilde sıkışık
- ❌ "Nautilus" ajan tipi — Binance odaklı sistemde açıklanmıyor
- ❌ Hızlı promptlar sabit — kullanıcı özelleştiremiyor
- ❌ Chat geçmişi persist edilmiyor (sayfa yenilenince sıfır)
- ❌ Ajan "aktif/pasif" toggle var ama ne anlama geldiği belirsiz
- ❌ Exchange bağlantısı (exchange_ids) ajan detayında gizli
- ❌ "Market Types" (spot/perp/futures/margin/polymarket) — Polymarket kaldırılmalı
- ❌ Invoke latency gösteriliyor ama context yok (iyi mi kötü mü?)

**Önerilen İyileştirmeler:**
```
1. Mobile: Liste → Ajan seç → Chat (3 adım, back butonu)
2. Ajan kartında: Provider badge + aktif sembol listesi
3. Chat geçmişi sessionStorage'a kaydet
4. Latency: <500ms yeşil, 500-2000ms sarı, >2000ms kırmızı
5. "Binance Analisti" varsayılan ajan rolü ekle
6. Polymarket market type'ı kaldır
```

---

### 1.7 Orchestrator / LangGraph

**Mevcut Durum:**
```
- Sembol + Provider seçici
- LangGraph node akış görselleştirmesi (5 node)
- Çalıştır butonu
- Log akışı (terminal benzeri)
- Karar geçmişi tablosu
```

**Sorunlar:**
- ❌ Tamamen mock — gerçek LLM çağrısı yok
- ❌ Node'lar sabit 5 adım — dinamik değil
- ❌ Log terminal görünümü — Binance kullanıcısı için yabancı
- ❌ "Rust Risk" node — teknik jargon, kullanıcı dostu değil
- ❌ Karar geçmişi tablosunda "approved: true/false" — ne anlama geldiği belirsiz
- ❌ Telegram onay simülasyonu — gerçek değil
- ❌ Sayfa adı "Orkestratör" — Binance kullanıcısı için anlamsız

**Önerilen Yeniden Adlandırma:**
```
"Orkestratör" → "AI Sinyal Motoru" veya "Otomatik Trade"
Node isimleri:
  market_data       → "Piyasa Verisi"
  llm_analysis      → "AI Analiz (Claude/Gemini)"
  rust_risk         → "Risk Kontrolü"
  telegram_approval → "Onay Bekliyor"
  ccxt_execute      → "Emir Gönder (Binance)"
```

---

### 1.8 Risk Manager

**Mevcut Durum:**
```
- Slider'larla risk parametreleri
- Risk skoru (dairesel gauge)
- Canlı risk durumu (API'den)
- Kaydet/Sıfırla butonları
```

**Sorunlar:**
- ❌ Risk skoru hesaplama mantığı yanlış (max pozisyon büyüklüğü arttıkça skor artıyor)
- ❌ "Rust katmanında doğrulanır" yazısı — VPS olmadan çalışmıyor, yanıltıcı
- ❌ Slider değerleri kaydedilince hiçbir emir kontrol edilmiyor (dekoratif)
- ❌ "Max Açık Pozisyon: 20 adet" — Binance'de pozisyon limiti farklı çalışır
- ❌ Risk durumu (openOrders/dailyLoss) mock fallback değerler döndürüyor
- ❌ Mobilde slider kullanımı zor (dokunmatik hassasiyeti düşük)

**Önerilen İyileştirmeler:**
```
1. Risk skoru: Düşük risk = yüksek skor (şu an tersi)
2. "Rust katmanı" yazısını kaldır, "Binance API ile doğrulanır" yap
3. Slider yerine input + slider kombinasyonu (Binance tarzı)
4. Günlük kayıp limiti: Gerçek Binance bakiyesine göre hesapla
5. Risk uyarısı: Limit aşılınca kırmızı banner (şu an yok)
```

---

### 1.9 Admin / Exchanges

**Mevcut Durum:**
```
- Borsa listesi (OKX/Binance/Bybit/Coinbase/Kraken...)
- Ekle/Düzenle/Sil modal
- API key girişi (sunucu tarafında kullanılır notu var)
- Bağlantı testi butonu
- Mod: paper/testnet/live
```

**Sorunlar:**
- ❌ 10 farklı borsa seçeneği — Binance odaklı sistemde sadece Binance gerekli
- ❌ "Passphrase (OKX / Coinbase)" alanı — Binance'de passphrase yok
- ❌ Bağlantı testi mock latency döndürüyor
- ❌ API key güvenlik uyarısı yok (kritik!)
- ❌ Binance'e özgü ayarlar yok: testnet URL, futures/spot ayrımı, IP whitelist

**Önerilen Binance-Specific Yapı:**
```
Borsa Hesabı Ekle:
  - Hesap Adı: [___]
  - Mod: [Paper] [Testnet] [Live]
  - API Key: [___] (IP kısıtlaması önerilir uyarısı)
  - API Secret: [___] (göster/gizle)
  - Futures: [Açık/Kapalı toggle]
  - Margin: [Açık/Kapalı toggle]
  - IP Whitelist: [VPS IP'nizi ekleyin]
  - [Bağlantıyı Test Et] → Binance /api/v3/account çağrısı
```

---

### 1.10 Admin / Strategies

**Mevcut Durum:**
```
- Strateji listesi (toggle enable/disable)
- Ekle/Düzenle modal (tip, zaman dilimi, borsa, tahsis, risk params, LLM)
- Kod editörü tab'ı (boş textarea)
```

**Sorunlar:**
- ❌ Kod editörü boş — syntax highlighting yok, çalışmıyor
- ❌ "Arbitrage" strateji tipi — Binance'de cross-exchange arbitrage mümkün değil
- ❌ LLM provider seçimi strateji başına — karmaşık, global ayar olmalı
- ❌ Tahsis slider'ı %100 sınırı UI'da kontrol edilmiyor
- ❌ Strateji "enabled" ama hiçbir şey çalışmıyor (backend yok)
- ❌ Backtest butonu yok

**Önerilen İyileştirmeler:**
```
1. Arbitrage tipini kaldır (Binance odaklı)
2. Kod editörü: Monaco Editor veya CodeMirror entegre et
3. Tahsis toplamı: Gerçek zamanlı %100 kontrolü + uyarı
4. "Backtest" butonu ekle (paper modda simülasyon)
5. Strateji durumu: Çalışıyor / Durduruldu / Hata (renk kodlu)
```

---

### 1.11 Admin / Plugins

**Mevcut Durum:**
```
- Built-in plugin listesi (OKX Feed, CCXT, Barter-rs, Nautilus, Telegram)
- GitHub repo URL analizi (mock)
- Plugin config modal
- Hook badge'leri (onTick, onSignal, beforeOrder...)
```

**Sorunlar:**
- ❌ "OKX WebSocket Feed" built-in plugin — Binance odaklı sistemde Binance WS olmalı
- ❌ GitHub repo analizi tamamen mock — gerçek analiz yok
- ❌ "Barter-rs" ve "Nautilus" — VPS olmadan çalışmıyor, kullanıcı yanıltılıyor
- ❌ Plugin "enabled" ama hiçbir hook çalışmıyor
- ❌ npm package desteği var ama çalışmıyor

**Önerilen Built-in Plugin Listesi (Binance Odaklı):**
```
✅ Binance WebSocket Feed     — Spot + Futures ticker
✅ Binance CCXT Adapter       — Emir yönetimi
⚙️ Telegram Approval Bot     — Yarı-oto onay
⚙️ Claude AI Analyst          — LLM sinyal üretimi
⚙️ Gemini AI Analyst          — LLM sinyal üretimi
⚙️ Barter-rs Risk Engine      — VPS gerektirir
⚙️ Nautilus Orchestrator      — VPS gerektirir
```

---

### 1.12 Login

**Mevcut Durum:**
```
- Email + Parola + TOTP (opsiyonel)
- Demo credentials gösteriliyor
- "admin" içeriyorsa token ver (güvensiz)
```

**Sorunlar:**
- ❌ Demo credentials açıkça gösteriliyor — production'da güvenlik açığı
- ❌ TOTP alanı var ama doğrulama yok
- ❌ "Nexus." branding — Binance odaklı sistemde tutarsız
- ❌ Hata mesajı generic — "Geçersiz giriş bilgileri" yeterli değil
- ❌ "Şifremi unuttum" yok
- ❌ Giriş sonrası yönlendirme her zaman "/" — önceki sayfa hatırlanmıyor

---

## 2. RENK SİSTEMİ ANALİZİ

### Mevcut Renk Paleti
```css
--color-accent: #d97706  /* Amber/Turuncu — ana vurgu */
--color-up:     #16a34a  /* Yeşil — artış */
--color-down:   #dc2626  /* Kırmızı — düşüş */
--color-bg:     #f5f7fa  /* Açık gri arka plan */
```

### Sorunlar
- ❌ **Amber accent** — Binance sarısı (#F0B90B) değil, farklı ton
- ❌ Trade Mode badge'leri: `bg-amber-100`, `bg-green-100`, `bg-slate-100` — tutarsız
- ❌ Borsa renkleri: `okx: bg-blue-600`, `binance: bg-amber-500` — Binance odaklı sistemde tek renk yeterli
- ❌ Dark mode'da `--color-accent: #f59e0b` — Binance sarısına yakın ama tam değil

### Önerilen Binance Renk Sistemi
```css
/* Binance Design System */
--color-accent:    #F0B90B  /* Binance Yellow — tam eşleşme */
--color-accent-dk: #C99400  /* Hover state */
--color-up:        #0ECB81  /* Binance Green */
--color-down:      #F6465D  /* Binance Red */
--color-bg:        #FAFAFA  /* Light mode */
--color-bg-elev:   #FFFFFF
--color-bg-soft:   #F5F5F5
--color-line:      #EAECEF

/* Dark mode (Binance Dark) */
--color-bg:        #181A20  /* Binance dark bg */
--color-bg-elev:   #1E2026
--color-bg-soft:   #2B2F36
--color-line:      #2B2F36
--color-text:      #EAECEF
--color-text-dim:  #848E9C
```

---

## 3. TİPOGRAFİ ANALİZİ

### Mevcut
```css
--font-sans: "Inter", "system-ui", sans-serif;
```

### Sorunlar
- ❌ Inter iyi bir seçim ama Binance "IBM Plex Sans" kullanıyor
- ❌ Fiyat gösterimi tutarsız: bazı yerlerde `font-mono`, bazılarında normal
- ❌ Büyük fiyat rakamları için özel font weight yok
- ❌ Tablo hücreleri `tabular-nums` eksik (sayılar hizalanmıyor)

### Önerilen
```css
--font-sans:  "IBM Plex Sans", "Inter", sans-serif;
--font-mono:  "IBM Plex Mono", "JetBrains Mono", monospace;

/* Fiyat gösterimi için her yerde: */
.price { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```

---

## 4. MOBİL UX ANALİZİ

### Mevcut Mobil Deneyim
```
- Bottom nav: 4 item + FAB (iyi başlangıç)
- Header: responsive (sm:inline gizleme var)
- Sayfalar: space-y-4 ile dikey stack
- Modal'lar: bottom sheet (sm:place-items-end) — iyi
- Tablolar: yatay scroll yok, taşıyor
```

### Sorunlar
- ❌ Trade sayfası mobilde kullanılamaz — 3 sütun layout mobilde eziliyor
- ❌ Orderbook olmadığı için mobil trade deneyimi zaten kötü
- ❌ Tablolar (emir geçmişi, PnL snapshot) mobilde taşıyor
- ❌ Slider'lar mobilde hassas değil (küçük dokunma alanı)
- ❌ FAB menüsü 7 item — mobilde çok fazla
- ❌ Command palette (⌘K) mobilde anlamsız

### Binance Mobil Referansı
```
- Trade sayfası: Grafik (üst 40%) | Orderbook (orta 30%) | Form (alt 30%)
- Swipe ile tab geçişi
- Büyük dokunma alanları (min 44px)
- Sayısal input'larda numpad keyboard
- Miktar için hızlı seçim: %25 | %50 | %75 | %100
```

---

## 5. VERİ AKIŞI ANALİZİ

### Mevcut Veri Kaynakları
```
Gerçek:  OKX WebSocket (BTC/ETH/SOL ticker)
Mock:    Binance/Bybit tickers (400ms random walk)
Mock:    RSI/MACD sinyaller (rastgele)
Mock:    Bakiyeler (sabit sayılar)
Mock:    PnL (3sn random drift)
Mock:    Emirler (orderStore dizisi)
```

### Binance Odaklı Sistem İçin Gerekli Gerçek Veri
```
1. Binance WebSocket Streams:
   wss://stream.binance.com:9443/ws/
   - !ticker@arr          → tüm spot ticker'lar
   - btcusdt@depth20      → orderbook
   - btcusdt@kline_1m     → candlestick
   - btcusdt@aggTrade     → son işlemler

2. Binance REST API (CCXT üzerinden):
   - GET /api/v3/account  → bakiye
   - GET /api/v3/openOrders → açık emirler
   - GET /fapi/v2/account → futures bakiye
   - GET /fapi/v1/positionRisk → açık pozisyonlar

3. Kaldırılacak:
   - OKX WebSocket bağlantısı
   - Bybit mock tickers
   - Polymarket mock data
```

---

## 6. AKIŞ (USER FLOW) ANALİZİ

### Mevcut Kritik Akışlar

#### 6.1 Emir Verme Akışı (Mevcut)
```
1. Home → FAB → "Hızlı Emir" → Trade sayfası
   VEYA
   Markets → Coin tıkla → Modal → "Trade'e Git" → Trade sayfası
2. Trade: Borsa seç → Sembol seç → AL/SAT → Miktar → Fiyat → Gönder
3. Sonuç: Flash mesaj (başarı/hata)
```
**Sorun:** 3-4 tıklama, FAB arkasında gizli, borsa seçimi gereksiz

#### 6.1 Emir Verme Akışı (Önerilen — Binance Tarzı)
```
1. Markets → Sembol tıkla → Direkt Trade sayfasına git (modal yok)
   VEYA
   Bottom Nav → Trade → Sembol arama
2. Trade: [AL] / [SAT] → Miktar → [%25/%50/%75/%100] → Gönder
3. Sonuç: Inline onay + emir listesinde görünür
```
**Hedef:** 2 tıklama ile emir

#### 6.2 AI Sinyal → Emir Akışı (Mevcut)
```
1. Orkestratör → Sembol + Provider seç → Çalıştır
2. LangGraph akışı (5 node, ~2-3 sn)
3. Karar: BUY/SELL + güven skoru
4. Telegram onay (simüle)
5. Emir gönder (mock)
```
**Sorun:** Tamamen simüle, kullanıcı gerçek sanıyor

#### 6.2 AI Sinyal → Emir Akışı (Önerilen)
```
1. "AI Sinyal Motoru" sayfası → Otomatik çalışıyor (manuel tetik değil)
2. Sinyal üretilince: Bildirim + Dashboard'da görünür
3. Yarı-oto modda: "Onayla" butonu (Telegram veya UI)
4. Tam-oto modda: Direkt emir (Paper modda güvenli)
```

#### 6.3 Bakiye Görme Akışı (Mevcut)
```
Home → Borsa bakiye kartları (mock)
PnL → Borsa bakiye kartları (API çağrısı, ama mock fallback)
```
**Sorun:** 2 farklı yerde, tutarsız veri

#### 6.3 Bakiye Görme Akışı (Önerilen)
```
Header'da her zaman: "Toplam: $XX,XXX USDT"
Portföy sayfası: Detaylı breakdown
```

---

## 7. BİNANCE KALİTESİNE ULAŞMAK İÇİN ROADMAP

### Faz 1 — Binance Odaklı Temizlik (1-2 Gün) 🧹
```
✦ index.css: Binance renk sistemine geç (#F0B90B, #0ECB81, #F6465D)
✦ Shell: "OKX Live" → "Binance Live" | Bottom nav'a Trade ekle
✦ Trade.tsx: EXCHANGES listesini ["binance"] yap, dropdown kaldır
✦ Markets.tsx: Polymarket tab'ını kaldır, OKX/Bybit satırlarını filtrele
✦ Exchanges.tsx: Passphrase alanını Binance için opsiyonel yap
✦ Plugins.tsx: "OKX WebSocket Feed" → "Binance WebSocket Feed"
✦ store.ts: defaultExchange: "okx" → "binance"
✦ api.ts: defaultExchange: "okx" → "binance"
```

### Faz 2 — Binance WS Entegrasyonu (2-3 Gün) 📡
```
✦ useWsHub.ts: Binance WebSocket stream ekle
  wss://stream.binance.com:9443/ws/!miniTicker@arr
✦ mock.ts: OKX mock'u kaldır, Binance WS'e geç
✦ Home.tsx: Watchlist'i sadece Binance çiftleri göster
✦ Markets.tsx: Gerçek Binance ticker verisi
✦ Shell.tsx: "OKX Live" → "Binance Live" (gerçek WS durumu)
```

### Faz 3 — Trade Sayfası Yeniden Tasarımı (3-4 Gün) 📈
```
✦ Orderbook bileşeni ekle (Binance depth stream)
✦ TradingView Lightweight Charts entegrasyonu
✦ 3 sütun layout: Grafik | Orderbook | Form
✦ Miktar hızlı seçim: %25/%50/%75/%100 butonları
✦ Paper/Live badge her zaman görünür
✦ Borsa dropdown'ı kaldır
✦ Kaldıraç: sadece Futures modunda göster
```

### Faz 4 — Portföy & PnL Gerçek Veri (2-3 Gün) 💰
```
✦ Binance /api/v3/account → gerçek spot bakiye
✦ Binance /fapi/v2/account → gerçek futures bakiye
✦ Gerçek PnL hesaplama (realized + unrealized)
✦ Asset listesi: Logo + gerçek miktarlar
✦ Equity grafiği: Gerçek veri noktaları
```

### Faz 5 — UX Polishing (2-3 Gün) ✨
```
✦ IBM Plex Sans font entegrasyonu
✦ Tüm fiyat gösterimlerinde tabular-nums
✦ Tablo responsive (yatay scroll)
✦ Slider → input+slider kombinasyonu
✦ Mobil trade: swipe gesture
✦ Loading skeleton'lar (şu an spinner yok)
✦ Error state'ler (şu an sadece flash mesaj)
```

---

## 8. KRİTİK UX SORUNLARI (Öncelik Sırası)

| # | Sorun | Etki | Çözüm Süresi |
|---|-------|------|--------------|
| 1 | Trade sayfasında orderbook yok | Kritik | 2 gün |
| 2 | Binance WS bağlantısı yok | Kritik | 1 gün |
| 3 | Renk sistemi Binance değil | Yüksek | 2 saat |
| 4 | FAB arkasında gizli Trade butonu | Yüksek | 30 dk |
| 5 | Çoklu borsa karışıklığı | Yüksek | 1 saat |
| 6 | Polymarket tab'ı | Orta | 15 dk |
| 7 | Candlestick grafik yok | Orta | 3 gün |
| 8 | Mobil tablo taşması | Orta | 1 gün |
| 9 | Demo credentials görünür | Düşük | 15 dk |
| 10 | "Rust katmanı" yanıltıcı yazı | Düşük | 15 dk |

---

## 9. COMPONENT BAZLI PUAN TABLOSU

```
BILEŞEN                    MEVCUT   HEDEF   AÇIK
─────────────────────────────────────────────────────
Shell / Navigation          65%      90%    Binance nav pattern
Login                       70%      85%    Güvenlik + branding
Home / Dashboard            55%      85%    Gerçek bakiye + Binance WS
Markets                     60%      90%    Binance-only, sıralama
Trade                       40%      95%    Orderbook + grafik + layout
PnL / Portföy               50%      85%    Gerçek Binance bakiye
Agents / AI                 65%      80%    Mobile UX + persist
Orchestrator                45%      75%    Gerçek LLM + Binance emir
Risk Manager                55%      85%    Gerçek limit kontrolü
Exchanges Admin             60%      90%    Binance-specific form
Strategies Admin            50%      80%    Backtest + kod editörü
Plugins                     55%      80%    Binance WS plugin
Renk Sistemi                60%      95%    Binance design tokens
Tipografi                   70%      90%    IBM Plex + tabular-nums
Mobil UX                    55%      85%    Trade layout + swipe
─────────────────────────────────────────────────────
GENEL ORTALAMA              57%      87%
```

---

## 10. HIZLI KAZANLAR (Bu Hafta Yapılabilir)

| Değişiklik | Dosya | Süre | Etki |
|---|---|---|---|
| Binance renkleri (#F0B90B vb.) | `index.css` | 30 dk | Yüksek görsel |
| defaultExchange: "binance" | `store.ts`, `api.ts` | 10 dk | Tutarlılık |
| Polymarket tab kaldır | `Markets.tsx` | 15 dk | Temizlik |
| EXCHANGES = ["binance"] | `Trade.tsx` | 10 dk | Odak |
| Bottom nav'a Trade ekle | `Shell.tsx` | 20 dk | Erişilebilirlik |
| OKX Live → Binance Live | `Shell.tsx` | 5 dk | Branding |
| Passphrase alanı opsiyonel | `Exchanges.tsx` | 10 dk | UX |
| Demo credentials gizle | `Login.tsx` | 10 dk | Güvenlik |
| Miktar %25/%50/%75/%100 | `Trade.tsx` | 45 dk | Binance UX |
| Binance WS stream bağla | `useWsHub.ts` | 2 saat | Gerçek veri |

**Toplam: ~5 saat ile %57 → %72 seviyesine çıkılabilir**

---

## 11. SONUÇ

Nexus Trade OS, Binance kalitesine ulaşmak için **doğru temele** sahip:
- ✅ Profesyonel UI bileşen kütüphanesi (shadcn/ui)
- ✅ Zustand state management (iyi yapılandırılmış)
- ✅ WebSocket altyapısı (OKX → Binance'e geçiş kolay)
- ✅ API client katmanı (CCXT üzerinden Binance desteği var)
- ✅ Risk konfigürasyon altyapısı

**Yapılması gerekenler:**
1. **Binance-first** tasarım dili (renkler, branding, WS)
2. **Trade sayfası** yeniden tasarımı (orderbook + grafik)
3. **Gerçek Binance API** entegrasyonu (bakiye + emirler)
4. **Mobil UX** iyileştirmesi (Trade layout)
5. **Çoklu borsa karmaşasını** temizle (sadece Binance)

**Tahmini süre:** 2-3 hafta (tek geliştirici)
**Sonuç:** %57 → %87 Binance kalitesi

---

*Rapor: Nexus Trade OS — Binance UI/UX Analizi — nexus-binance-ui-rapor.md*
*Oluşturulma: Mayıs 2026*
