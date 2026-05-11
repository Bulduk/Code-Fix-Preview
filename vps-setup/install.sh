#!/bin/bash
# ============================================================
# Nexus Trade OS — VPS Kurulum Script (Hostinger Ubuntu 22.04)
# Çalıştır: bash install.sh
# ============================================================
set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[NEXUS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

log "=== Nexus Trade OS VPS Kurulumu ==="
[[ $EUID -ne 0 ]] && err "Root olarak çalıştır: sudo bash install.sh"

# ── 1. Sistem Güncelleme ────────────────────────────────────────────────────
log "1/8 Sistem güncelleniyor..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Temel Paketler ────────────────────────────────────────────────────────
log "2/8 Temel paketler kuruluyor..."
apt-get install -y -qq \
  curl wget git build-essential pkg-config libssl-dev \
  ca-certificates gnupg lsb-release ufw fail2ban \
  htop tmux unzip jq

# ── 3. Docker + Docker Compose ──────────────────────────────────────────────
log "3/8 Docker kuruluyor..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  log "Docker kuruldu: $(docker --version)"
else
  log "Docker zaten mevcut: $(docker --version)"
fi

# ── 4. Rust Kurulumu (Barter-rs için) ───────────────────────────────────────
log "4/8 Rust kuruluyor..."
if ! command -v rustc &>/dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
  log "Rust kuruldu: $(rustc --version)"
else
  log "Rust zaten mevcut: $(rustc --version)"
fi

# ── 5. Python 3.12 + UV (Nautilus için) ─────────────────────────────────────
log "5/8 Python ve UV kuruluyor..."
apt-get install -y -qq python3.12 python3.12-dev python3-pip python3.12-venv
if ! command -v uv &>/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  source "$HOME/.cargo/env"
fi
log "Python: $(python3.12 --version)"

# ── 6. Firewall Yapılandırması ───────────────────────────────────────────────
log "6/8 UFW firewall yapılandırılıyor..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8090/tcp   # Barter-rs REST
ufw allow 8091/tcp   # Nautilus REST
ufw --force enable
log "UFW aktif"

# ── 7. Nexus Klasör Yapısı ──────────────────────────────────────────────────
log "7/8 Dizin yapısı oluşturuluyor..."
mkdir -p /opt/nexus/{logs,data,ssl,backups}
cp -r . /opt/nexus/vps-setup 2>/dev/null || true
cd /opt/nexus

if [[ ! -f .env ]]; then
  if [[ -f vps-setup/.env.example ]]; then
    cp vps-setup/.env.example .env
    warn ".env oluşturuldu — şifreleri ve API key'leri doldurun: nano /opt/nexus/.env"
  fi
fi

# ── 8. Docker Compose Başlat ─────────────────────────────────────────────────
log "8/8 Servisler başlatılıyor..."
cd /opt/nexus
if [[ -f .env ]]; then
  docker compose -f vps-setup/docker-compose.yml --env-file .env up -d --build
  log "Servisler başlatıldı"
  docker compose -f vps-setup/docker-compose.yml ps
else
  warn "⚠ .env dosyası eksik — önce doldurun, sonra:\n  cd /opt/nexus && docker compose -f vps-setup/docker-compose.yml --env-file .env up -d --build"
fi

echo ""
log "========================================"
log "Nexus Trade OS VPS Kurulumu Tamamlandı!"
log "========================================"
echo ""
echo "  📁 Nexus ana dizin:  /opt/nexus"
echo "  🔐 .env dosyası:     /opt/nexus/.env"
echo "  🦀 Barter-rs API:    http://$(hostname -I | awk '{print $1}'):8090"
echo "  🐍 Nautilus API:     http://$(hostname -I | awk '{print $1}'):8091"
echo "  📊 PostgreSQL:       localhost:5432 / nexusdb"
echo ""
echo "  Sonraki adımlar:"
echo "  1. nano /opt/nexus/.env   (şifre ve API key'leri girin)"
echo "  2. docker compose ... up -d --build"
echo "  3. TRADE_MODE=live yapmadan önce paper modda test edin!"
echo ""
