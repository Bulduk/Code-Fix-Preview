FROM node:22-alpine AS base
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY tsconfig.base.json ./

RUN pnpm install --frozen-lockfile --filter @workspace/api-server... 2>/dev/null || \
    pnpm install --filter @workspace/api-server...

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Build shared libs first
RUN pnpm --filter @workspace/db build 2>/dev/null || true
RUN pnpm --filter @workspace/api-zod build 2>/dev/null || true

# Build api-server
RUN pnpm --filter @workspace/api-server build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN addgroup -S nexus && adduser -S nexus -G nexus

# Copy built output
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-server/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server/package.json ./

# Copy workspace node_modules for shared packages
COPY --from=builder /app/node_modules ./workspace_node_modules
COPY --from=builder /app/lib ./lib

USER nexus

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
