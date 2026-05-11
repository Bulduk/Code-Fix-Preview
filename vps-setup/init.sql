-- Nexus Trade OS — PostgreSQL 16 Schema
-- VPS'teki init.sql: docker-entrypoint-initdb.d/ tarafından otomatik çalışır

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
DO $$ BEGIN
  CREATE TYPE user_role     AS ENUM ('admin', 'trader', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE exchange_mode AS ENUM ('live', 'testnet', 'paper');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_side    AS ENUM ('buy', 'sell');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_type    AS ENUM ('market', 'limit', 'stop_market', 'stop_limit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status  AS ENUM ('pending', 'open', 'filled', 'cancelled', 'rejected', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users
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

-- Default admin (password: nexus2024 — DEĞİŞTİRİN!)
INSERT INTO users (id, email, password_hash, role)
VALUES ('admin-1', 'admin@nexus.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCjAfozXFPNsVIYzPM.1aW6', 'admin')
ON CONFLICT DO NOTHING;

-- Exchanges (API key'ler pgcrypto ile şifrelenir)
CREATE TABLE IF NOT EXISTS exchanges (
  id             TEXT PRIMARY KEY,
  exchange       TEXT NOT NULL,
  label          TEXT NOT NULL,
  mode           exchange_mode NOT NULL DEFAULT 'paper',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  api_key_enc    TEXT,   -- pgp_sym_encrypt ile şifrelenmiş
  api_secret_enc TEXT,
  passphrase_enc TEXT,
  has_api_key    BOOLEAN NOT NULL DEFAULT false,
  ws_connected   BOOLEAN NOT NULL DEFAULT false,
  latency_ms     INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default exchange kayıtları
INSERT INTO exchanges (id, exchange, label, mode, is_active, has_api_key)
VALUES
  ('1', 'binance', 'main',  'live',    true, false),
  ('2', 'bybit',   'hedge', 'testnet', true, false),
  ('3', 'okx',     'main',  'live',    true, false),
  ('4', 'okx',     'paper', 'paper',   true, false)
ON CONFLICT DO NOTHING;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  exchange_id   TEXT NOT NULL REFERENCES exchanges(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_orders_exchange   ON orders(exchange);
CREATE INDEX IF NOT EXISTS idx_orders_sym        ON orders(sym);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Positions
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
CREATE INDEX IF NOT EXISTS idx_positions_open ON positions(is_open, exchange);

-- PnL Snapshots
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

-- Strategies
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

-- Audit Log
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

-- Barter-rs sinyal tablosu (Rust servisi yazar)
CREATE TABLE IF NOT EXISTS barter_signals (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  exchange    TEXT NOT NULL,
  sym         TEXT NOT NULL,
  side        TEXT NOT NULL,
  strength    REAL NOT NULL,
  reason      TEXT,
  strategy    TEXT,
  market_type TEXT DEFAULT 'spot',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signals_generated ON barter_signals(generated_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_exchanges_updated BEFORE UPDATE ON exchanges FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_strategies_updated BEFORE UPDATE ON strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
