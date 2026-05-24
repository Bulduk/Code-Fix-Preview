# Nexus Trade OS — Production Deployment Guide

## Prerequisites

- VPS: Ubuntu 22.04 LTS or Amazon Linux 2023
- RAM: 4GB minimum (8GB recommended)
- CPU: 2 cores minimum
- Storage: 40GB SSD
- Domain name (optional but recommended for SSL)

## Quick Start

```bash
# 1. Clone/upload the repository to your VPS
git clone <your-repo> /opt/nexus-src
cd /opt/nexus-src/vps-setup

# 2. Run the install script
sudo bash install.sh

# 3. Configure environment
nano /opt/nexus/.env

# 4. Start services
cd /opt/nexus
docker compose -f app/vps-setup/docker-compose.yml --env-file .env up -d --build

# 5. Verify health
bash app/vps-setup/health-check.sh
```

## Environment Configuration

Edit `/opt/nexus/.env`:

```env
# REQUIRED — Change these!
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
SESSION_SECRET=<32+ char random string>
ENCRYPTION_KEY=<exactly 32 chars>

# Binance Futures (for live trading)
BINANCE_API_KEY=<your-api-key>
BINANCE_SECRET=<your-secret>
BINANCE_TESTNET=false  # true for testnet

# AI Providers (at least one)
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...

# Trade Mode
TRADE_MODE=paper  # paper | live

# Domain
VPS_DOMAIN=your-domain.com
```

## Architecture

```
Internet → Nginx (80/443)
              ├── /api/* → API Server (Node.js/Express 5) :3001
              ├── /ws    → WebSocket Hub :3001
              └── /*     → Frontend (React/Vite) :3000

API Server → PostgreSQL :5432
           → Redis :6379
           → Binance Futures API (CCXT)
           → LLM APIs (Anthropic/Google/OpenAI)
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80, 443 | Reverse proxy + SSL |
| api | 3001 | Express API + WebSocket |
| frontend | 3000 | React SPA |
| postgres | 5432 | Database |
| redis | 6379 | Cache + rate limiting |

## Default Credentials

- URL: `http://your-vps-ip` or `https://your-domain.com`
- Email: `admin@nexus.local`
- Password: `nexus2024`

**⚠️ Change the password immediately after first login!**

## SSL Setup (Let's Encrypt)

```bash
# Install certbot
apt-get install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d your-domain.com

# Auto-renewal
systemctl enable certbot.timer
```

## Binance Futures Setup

1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Create API key with permissions:
   - ✅ Enable Reading
   - ✅ Enable Futures
   - ❌ Enable Withdrawals (NOT needed)
3. Whitelist your VPS IP
4. Add to `.env`:
   ```
   BINANCE_API_KEY=your_key
   BINANCE_SECRET=your_secret
   BINANCE_TESTNET=false
   ```
5. In the UI: Admin → Exchanges → Add Binance account

## Trading Modes

| Mode | Description |
|------|-------------|
| `paper` | Simulated trading, no real money |
| `testnet` | Binance testnet, fake money |
| `live` | Real money trading ⚠️ |

**Always test with paper mode first!**

## Plugin Development

```typescript
import { definePlugin } from "@nexus/plugin-sdk";

export default definePlugin({
  manifest: {
    id: "my-plugin",
    name: "My Plugin",
    version: "1.0.0",
    description: "Custom plugin",
    author: "You",
    kind: "strategy",
    hooks: ["onTick", "onSignal"],
    permissions: { canReadTicks: true },
  },
  handlers: {
    onTick: async (data, ctx) => {
      ctx.log("Tick", data);
    },
  },
});
```

## Monitoring

```bash
# View logs
docker compose logs -f api
docker compose logs -f postgres

# Resource usage
docker stats

# Health check
bash /opt/nexus/app/vps-setup/health-check.sh
```

## Backup

```bash
# Database backup
docker exec nexus_postgres pg_dump -U nexus nexusdb > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i nexus_postgres psql -U nexus nexusdb < backup_20240101.sql
```

## Troubleshooting

### API not starting
```bash
docker logs nexus_api --tail=50
# Check DATABASE_URL is correct
# Check PORT is set
```

### WebSocket not connecting
```bash
# Check nginx config
docker exec nexus_nginx nginx -t
# Check WS upgrade headers in nginx.conf
```

### Binance connection failed
```bash
# Test API key
curl -H "X-MBX-APIKEY: your_key" https://fapi.binance.com/fapi/v1/account
# Check IP whitelist in Binance settings
```

### Kill switch triggered
```bash
# Via UI: Risk Manager → Reset Kill Switch
# Via API:
curl -X POST http://localhost:3001/api/risk/kill-switch/reset \
  -H "Authorization: Bearer <token>"
```

## Security Checklist

- [ ] Changed default admin password
- [ ] Set strong POSTGRES_PASSWORD
- [ ] Set strong SESSION_SECRET (32+ chars)
- [ ] Set ENCRYPTION_KEY (exactly 32 chars)
- [ ] Binance API key IP whitelisted
- [ ] TRADE_MODE=paper for initial testing
- [ ] SSL certificate installed
- [ ] Firewall configured (only 80/443 open)
- [ ] fail2ban installed and configured
