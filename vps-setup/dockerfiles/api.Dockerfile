FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY ../../package.json ../../pnpm-workspace.yaml ../../pnpm-lock.yaml ../../tsconfig.base.json ../../tsconfig.json ./
COPY ../../lib ./lib
COPY . ./artifacts/api-server

# Install all deps
RUN pnpm install --frozen-lockfile

# Build
RUN cd artifacts/api-server && pnpm run build

# ── Production image ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache wget curl tini

WORKDIR /app

# Copy built output
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-server/package.json ./package.json

# Install only production deps
RUN npm install --omit=dev --ignore-scripts 2>/dev/null || true

# Non-root user
RUN addgroup -g 1001 -S nexus && adduser -S nexus -u 1001
RUN mkdir -p /app/logs && chown -R nexus:nexus /app
USER nexus

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
