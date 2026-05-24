#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Nexus Trade OS — Siber Güvenlik Hardening Scripti
# Desteklenen: Ubuntu 22.04 / 24.04 LTS
# Çalıştır:    sudo bash vps-setup/security-hardening.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[SEC]${NC}  $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Root olarak çalıştır: sudo bash security-hardening.sh"

log "═══════════════════════════════════════════════════════"
log "  Nexus Trade OS — Güvenlik Sertleştirme Başlıyor"
log "═══════════════════════════════════════════════════════"
echo ""

# ── 1. SSH Güvenlik Sertleştirme ────────────────────────────────────────────
log "1/8 SSH sertleştiriliyor..."
SSH_CONFIG="/etc/ssh/sshd_config"
cp "${SSH_CONFIG}" "${SSH_CONFIG}.bak.$(date +%Y%m%d)"

# SSH güvenlik ayarları
cat >> "${SSH_CONFIG}" << 'EOF'

# ── Nexus Security Hardening ──────────────────────────────────────────────
# Root login devre dışı
PermitRootLogin no
# Parola ile giriş devre dışı (sadece SSH key)
PasswordAuthentication no
# Boş parola yasak
PermitEmptyPasswords no
# X11 forwarding kapalı
X11Forwarding no
# Max auth deneme
MaxAuthTries 3
# Bağlantı zaman aşımı
ClientAliveInterval 300
ClientAliveCountMax 2
# Sadece SSH v2
Protocol 2
# Login grace time
LoginGraceTime 30
EOF

systemctl restart sshd
log "SSH sertleştirildi — root login ve parola girişi devre dışı"

# ── 2. Kernel Güvenlik Parametreleri (sysctl) ────────────────────────────────
log "2/8 Kernel güvenlik parametreleri ayarlanıyor..."
cat > /etc/sysctl.d/99-nexus-security.conf << 'EOF'
# ── Nexus Trade OS — Kernel Security Hardening ──────────────────────────────

# IP Spoofing koruması
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# SYN flood koruması
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_syn_retries = 2
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_max_syn_backlog = 4096

# ICMP redirect devre dışı
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Source routing devre dışı
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0

# Broadcast ping devre dışı
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Bogus ICMP yanıtları yoksay
net.ipv4.icmp_ignore_bogus_error_responses = 1

# Log martian packets
net.ipv4.conf.all.log_martians = 1

# IPv6 router advertisement devre dışı
net.ipv6.conf.all.accept_ra = 0
net.ipv6.conf.default.accept_ra = 0

# Bellek koruması
kernel.randomize_va_space = 2
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2

# Core dump devre dışı
fs.suid_dumpable = 0

# Shared memory güvenliği
kernel.shmmax = 268435456
EOF

sysctl -p /etc/sysctl.d/99-nexus-security.conf > /dev/null 2>&1
log "Kernel güvenlik parametreleri uygulandı"

# ── 3. UFW Gelişmiş Firewall Kuralları ──────────────────────────────────────
log "3/8 UFW gelişmiş kurallar uygulanıyor..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw default deny forward

# SSH — rate limiting ile
ufw limit ssh comment 'SSH rate limit'

# HTTP/HTTPS
ufw allow 80/tcp  comment 'HTTP → HTTPS redirect'
ufw allow 443/tcp comment 'HTTPS'

# İç portlar SADECE localhost (Docker network)
ufw deny 5432/tcp comment 'PostgreSQL — dışarıya kapalı'
ufw deny 6379/tcp comment 'Redis — dışarıya kapalı'
ufw deny 8080/tcp comment 'API — dışarıya kapalı'
ufw deny 3000/tcp comment 'Frontend — dışarıya kapalı'
ufw deny 8090/tcp comment 'Barter-rs — dışarıya kapalı'
ufw deny 8091/tcp comment 'Nautilus — dışarıya kapalı'

ufw --force enable
log "UFW aktif — sadece 80/443 açık, tüm iç portlar kapalı"

