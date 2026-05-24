# Nexus Trade OS — VPS Kurulum & Güvenlik Kılavuzu

## Gereksinimler

| Bileşen | Minimum | Önerilen |
|---------|---------|----------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB NVMe |
| Ağ | 100 Mbps | 1 Gbps |

---

## Hızlı Kurulum (Tek Komut)

```bash
# 1. Repoyu klonla
git clone <repo-url> /opt/nexus/repo
cd /opt/nexus/repo

# 2. Ana kurulum (Docker, Node.js, pnpm, UFW, fail2ban)
sudo bash vps-setup/install.sh

# 3. Güvenlik sertleştirme (SSH, kernel, auditd)
sudo bash vps-setup/security-hardening.sh

# 4. .env dosyasını düzenle
nano /opt/nexus/.env

# 5. Servisleri başlat
make -f vps-setup/Makefile up
```

---

## Adım Adım Kurulum

### Adım 1 — Sunucu Hazırlığı

```bash
# Sistemi güncelle
apt-get update && apt-get upgrade -y

# Temel araçlar
apt-get install -y curl wget git htop tmux ufw fail2ban openssl

# Hostname ayarla
hostnamectl set-hostname nexus-trade-os
```

### Adım 2 — SSH Key Kurulumu (ÖNEMLİ: Önce yapın!)

```bash
# Yerel makinenizde SSH key oluşturun
ssh-keygen -t ed25519 -C "nexus-vps" -f ~/.ssh/nexus_vps

# Public key'i sunucuya kopyalayın
ssh-copy-id -i ~/.ssh/nexus_vps.pub root@<VPS_IP>

# Bağlantıyı test edin (yeni terminalde)
ssh -i ~/.ssh/nexus_vps root@<VPS_IP>
```

### Adım 3 — Ana Kurulum

```bash
sudo bash vps-setup/install.sh
```

