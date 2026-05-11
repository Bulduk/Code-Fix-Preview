# Nexus Trade OS

Professional multi-agent trading platform with Turkish UI. Real backend (Express + CCXT + JWT), multi-agent model (each agent assigned to specific market types: spot/futures/margin/polymarket), seamless trade mode transitions (manual/semi_auto/full_auto) synced with backend.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/nexus-trade-os run dev` — run the frontend (port 23331)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (optional — app works with mock data)

## Login

- Email: `admin@nexus.local`
- Password: `nexus2024`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 + Zustand v5 + Wouter v3
- API: Express 5 + pino logging
- DB: PostgreSQL + Drizzle ORM (optional — app has full mock fallback)
- Auth: JWT (jose) + bcryptjs
- CCXT: Multi-exchange REST + WS (OKX public WS live)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nexus-trade-os/src/` — React frontend
  - `pages/Markets.tsx` — Spot/Perp/Futures/Margin/Polymarket tabbed layout + coin detail modal
  - `pages/Agents.tsx` — Multi-agent with per-agent market_types assignment
  - `pages/admin/Plugins.tsx` — Plugin/Extension marketplace with GitHub repo analyzer
  - `pages/admin/SystemSettings.tsx` — Trade mode (manual/semi_auto/full_auto) + risk config
  - `lib/api.ts` — Real HTTP calls + trade mode backend sync
  - `lib/mock.ts` — Realistic simulation (OKX WS + sim ticks)
  - `lib/store.ts` — Zustand store (TradeMode, market data, signals)
  - `components/Shell.tsx` — Bottom nav + FAB + trade mode cycler (backend sync)
- `artifacts/api-server/src/` — Express API
  - `routes/auth.ts` — JWT login/me/seedAdmin
  - `routes/exchanges.ts` — Vault CRUD + CCXT test/balance
  - `routes/orders.ts` — Paper/live order placement
  - `routes/pnl.ts` — Snapshots + purge
  - `routes/strategies.ts` — Strategy CRUD with fallback
  - `routes/config.ts` — Trade mode + system config endpoint
  - `lib/ccxt-service.ts` — CCXT fetchTicker/fetchBalance/placeOrder/testConnection
  - `lib/ws-hub.ts` — OKX WS + sim ticks
  - `lib/vault.ts` — Exchange secret vault (never exposed to client)
  - `lib/seed.ts` — Default admin/exchange seed on startup
- `lib/db/src/schema/` — Drizzle ORM schemas (users, exchanges, orders, positions, pnl)
- `scripts/vps/` — VPS setup (Docker, Barter-rs, Nautilus Python)

## Architecture decisions

- **TradeMode backend sync**: Mode change in frontend → optimistic update → PATCH /api/config/trade-mode → backend persists → Nautilus/Barter-rs reads. Warning banner shown for full_auto + live mode.
- **Multi-agent market types**: Each agent has `market_types: MarketType[]` — SpotAnalyst=["spot"], PerpGuard=["perp","futures"], MarginScanner=["margin","spot"], PolyOracle=["polymarket"]. Configurable in Agents page edit modal.
- **Markets categorization**: 5 tabs — Spot (🔵), Perp (⚡), Futures (📅), Margin (⚖️), Polymarket (🎯). Each tab has count badge. Coin detail modal with sparkline, RSI bar, quick order.
- **Vault design**: ExchangeRecord stored server-side in Map, secrets never sent to client. safeRecord() strips api key fields.
- **Seed**: On first start, seeds admin user + 4 exchanges (Binance/Bybit/OKX/OKX-Paper). Gracefully skips if DB unavailable (mock fallback).
- **Plugin system**: GitHub repo URL → analyzes → suggests integration hooks → install. Built-in plugins: OKX WS Feed, CCXT Adapter, Barter-rs Risk, Nautilus, Telegram Bot.

## Product

- **Markets**: 5-tab layout (Spot/Perp/Futures/Margin/Polymarket), coin detail modal with chart + RSI + quick order, sort by price/change/volume/RSI, category filter (Major/DeFi/L2/Meme)
- **Agents**: 5 pre-configured agents each assigned to market types; editable market_types + exchange_ids; per-agent chat with LLM
- **Trade Modes**: Manuel (signals only) / Yarı Oto (Telegram approval required) / Tam Oto (direct execution). Cycled from header badge, synced to backend.
- **Plugins**: GitHub repo analyzer, hook integration (onTick/onSignal/beforeOrder/afterOrder), discover marketplace
- **VPS**: Barter-rs (Rust, Kelly risk engine) + Nautilus (Python, LangGraph + CCXT Pro) + PostgreSQL + Redis

## User preferences

- Turkish UI throughout
- Mobile-first design, bottom nav with center FAB
- No mock gaps — realistic simulation data at all times
- Backend-first architecture — all state eventually synced to server

## Gotchas

- API server requires `DATABASE_URL` but works fully without it (mock fallback everywhere)
- OKX WS connects automatically on startup (public channel, no API key needed)
- `protobufjs` must be installed for CCXT to bundle correctly (`pnpm --filter @workspace/api-server add protobufjs`)
- Seed runs after server.listen() — DB not ready error is normal (logged as WARN, not ERROR)
- Trade mode change: optimistic update first, backend sync after → no UI lag

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
