#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Nexus Trade OS — VPS Kurulum Scripti
# Desteklenen: Ubuntu 22.04 / 24.04 LTS
# Çalıştır:    sudo bash install.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[NEXUS]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Root olarak çalıştır: sudo bash install.sh"

NEXUS_DIR="/opt/nexus"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log "═══════════════════════════════════════════════"
log "  Nexus Trade OS — VPS Kurulumu Başlıyor"
log "═══════════════════════════════════════════════"
echo ""

# ── 1. Sistem Güncelleme ────────────────────────────────────────────────────
log "1/10 Sistem güncelleniyor..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# ── 2. Temel Paketler ────────────────────────────────────────────────────────
log "2/10 Temel paketler kuruluyor..."
apt-get install -y -qq \
  curl wget git build-essential pkg-config libssl-dev \
  ca-certificates gnupg lsb-release ufw fail2ban \
  htop tmux unzip jq openssl certbot python3-certbot-nginx

# ── 3. Docker + Docker Compose ──────────────────────────────────────────────
log "3/10 Docker kuruluyor..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  log "Docker kuruldu: $(docker --version)"
else
  log "Docker zaten mevcut: $(docker --version)"
fi

# ── 4. Node.js 22 LTS ───────────────────────────────────────────────────────
log "4/10 Node.js 22 LTS kuruluyor..."
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1 | tr -d 'v')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
  log "Node.js kuruldu: $(node --version)"
else
  log "Node.js zaten mevcut: $(node --version)"
fi

# ── 5. pnpm ─────────────────────────────────────────────────────────────────
log "5/10 pnpm kuruluyor..."
if ! command -v pnpm &>/dev/null; then
  corepack enable
  corepack prepare pnpm@latest --activate
  log "pnpm kuruldu: $(pnpm --version)"
else
  log "pnpm zaten mevcut: $(pnpm --version)"
fi

# ── 6. Firewall ─────────────────────────────────────────────────────────────
log "6/10 UFW firewall yapılandırılıyor..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP (→ HTTPS redirect)
ufw allow 443/tcp   # HTTPS
# İç portlar sadece localhost'tan erişilebilir (Docker network)
ufw --force enable
log "UFW aktif — 80/443 açık, iç portlar kapalı"

# ── 7. fail2ban ─────────────────────────────────────────────────────────────
log "7/10 fail2ban yapılandırılıyor..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
EOF
systemctl enable --now fail2ban
log "fail2ban aktif"

# ── 8. Nexus Dizin Yapısı ───────────────────────────────────────────────────
log "8/10 Dizin yapısı oluşturuluyor..."
mkdir -p "${NEXUS_DIR}"/{logs,data,ssl,backups,nginx/ssl}

# Repo'yu kopyala
if [[ -d "${REPO_DIR}" ]]; then
  rsync -a --exclude='.git' --exclude='node_modules' --exclude='*/node_modules' \
    --exclude='*/dist' --exclude='.next' --exclude='*.zip' \
    "${REPO_DIR}/" "${NEXUS_DIR}/repo/"
  log "Repo kopyalandı → ${NEXUS_DIR}/repo"
else
  warn "Repo dizini bulunamadı: ${REPO_DIR}"
fi

# .env oluştur
if [[ ! -f "${NEXUS_DIR}/.env" ]]; then
  if [[ -f "${NEXUS_DIR}/repo/vps-setup/.env.example" ]]; then
    cp "${NEXUS_DIR}/repo/vps-setup/.env.example" "${NEXUS_DIR}/.env"
    # SESSION_SECRET otomatik üret
    SESSION_SECRET=$(openssl rand -hex 32)
    sed -i "s/CHANGE_THIS_SESSION_SECRET_MIN32CHARS_RANDOM/${SESSION_SECRET}/" "${NEXUS_DIR}/.env"
    warn "══════════════════════════════════════════════════"
    warn ".env oluşturuldu — ZORUNLU: şifreleri doldurun!"
    warn "  nano ${NEXUS_DIR}/.env"
    warn "══════════════════════════════════════════════════"
  fi
fi

# ── 9. SSL Sertifikası ──────────────────────────────────────────────────────
log "9/10 SSL sertifikası kontrol ediliyor..."
if [[ -f "${NEXUS_DIR}/.env" ]]; then
  VPS_DOMAIN=$(grep '^VPS_DOMAIN=' "${NEXUS_DIR}/.env" | cut -d= -f2 | tr -d '"' | tr -d "'")
fi

if [[ -n "${VPS_DOMAIN:-}" ]] && [[ "${VPS_DOMAIN}" != "your-domain.com" ]]; then
  if [[ ! -f "/etc/letsencrypt/live/${VPS_DOMAIN}/fullchain.pem" ]]; then
    log "Let's Encrypt sertifikası alınıyor: ${VPS_DOMAIN}"
    # Geçici nginx başlat
    apt-get install -y -qq nginx
    systemctl start nginx || true
    certbot certonly --nginx -d "${VPS_DOMAIN}" --non-interactive --agree-tos \
      --email "admin@${VPS_DOMAIN}" --redirect || warn "Certbot başarısız — manuel SSL gerekebilir"
    systemctl stop nginx || true
  fi
  # SSL dosyalarını kopyala
  if [[ -f "/etc/letsencrypt/live/${VPS_DOMAIN}/fullchain.pem" ]]; then
    cp "/etc/letsencrypt/live/${VPS_DOMAIN}/fullchain.pem" "${NEXUS_DIR}/repo/vps-setup/nginx/ssl/"
    cp "/etc/letsencrypt/live/${VPS_DOMAIN}/privkey.pem"   "${NEXUS_DIR}/repo/vps-setup/nginx/ssl/"
    log "SSL sertifikaları kopyalandı"
  fi
