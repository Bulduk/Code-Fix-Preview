-- ============================================================
-- Nexus Trade OS — PostgreSQL 16 Schema
-- Auto-runs on first container start
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ── Enum Types ────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin', 'trader', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE exchange_mode AS ENUM ('live', 'testnet', 'paper');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE order_side AS ENUM ('buy', 'sell');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop_market', 'stop_limit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending', 'open', 'filled', 'cancelled', 'rejected', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'trader',
  totp_secret   TEXT,
  totp_enabled  BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Default admin (password: nexus2024)
INSERT INTO users (id, email, password_hash, role)
VALUES ('admin-1', 'admin@nexus.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCjAfozXFPNsVIYzPM.1aW6', 'admin')
ON CONFLICT DO NOTHING;

-- ── Exchanges ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exchanges (
  id              TEXT PRIMARY KEY,
  exchange        TEXT NOT NULL,
  label           TEXT NOT NULL,
  mode            exchange_mode NOT NULL DEFAULT 'paper',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  api_key_enc     TEXT,
  api_secret_enc  TEXT,
  passphrase_enc  TEXT,
  has_api_key     BOOLEAN NOT NULL DEFAULT false,
  ws_connected    BOOLEAN NOT NULL DEFAULT false,
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default Binance paper trading account
INSERT INTO exchanges (id, exchange, label, mode, is_active, has_api_key, ws_connected, latency_ms)
VALUES ('binance-paper', 'binance', 'paper', 'paper', true, false, true, 5)
ON CONFLICT DO NOTHING;

-- ── Orders ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  exchange_id   TEXT NOT NULL,
  exchange_oid  TEXT,
  exchange      TEXT NOT NULL,
  sym           TEXT NOT NULL,
  side          order_side NOT NULL,
  type          order_type NOT NULL,
  qty           REAL NOT NULL,
  px            REAL,
  avg_fill_px   REAL,
  filled_qty    REAL DEFAULT 0,
  fee           REAL DEFAULT 0,
  status        order_status NOT NULL DEFAULT 'pending',
  is_paper      TEXT DEFAULT 'false',
  placed_by     TEXT,
  strategy_id   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_exchange    ON orders(exchange);
CREATE INDEX IF NOT EXISTS idx_orders_sym         ON orders(sym);
CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_exchange_id ON orders(exchange_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);

-- ── Positions ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS positions (
  id              TEXT PRIMARY KEY,
  exchange_id     TEXT NOT NULL,
  exchange        TEXT NOT NULL,
  sym             TEXT NOT NULL,
  side            TEXT NOT NULL,
  qty             REAL NOT NULL,
  entry_px        REAL NOT NULL,
  mark_px         REAL NOT NULL,
  liq_px          REAL,
  leverage        REAL DEFAULT 1,
  unrealized_pnl  REAL DEFAULT 0,
  realized_pnl    REAL DEFAULT 0,
  is_paper        BOOLEAN NOT NULL DEFAULT false,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  is_open         BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_positions_open     ON positions(is_open, exchange);
CREATE INDEX IF NOT EXISTS idx_positions_exchange ON positions(exchange_id);

-- ── PnL Snapshots ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pnl_snapshots (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  exchange_id   TEXT,
  equity        REAL NOT NULL,
  total_balance REAL NOT NULL DEFAULT 0,
  realized      REAL NOT NULL DEFAULT 0,
  unrealized    REAL NOT NULL DEFAULT 0,
  daily_pnl     REAL DEFAULT 0,
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnl_snapshot_at ON pnl_snapshots(snapshot_at DESC);

-- ── Strategies ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS strategies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 0,
  allocation  REAL NOT NULL DEFAULT 10,
  provider    TEXT NOT NULL DEFAULT 'anthropic',
  model       TEXT NOT NULL,
  exchange_id TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  code        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default strategies
INSERT INTO strategies (id, name, kind, enabled, allocation, provider, model, exchange_id, params_json)
VALUES
  ('strat-1', 'BTC EMA Trend', 'ema_trend', 0, 20, 'anthropic', 'claude-3-5-haiku-20241022', 'binance-paper',
   '{"timeframe":"15m","symbol":"BTCUSDT","stopLossPct":2,"takeProfitPct":4,"riskPerTradePct":1,"maxPositions":3,"emaFast":9,"emaSlow":21}'),
  ('strat-2', 'ETH RSI Pullback', 'rsi_pullback', 0, 15, 'google', 'gemini-1.5-flash', 'binance-paper',
   '{"timeframe":"1h","symbol":"ETHUSDT","stopLossPct":2.5,"takeProfitPct":5,"riskPerTradePct":0.8,"maxPositions":2,"rsiOversold":30,"rsiOverbought":70}'),
  ('strat-3', 'BTC Breakout', 'breakout', 0, 15, 'anthropic', 'claude-3-5-haiku-20241022', 'binance-paper',
   '{"timeframe":"4h","symbol":"BTCUSDT","stopLossPct":3,"takeProfitPct":6,"riskPerTradePct":1,"maxPositions":2,"lookback":20}'),
  ('strat-4', 'SOL Scalper', 'scalping', 0, 10, 'anthropic', 'claude-3-5-haiku-20241022', 'binance-paper',
   '{"timeframe":"5m","symbol":"SOLUSDT","stopLossPct":1,"takeProfitPct":2,"riskPerTradePct":0.5,"maxPositions":5}')
ON CONFLICT DO NOTHING;

-- ── Audit Log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL,
  actor      TEXT NOT NULL,
  meta       TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_log(action);

-- ── Signals ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS signals (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  strategy_id  TEXT,
  exchange_id  TEXT,
  exchange     TEXT NOT NULL,
  sym          TEXT NOT NULL,
  side         TEXT NOT NULL,
  strength     REAL NOT NULL,
  confidence   REAL DEFAULT 0,
  reasons      TEXT,
  indicators   TEXT,
  suggested_entry REAL,
  suggested_sl    REAL,
  suggested_tp    REAL,
  suggested_qty   REAL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_generated ON signals(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_sym        ON signals(sym);

-- ── Risk Events ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_events (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type TEXT NOT NULL,
  reason     TEXT,
  meta       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_events_created ON risk_events(created_at DESC);

-- ── Updated_at Trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_exchanges_updated BEFORE UPDATE ON exchanges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_strategies_updated BEFORE UPDATE ON strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
