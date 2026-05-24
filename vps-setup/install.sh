#!/bin/bash
# ============================================================
# Nexus Trade OS — VPS Production Install Script
# Supports: Ubuntu 22.04, Amazon Linux 2023
# Run: sudo bash install.sh
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[NEXUS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[INFO]${NC}  $1"; }

log "============================================"
log "  Nexus Trade OS — VPS Production Install"
log "============================================"

[[ $EUID -ne 0 ]] && err "Root olarak çalıştır: sudo bash install.sh"

# Detect OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  OS="unknown"
fi

log "OS: $OS"

# ── 1. System Update ─────────────────────────────────────────────────────────
log "1/9 Sistem güncelleniyor..."
if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
  apt-get update -qq && apt-get upgrade -y -qq
  apt-get install -y -qq curl wget git build-essential ca-certificates gnupg lsb-release ufw fail2ban htop tmux unzip jq openssl
elif [[ "$OS" == "amzn" ]]; then
  dnf update -y -q
  dnf install -y curl wget git gcc openssl jq htop tmux unzip
fi

# ── 2. Docker ─────────────────────────────────────────────────────────────────
log "2/9 Docker kuruluyor..."
if ! command -v docker &>/dev/null; then
  if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif [[ "$OS" == "amzn" ]]; then
    dnf install -y docker
    systemctl enable --now docker
    # Docker Compose plugin for Amazon Linux
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  fi
  systemctl enable --now docker
  log "Docker kuruldu: $(docker --version)"
else
  log "Docker mevcut: $(docker --version)"
fi

# ── 3. Node.js 22 ────────────────────────────────────────────────────────────
log "3/9 Node.js 22 kuruluyor..."
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1 | tr -d 'v')" -lt 22 ]]; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - 2>/dev/null || \
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null || true
  if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    apt-get install -y nodejs
  elif [[ "$OS" == "amzn" ]]; then
    dnf install -y nodejs
  fi
fi
log "Node.js: $(node --version)"

# ── 4. pnpm ───────────────────────────────────────────────────────────────────
log "4/9 pnpm kuruluyor..."
if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm
fi
log "pnpm: $(pnpm --version)"

# ── 5. Firewall ───────────────────────────────────────────────────────────────
log "5/9 Firewall yapılandırılıyor..."
if command -v ufw &>/dev/null; then
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  log "UFW aktif"
elif command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-service=ssh
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
  log "firewalld aktif"
fi

# ── 6. Nexus Directory ────────────────────────────────────────────────────────
log "6/9 Dizin yapısı oluşturuluyor..."
NEXUS_DIR="/opt/nexus"
mkdir -p "$NEXUS_DIR"/{logs,data,ssl,backups,monitoring}

# Copy project files
if [[ -d "$(dirname "$0")/.." ]]; then
  cp -r "$(dirname "$0")/.." "$NEXUS_DIR/app" 2>/dev/null || true
fi

cd "$NEXUS_DIR"

# ── 7. Environment Setup ──────────────────────────────────────────────────────
log "7/9 Environment yapılandırılıyor..."
if [[ ! -f "$NEXUS_DIR/.env" ]]; then
  if [[ -f "$NEXUS_DIR/app/vps-setup/.env.example" ]]; then
    cp "$NEXUS_DIR/app/vps-setup/.env.example" "$NEXUS_DIR/.env"
  else
    cat > "$NEXUS_DIR/.env" << 'ENVEOF'
POSTGRES_PASSWORD=CHANGE_THIS_NOW
REDIS_PASSWORD=CHANGE_THIS_NOW
SESSION_SECRET=CHANGE_THIS_NOW_MIN32CHARS_RANDOM
ENCRYPTION_KEY=CHANGE_THIS_NOW_EXACTLY_32CHARS_
BINANCE_API_KEY=
BINANCE_SECRET=
BINANCE_TESTNET=false
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TRADE_MODE=paper
VPS_DOMAIN=localhost
GRAFANA_PASSWORD=nexus_grafana
LOG_LEVEL=info
CORS_ORIGIN=*
ENVEOF
  fi

  # Generate secure secrets
  SESSION_SECRET=$(openssl rand -hex 32)
  ENCRYPTION_KEY=$(openssl rand -hex 16)
  POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  REDIS_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')

  sed -i "s/CHANGE_THIS_NOW_MIN32CHARS_RANDOM/$SESSION_SECRET/" "$NEXUS_DIR/.env"
  sed -i "s/CHANGE_THIS_NOW_EXACTLY_32CHARS_/$ENCRYPTION_KEY/" "$NEXUS_DIR/.env"
  sed -i "s/CHANGE_THIS_NOW/$POSTGRES_PASSWORD/g" "$NEXUS_DIR/.env"

  warn "⚠️  .env oluşturuldu — API key'leri doldurun: nano $NEXUS_DIR/.env"
fi

# ── 8. SSL Certificate ────────────────────────────────────────────────────────
log "8/9 SSL sertifikası kontrol ediliyor..."
SSL_DIR="$NEXUS_DIR/ssl"
if [[ ! -f "$SSL_DIR/fullchain.pem" ]]; then
  warn "SSL sertifikası bulunamadı — self-signed oluşturuluyor (production için Let's Encrypt kullanın)"
  mkdir -p "$SSL_DIR"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Nexus/CN=localhost" 2>/dev/null
  log "Self-signed SSL oluşturuldu"
fi

# ── 9. Start Services ─────────────────────────────────────────────────────────
log "9/9 Servisler başlatılıyor..."
cd "$NEXUS_DIR"

COMPOSE_FILE="$NEXUS_DIR/app/vps-setup/docker-compose.yml"
if [[ -f "$COMPOSE_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$NEXUS_DIR/.env" pull 2>/dev/null || true
  docker compose -f "$COMPOSE_FILE" --env-file "$NEXUS_DIR/.env" up -d --build
  sleep 5
  docker compose -f "$COMPOSE_FILE" ps
else
  warn "docker-compose.yml bulunamadı: $COMPOSE_FILE"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
log "============================================"
log "  Nexus Trade OS Kurulumu Tamamlandı!"
log "============================================"
echo ""
echo "  📁 Nexus dizin:    $NEXUS_DIR"
echo "  🔐 .env dosyası:   $NEXUS_DIR/.env"
echo "  🌐 Frontend:       http://$(hostname -I | awk '{print $1}')"
echo "  🔒 HTTPS:          https://$(hostname -I | awk '{print $1}')"
echo "  📊 API:            http://$(hostname -I | awk '{print $1}')/api/healthz"
echo ""
echo "  Sonraki adımlar:"
echo "  1. nano $NEXUS_DIR/.env   (API key'leri girin)"
echo "  2. docker compose ... up -d --build"
echo "  3. TRADE_MODE=paper ile test edin"
echo "  4. Let's Encrypt SSL: certbot --nginx -d your-domain.com"
echo ""
echo "  Sağlık kontrolü:"
echo "  bash $NEXUS_DIR/app/vps-setup/health-check.sh"
echo ""