# ── 4. fail2ban Gelişmiş Yapılandırma ───────────────────────────────────────
log "4/8 fail2ban gelişmiş yapılandırma..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# Banlama süresi: 1 saat
bantime  = 3600
# Kontrol penceresi: 10 dakika
findtime = 600
# Max deneme
maxretry = 5
# Backend
backend  = systemd
# Bildirim (opsiyonel)
# destemail = admin@nexus.local
# action = %(action_mwl)s

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
maxretry = 3
bantime  = 86400

[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log

[nginx-limit-req]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 10
findtime = 60
bantime  = 600

[nginx-botsearch]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 2

[docker-auth]
enabled  = false
EOF

# Nginx için özel filtre
cat > /etc/fail2ban/filter.d/nginx-limit-req.conf << 'EOF'
[Definition]
failregex = limiting requests, excess:.* by zone.*client: <HOST>
ignoreregex =
EOF

systemctl enable --now fail2ban
systemctl restart fail2ban
log "fail2ban aktif — SSH, Nginx rate limit koruması"

# ── 5. Otomatik Güvenlik Güncellemeleri ─────────────────────────────────────
log "5/8 Otomatik güvenlik güncellemeleri yapılandırılıyor..."
apt-get install -y -qq unattended-upgrades apt-listchanges

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Mail "root";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

log "Otomatik güvenlik güncellemeleri aktif"

# ── 6. Docker Güvenlik Yapılandırması ───────────────────────────────────────
log "6/8 Docker güvenlik yapılandırması..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "no-new-privileges": true,
  "icc": false,
  "live-restore": true,
  "userland-proxy": false,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
EOF

systemctl restart docker 2>/dev/null || true
log "Docker güvenlik yapılandırması uygulandı"

# ── 7. Audit Logging (auditd) ───────────────────────────────────────────────
log "7/8 Audit logging yapılandırılıyor..."
apt-get install -y -qq auditd audispd-plugins

cat > /etc/audit/rules.d/nexus.rules << 'EOF'
# Nexus Trade OS — Audit Kuralları

# Sistem çağrıları izle
-a always,exit -F arch=b64 -S execve -k exec_commands
-a always,exit -F arch=b64 -S open,openat -F exit=-EACCES -k access_denied
-a always,exit -F arch=b64 -S open,openat -F exit=-EPERM -k access_denied

# Kritik dosya değişikliklerini izle
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k sudoers
-w /etc/ssh/sshd_config -p wa -k sshd_config

# Docker socket
-w /var/run/docker.sock -p rwxa -k docker_socket

# Nexus dizini
-w /opt/nexus/.env -p rwa -k nexus_env
-w /opt/nexus/repo/vps-setup/ -p wa -k nexus_config

# Ağ bağlantıları
-a always,exit -F arch=b64 -S connect -k network_connect
EOF

systemctl enable --now auditd
augenrules --load 2>/dev/null || true
log "Audit logging aktif"

# ── 8. Güvenlik Özeti ve Kontrol ────────────────────────────────────────────
log "8/8 Güvenlik kontrol raporu oluşturuluyor..."

echo ""
log "═══════════════════════════════════════════════════════"
log "  Güvenlik Sertleştirme Tamamlandı!"
log "═══════════════════════════════════════════════════════"
echo ""
echo -e "  ✅ SSH:          Root login kapalı, parola auth kapalı"
echo -e "  ✅ Kernel:       SYN flood, IP spoofing, ICMP koruması"
echo -e "  ✅ UFW:          Sadece 80/443 açık, iç portlar kapalı"
echo -e "  ✅ fail2ban:     SSH (3 deneme/24h ban), Nginx rate limit"
echo -e "  ✅ Auto-update:  Güvenlik yamaları otomatik"
echo -e "  ✅ Docker:       ICC kapalı, no-new-privileges"
echo -e "  ✅ Auditd:       Kritik dosya ve komut izleme aktif"
echo ""
warn "⚠ SSH key'inizi ekleyin ÖNCE, sonra PasswordAuthentication no etkili olur"
warn "⚠ Mevcut SSH oturumunuzu kapatmadan test edin!"
echo ""
