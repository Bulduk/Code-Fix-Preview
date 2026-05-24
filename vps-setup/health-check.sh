#!/bin/bash
# ============================================================
# Nexus Trade OS — Health Verification Script
# Run: bash health-check.sh
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; ((WARN++)); }

echo "============================================"
echo "  Nexus Trade OS — Health Check"
echo "============================================"
echo ""

# ── Docker Services ───────────────────────────────────────────────────────────
echo "── Docker Services ──"
for svc in nexus_postgres nexus_redis nexus_api nexus_frontend nexus_nginx; do
  if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^${svc}$"; then
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "running")
    if [[ "$STATUS" == "healthy" || "$STATUS" == "running" ]]; then
      pass "$svc: $STATUS"
    else
      warn "$svc: $STATUS"
    fi
  else
    fail "$svc: not running"
  fi
done
echo ""

# ── API Health ────────────────────────────────────────────────────────────────
echo "── API Endpoints ──"
API_URL="${API_URL:-http://localhost:3001}"

if curl -sf "$API_URL/api/healthz" -o /dev/null 2>/dev/null; then
  HEALTH=$(curl -sf "$API_URL/api/healthz" 2>/dev/null)
  pass "API /healthz: $HEALTH"
else
  fail "API /healthz: unreachable"
fi

if curl -sf "$API_URL/api/metrics" -o /dev/null 2>/dev/null; then
  pass "API /metrics: accessible"
else
  warn "API /metrics: unreachable"
fi

# ── Auth ──────────────────────────────────────────────────────────────────────
echo ""
echo "── Authentication ──"
AUTH_RESP=$(curl -sf -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nexus.local","password":"nexus2024"}' 2>/dev/null || echo "")

if echo "$AUTH_RESP" | grep -q '"token"'; then
  pass "Auth login: OK"
  TOKEN=$(echo "$AUTH_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  # Test authenticated endpoint
  ME_RESP=$(curl -sf "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
  if echo "$ME_RESP" | grep -q '"userId"'; then
    pass "Auth /me: OK"
  else
    fail "Auth /me: failed"
  fi

  # Test exchanges
  EX_RESP=$(curl -sf "$API_URL/api/exchanges" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
  if echo "$EX_RESP" | grep -q '\['; then
    pass "Exchanges API: OK"
  else
    warn "Exchanges API: empty or failed"
  fi

  # Test risk
  RISK_RESP=$(curl -sf "$API_URL/api/risk" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
  if echo "$RISK_RESP" | grep -q '"killSwitchActive"'; then
    pass "Risk Engine API: OK"
  else
    warn "Risk Engine API: failed"
  fi

  # Test plugins
  PLUGIN_RESP=$(curl -sf "$API_URL/api/plugins" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
  if echo "$PLUGIN_RESP" | grep -q '\['; then
    pass "Plugins API: OK"
  else
    warn "Plugins API: failed"
  fi
else
  fail "Auth login: failed"
fi

# ── WebSocket ─────────────────────────────────────────────────────────────────
echo ""
echo "── WebSocket ──"
WS_URL="${WS_URL:-ws://localhost:3001/ws}"
if command -v wscat &>/dev/null; then
  WS_RESP=$(echo '{"type":"ping"}' | timeout 3 wscat -c "$WS_URL" 2>/dev/null | head -1 || echo "")
  if echo "$WS_RESP" | grep -q '"type"'; then
    pass "WebSocket: connected"
  else
    warn "WebSocket: no response (may need auth)"
  fi
else
  warn "WebSocket: wscat not installed (npm install -g wscat)"
fi

# ── Database ──────────────────────────────────────────────────────────────────
echo ""
echo "── Database ──"
if docker exec nexus_postgres pg_isready -U nexus -d nexusdb 2>/dev/null; then
  pass "PostgreSQL: ready"
  # Check tables
  TABLES=$(docker exec nexus_postgres psql -U nexus -d nexusdb -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' ')
  if [[ "$TABLES" -gt 5 ]]; then
    pass "PostgreSQL tables: $TABLES tables found"
  else
    warn "PostgreSQL tables: only $TABLES tables (expected 7+)"
  fi
else
  fail "PostgreSQL: not ready"
fi

if docker exec nexus_redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
  pass "Redis: PONG"
else
  fail "Redis: not responding"
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
echo ""
echo "── Frontend ──"
FRONTEND_URL="${FRONTEND_URL:-http://localhost}"
if curl -sf "$FRONTEND_URL" -o /dev/null 2>/dev/null; then
  pass "Frontend: accessible"
else
  warn "Frontend: unreachable (may need nginx)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Health Check Summary"
echo "============================================"
echo -e "  ${GREEN}PASS: $PASS${NC}  ${YELLOW}WARN: $WARN${NC}  ${RED}FAIL: $FAIL${NC}"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "  ❌ System has failures — check logs:"
  echo "     docker compose logs --tail=50"
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo "  ⚠️  System running with warnings"
  exit 0
else
  echo "  ✅ All systems operational"
  exit 0
fi
