# Nexus Trade OS — VPS Kurulum Kılavuzu

## Gereksinimler
- Ubuntu 22.04 / 24.04 LTS VPS (min. 2 vCPU, 4 GB RAM, 40 GB SSD)
- Root erişimi
- Domain adı (opsiyonel, SSL için gerekli)

---

## Hızlı Kurulum

```bash
# 1. Repoyu klonla
git clone <repo-url> /opt/nexus/repo
cd /opt/nexus/repo

# 2. Kurulum scriptini çalıştır
sudo bash vps-setup/install.sh

# 3. .env dosyasını düzenle
nano /opt/nexus/.env

# 4. Servisleri başlat
cd /opt/nexus/repo
make -f vps-setup/Makefile up
```

---

## .env Zorunlu Alanlar

| Değişken | Açıklama |
|---|---|
| `VPS_DOMAIN` | Alan adınız (örn: `nexus.example.com`) |
| `POSTGRES_PASSWORD` | PostgreSQL şifresi (min 32 karakter) |
| `REDIS_PASSWORD` | Redis şifresi |
| `SESSION_SECRET` | JWT imzalama anahtarı (min 32 karakter, `openssl rand -hex 32`) |
| `TRADE_MODE` | `paper` (güvenli) veya `live` (gerçek para) |

---

## Servis Mimarisi

```
İnternet
    │
    ▼
[Nginx :443]  ← SSL termination, rate limiting
    │
    ├── /api/*  → [API Server :8080]  ← Express + WS Hub
    ├── /ws     → [API Server :8080]  ← WebSocket (OKX live data)
    └── /*      → [Frontend :3000]    ← React SPA (nginx static)
                        │
                [PostgreSQL :5432]
                [Redis :6379]
```

---

## Yönetim Komutları

```bash
cd /opt/nexus/repo

# Temel stack (postgres + redis + api + frontend + nginx)
make -f vps-setup/Makefile up

# Tam stack (barter-rs + nautilus dahil)
make -f vps-setup/Makefile up-full

# Logları izle
make -f vps-setup/Makefile logs

# Güncelle
make -f vps-setup/Makefile update

# Yedek al
make -f vps-setup/Makefile backup

# SSL yenile
make -f vps-setup/Makefile ssl-renew
```

---

## Varsayılan Giriş

```
E-posta: admin@nexus.local
Parola:  nexus2024
```

> ⚠️ **İlk girişten sonra şifreyi değiştirin!**

---

## SSL Sertifikası

### Let's Encrypt (Önerilen)
```bash
# .env'de VPS_DOMAIN ayarlandıktan sonra install.sh otomatik alır
# Manuel yenileme:
make -f vps-setup/Makefile ssl-renew
```

### Self-Signed (Geliştirme)
```bash
# install.sh domain yoksa otomatik oluşturur
# Tarayıcı uyarısı normaldir
```

---

## Borsa API Anahtarları

`.env` dosyasına ekleyin:
```env
OKX_API_KEY=...
OKX_SECRET=...
OKX_PASSPHRASE=...
```

> API key olmadan sistem **paper trading** modunda çalışır (simülasyon).

---

## Güvenlik Notları

1. `TRADE_MODE=paper` ile başlayın — canlı işlem için `live` yapın
2. `SESSION_SECRET` en az 32 karakter olmalı
3. PostgreSQL ve Redis portları dışarıya kapalı (sadece Docker network)
4. Nginx rate limiting aktif (API: 60r/m, Auth: 10r/m)
5. fail2ban SSH brute-force koruması aktif

---

## Sorun Giderme

```bash
# Servis durumu
docker compose -f vps-setup/docker-compose.yml ps

# API logları
docker compose -f vps-setup/docker-compose.yml logs -f api

# DB bağlantısı test
docker compose -f vps-setup/docker-compose.yml exec postgres psql -U nexus -d nexusdb -c '\dt'

# Nginx config test
docker compose -f vps-setup/docker-compose.yml exec nginx nginx -t
```
