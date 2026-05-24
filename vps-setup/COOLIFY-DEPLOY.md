# Nexus Trade OS — Coolify Deploy Kılavuzu

## VPS Durumu (76.13.151.158)

| Servis | Port | Durum |
|--------|------|-------|
| Coolify Panel | :8000 | ✅ Çalışıyor |
| HTTP (Coolify Proxy) | :80 | ✅ Açık (uygulama yok) |
| HTTPS (Coolify Proxy) | :443 | ✅ Açık (uygulama yok) |
| Nexus API | :8080 | ❌ Deploy edilmedi |
| Nexus Frontend | :3000 | ❌ Deploy edilmedi |

---

## Adım 1 — Coolify'a Giriş

```
http://76.13.151.158:8000
```

---

## Adım 2 — Git Repository Bağla

1. **Settings → Source** → GitHub/GitLab/Gitea bağla
2. Veya **Deploy Key** ile private repo ekle

---

## Adım 3 — Yeni Proje Oluştur

1. **Projects → New Project** → `Nexus Trade OS`
2. **New Resource → Docker Compose**
3. Repository seç → Branch: `main`
4. **Docker Compose dosyası:** `vps-setup/docker-compose.coolify.yml`

---

## Adım 4 — Environment Variables

Coolify UI'da **Environment Variables** sekmesine şunları gir:

```env
POSTGRES_PASSWORD=<openssl rand -hex 32 ile üret>
REDIS_PASSWORD=<openssl rand -hex 16 ile üret>
SESSION_SECRET=<openssl rand -hex 32 ile üret>
TRADE_MODE=paper

# Opsiyonel — API key'ler
OKX_API_KEY=
OKX_SECRET=
OKX_PASSPHRASE=
BINANCE_API_KEY=
BINANCE_SECRET=
BYBIT_API_KEY=
BYBIT_SECRET=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

**Güçlü şifre üretmek için VPS'te:**
```bash
openssl rand -hex 32   # POSTGRES_PASSWORD ve SESSION_SECRET için
openssl rand -hex 16   # REDIS_PASSWORD için
```

---

## Adım 5 — Domain Ayarla

1. **Domains** sekmesi → `76.13.151.158` veya domain adın
2. Coolify otomatik SSL sertifikası alır (Let's Encrypt)
3. Traefik reverse proxy otomatik yapılandırılır

---

## Adım 6 — Deploy

1. **Deploy** butonuna bas
2. Build log'ları izle (~3-5 dakika)
3. Tüm servisler healthy olunca erişilebilir

---

## Adım 7 — İlk Giriş

```
URL:     https://76.13.151.158  (veya domain)
E-posta: admin@nexus.local
Parola:  nexus2024
```

> ⚠️ **İlk girişten sonra şifreyi değiştir!**
> Admin → Profil → Şifre Değiştir

---

## Servis Mimarisi (Coolify ile)

```
İnternet
    │
    ▼
[Coolify Traefik :80/:443]  ← SSL termination, otomatik sertifika
    │
    ├── /api/*  → [nexus_api :8080]      ← Express + WS Hub
    ├── /ws     → [nexus_api :8080]      ← WebSocket (OKX + Binance + Bybit)
    └── /*      → [nexus_frontend :3000] ← React SPA
                        │
                [nexus_postgres :5432]   ← Docker network içinde
                [nexus_redis :6379]      ← Docker network içinde
```

---

## Güncelleme (Coolify ile)

Coolify panelinde:
1. **Deployments → Redeploy** — son commit'i deploy et
2. Veya **Webhook** kur → git push'ta otomatik deploy

---

## Sorun Giderme

```bash
# Coolify panelinde Logs sekmesinden izle
# Veya VPS'te:
docker logs nexus_api -f
docker logs nexus_frontend -f
docker logs nexus_postgres -f

# Servis durumu
docker ps | grep nexus

# DB bağlantısı test
docker exec nexus_postgres psql -U nexus -d nexusdb -c '\dt'
```

---

## API Endpoint'leri

| Endpoint | Açıklama |
|----------|----------|
| `GET /api/healthz` | Health check |
| `GET /api/system/status` | VPS sistem durumu |
| `GET /api/system/health` | Coolify healthcheck |
| `POST /api/auth/login` | Giriş |
| `POST /api/auth/change-password` | Şifre değiştir |
| `GET /api/exchanges` | Exchange listesi |
| `GET /api/orders` | Emir geçmişi |
| `GET /api/pnl/snapshots` | PnL geçmişi |
| `GET /api/pnl/audit` | Audit log |
| `GET /api/system/metrics` | Sistem metrikleri |
| `WS /ws` | WebSocket hub (OKX + Binance + Bybit) |