Bu script şunları yapar:
- ✅ Sistem güncelleme
- ✅ Docker + Docker Compose kurulumu
- ✅ Node.js 22 LTS kurulumu
- ✅ pnpm kurulumu
- ✅ UFW firewall (80/443 açık, iç portlar kapalı)
- ✅ fail2ban SSH koruması
- ✅ Dizin yapısı oluşturma
- ✅ SSL sertifikası (Let's Encrypt veya self-signed)
- ✅ systemd servisi (reboot'ta otomatik başlat)

### Adım 4 — Güvenlik Sertleştirme

```bash
sudo bash vps-setup/security-hardening.sh
```

Bu script şunları yapar:
- ✅ SSH: Root login kapalı, parola auth kapalı
- ✅ Kernel: SYN flood, IP spoofing, ICMP koruması
- ✅ UFW: Gelişmiş kurallar, iç portlar tamamen kapalı
- ✅ fail2ban: SSH (3 deneme/24h ban), Nginx rate limit
- ✅ Otomatik güvenlik güncellemeleri
- ✅ Docker: ICC kapalı, no-new-privileges
- ✅ Auditd: Kritik dosya ve komut izleme

### Adım 5 — .env Yapılandırması

```bash
nano /opt/nexus/.env
```

**Zorunlu alanlar:**

```env
VPS_DOMAIN=nexus.example.com          # Alan adınız
POSTGRES_PASSWORD=<min-32-karakter>   # openssl rand -hex 32
REDIS_PASSWORD=<güçlü-şifre>          # openssl rand -hex 16
SESSION_SECRET=<min-32-karakter>      # openssl rand -hex 32
TRADE_MODE=paper                      # paper (güvenli) veya live
```

**Şifre üretme:**
```bash
openssl rand -hex 32   # POSTGRES_PASSWORD ve SESSION_SECRET için
openssl rand -hex 16   # REDIS_PASSWORD için
```

### Adım 6 — Servisleri Başlat

```bash
cd /opt/nexus/repo

# Temel stack (postgres + redis + api + frontend + nginx)
make -f vps-setup/Makefile up

# Durum kontrolü
make -f vps-setup/Makefile ps

# Logları izle
make -f vps-setup/Makefile logs
```

---

## Servis Mimarisi

```
İnternet
    │
    ▼
[UFW Firewall]  ← Sadece 80/443 açık
    │
    ▼
[Nginx :443]    ← SSL termination, rate limiting, security headers
    │
    ├── /api/*  → [API Server :8080]  ← Express + WS Hub (sadece localhost)
    ├── /ws     → [API Server :8080]  ← WebSocket (sadece localhost)
    └── /*      → [Frontend :3000]    ← React SPA (sadece localhost)
                        │
                [PostgreSQL :5432]    ← Sadece Docker network
                [Redis :6379]         ← Sadece Docker network
```

---

## Güvenlik Katmanları

### 1. Ağ Güvenliği
- **UFW**: Sadece 80/443 dışarıya açık
- **Nginx rate limiting**: API 60r/m, Auth 10r/m
- **fail2ban**: SSH brute-force, Nginx rate limit ban
- **Docker ICC**: Container'lar arası direkt iletişim kapalı

### 2. Uygulama Güvenliği
- **JWT**: HS256, 24h expiry, güçlü secret
- **bcrypt**: Parola hash (cost=12)
- **CORS**: Production'da domain kısıtlı
- **Risk middleware**: Max emir, günlük kayıp limiti
- **Audit log**: Tüm kritik işlemler DB'ye kaydedilir

### 3. Altyapı Güvenliği
- **SSL/TLS**: TLSv1.2+, güçlü cipher suite
- **HSTS**: max-age=63072000, includeSubDomains, preload
- **Security headers**: X-Frame-Options, X-Content-Type-Options, CSP
- **Kernel hardening**: SYN flood, IP spoofing, ICMP koruması
- **Auditd**: Kritik dosya ve sistem çağrısı izleme

### 4. Veri Güvenliği
- **API key şifreleme**: pgcrypto ile DB'de şifreli
- **Secrets**: .env dosyası git'e commit edilmez
- **DB portları**: Sadece Docker network içinde erişilebilir
- **Backup**: Şifreli PostgreSQL yedekleri

---

## Yönetim Komutları

```bash
cd /opt/nexus/repo

# Temel stack
make -f vps-setup/Makefile up          # Başlat
make -f vps-setup/Makefile down        # Durdur
make -f vps-setup/Makefile restart     # Yeniden başlat
make -f vps-setup/Makefile ps          # Durum

# Loglar
make -f vps-setup/Makefile logs        # Tüm loglar
make -f vps-setup/Makefile logs-api    # API logları
make -f vps-setup/Makefile logs-nginx  # Nginx logları

# Güncelleme
make -f vps-setup/Makefile update      # git pull + rebuild

# Yedek
make -f vps-setup/Makefile backup      # PostgreSQL yedeği

# SSL
make -f vps-setup/Makefile ssl-renew   # Sertifika yenile

# Tam stack (barter-rs + nautilus)
make -f vps-setup/Makefile up-full
```

---

## Güvenlik Testleri

### Hızlı Güvenlik Kontrolü

```bash
# Açık portları kontrol et (sadece 22, 80, 443 görünmeli)
ss -tlnp | grep -E ':(22|80|443|5432|6379|8080|3000)'

# UFW durumu
ufw status verbose

# fail2ban durumu
fail2ban-client status
fail2ban-client status sshd

# Docker container güvenliği
docker inspect nexus_api | grep -E '"Privileged"|"NetworkMode"|"IpcMode"'

# SSL sertifika kontrolü
openssl s_client -connect localhost:443 -brief 2>/dev/null | head -5

# Nginx güvenlik başlıkları
curl -sI https://localhost/ | grep -E 'X-Frame|X-Content|Strict-Transport|X-XSS'
```

### API Güvenlik Testleri

```bash
BASE="https://localhost/api"

# 1. Health check (public)
curl -sk "${BASE}/healthz"

# 2. Auth olmadan korumalı endpoint (401 beklenir)
curl -sk "${BASE}/auth/me"

# 3. Yanlış kimlik bilgileri (401 beklenir)
curl -sk -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"hacker@evil.com","password":"wrong"}'

# 4. Geçerli giriş
TOKEN=$(curl -sk -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nexus.local","password":"nexus2024"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 5. Token ile korumalı endpoint
curl -sk -H "Authorization: Bearer ${TOKEN}" "${BASE}/auth/me"

# 6. Rate limit testi (auth endpoint — 10r/m)
for i in $(seq 1 15); do
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "${BASE}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}')
  echo "Deneme $i: HTTP $STATUS"
done

# 7. SQL injection testi (400/401 beklenir, 500 değil)
curl -sk -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin'\''--","password":"x"}'

# 8. XSS payload testi
curl -sk -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(1)</script>","password":"x"}'
```

---

## Sorun Giderme

```bash
# Servis durumu
docker compose -f vps-setup/docker-compose.yml ps

# API logları
docker compose -f vps-setup/docker-compose.yml logs -f api

# DB bağlantısı test
docker compose -f vps-setup/docker-compose.yml exec postgres \
  psql -U nexus -d nexusdb -c '\dt'

# Nginx config test
docker compose -f vps-setup/docker-compose.yml exec nginx nginx -t

# Redis bağlantısı test
docker compose -f vps-setup/docker-compose.yml exec redis \
  redis-cli -a "${REDIS_PASSWORD}" ping

# fail2ban ban listesi
fail2ban-client status sshd | grep "Banned IP"

# Audit log son 20 kayıt
ausearch -k nexus_env -i | tail -20
```

---

## İlk Giriş Sonrası Yapılacaklar

1. **Admin şifresini değiştir** — `POST /api/auth/change-password`
2. **TRADE_MODE=paper** ile başla — canlı işlem için `live` yap
3. **Borsa API key'lerini ekle** — `.env` dosyasına
4. **SSL sertifikasını doğrula** — `make ssl-renew`
5. **Yedek planı kur** — `crontab -e` ile günlük backup

```bash
# Günlük otomatik yedek (crontab)
0 2 * * * cd /opt/nexus/repo && make -f vps-setup/Makefile backup >> /opt/nexus/logs/backup.log 2>&1
```

---

## Varsayılan Giriş

```
E-posta: admin@nexus.local
Parola:  nexus2024
```

> ⚠️ **İlk girişten sonra şifreyi MUTLAKA değiştirin!**
> ⚠️ **TRADE_MODE=paper ile başlayın — gerçek para riski!**