else
  warn "VPS_DOMAIN ayarlanmamış — self-signed sertifika oluşturuluyor (geliştirme için)"
  mkdir -p "${NEXUS_DIR}/repo/vps-setup/nginx/ssl"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${NEXUS_DIR}/repo/vps-setup/nginx/ssl/privkey.pem" \
    -out    "${NEXUS_DIR}/repo/vps-setup/nginx/ssl/fullchain.pem" \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Nexus/CN=localhost" 2>/dev/null
  warn "Self-signed sertifika oluşturuldu — tarayıcı uyarısı normal"
fi

# ── 10. Docker Compose Başlat ────────────────────────────────────────────────
log "10/10 Servisler başlatılıyor..."
cd "${NEXUS_DIR}/repo"

if [[ ! -f "${NEXUS_DIR}/.env" ]]; then
  warn "⚠ .env dosyası eksik — önce doldurun:"
  warn "  nano ${NEXUS_DIR}/.env"
  warn "Sonra başlatmak için:"
  warn "  cd ${NEXUS_DIR}/repo && docker compose -f vps-setup/docker-compose.yml --env-file ${NEXUS_DIR}/.env up -d --build"
  exit 0
fi

# .env'deki kritik değerleri kontrol et
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' "${NEXUS_DIR}/.env" | cut -d= -f2)
if [[ "${POSTGRES_PASSWORD}" == "CHANGE_THIS_STRONG_PASSWORD_MIN32CHARS" ]] || [[ -z "${POSTGRES_PASSWORD}" ]]; then
  warn "⚠ POSTGRES_PASSWORD değiştirilmemiş!"
  warn "  nano ${NEXUS_DIR}/.env  →  şifreleri girin"
  warn "  Sonra: cd ${NEXUS_DIR}/repo && docker compose -f vps-setup/docker-compose.yml --env-file ${NEXUS_DIR}/.env up -d --build"
  exit 0
fi

docker compose -f vps-setup/docker-compose.yml --env-file "${NEXUS_DIR}/.env" up -d --build

log "Servis durumu:"
docker compose -f vps-setup/docker-compose.yml ps

# systemd servisi oluştur (reboot'ta otomatik başlat)
cat > /etc/systemd/system/nexus.service << EOF
[Unit]
Description=Nexus Trade OS
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${NEXUS_DIR}/repo
ExecStart=/usr/bin/docker compose -f vps-setup/docker-compose.yml --env-file ${NEXUS_DIR}/.env up -d
ExecStop=/usr/bin/docker compose -f vps-setup/docker-compose.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable nexus.service
log "systemd servisi aktif — reboot'ta otomatik başlar"

# ── Özet ────────────────────────────────────────────────────────────────────
VPS_IP=$(hostname -I | awk '{print $1}')
echo ""
log "═══════════════════════════════════════════════════════"
log "  Nexus Trade OS Kurulumu Tamamlandı!"
log "═══════════════════════════════════════════════════════"
echo ""
echo -e "  🌐 Frontend:    ${CYAN}https://${VPS_DOMAIN:-$VPS_IP}${NC}"
echo -e "  🔌 API:         ${CYAN}https://${VPS_DOMAIN:-$VPS_IP}/api${NC}"
echo -e "  🔌 WebSocket:   ${CYAN}wss://${VPS_DOMAIN:-$VPS_IP}/ws${NC}"
echo -e "  📁 Nexus dizin: ${CYAN}${NEXUS_DIR}${NC}"
echo -e "  🔐 .env:        ${CYAN}${NEXUS_DIR}/.env${NC}"
echo ""
echo -e "  🔑 Varsayılan giriş:"
echo -e "     E-posta: ${CYAN}admin@nexus.local${NC}"
echo -e "     Parola:  ${CYAN}nexus2024${NC}  ← GİRİŞTEN SONRA DEĞİŞTİRİN!"
echo ""
echo -e "  📋 Faydalı komutlar:"
echo -e "     Loglar:   ${CYAN}docker compose -f ${NEXUS_DIR}/repo/vps-setup/docker-compose.yml logs -f${NC}"
echo -e "     Durdur:   ${CYAN}systemctl stop nexus${NC}"
echo -e "     Başlat:   ${CYAN}systemctl start nexus${NC}"
echo -e "     Güncelle: ${CYAN}cd ${NEXUS_DIR}/repo && git pull && docker compose -f vps-setup/docker-compose.yml up -d --build${NC}"
echo ""
warn "⚠ TRADE_MODE=paper — canlı işlem için .env'de TRADE_MODE=live yapın"
warn "⚠ admin@nexus.local şifresini değiştirmeyi unutmayın!"
echo ""
