FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/nexus-trade-os/package.json ./artifacts/nexus-trade-os/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY tsconfig.base.json ./

RUN pnpm install --frozen-lockfile --filter @workspace/nexus-trade-os... 2>/dev/null || \
    pnpm install --filter @workspace/nexus-trade-os...

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY lib/ ./lib/
COPY artifacts/nexus-trade-os/ ./artifacts/nexus-trade-os/

# Build shared libs
RUN pnpm --filter @workspace/api-client-react build 2>/dev/null || true
RUN pnpm --filter @workspace/api-zod build 2>/dev/null || true

# Build frontend (static files)
ENV PORT=3000
ENV BASE_PATH=/
ENV NODE_ENV=production

RUN pnpm --filter @workspace/nexus-trade-os build

# ── Runtime: serve static with nginx ─────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=builder /app/artifacts/nexus-trade-os/dist/public /usr/share/nginx/html

# SPA routing — all routes → index.html
RUN printf 'server {\n\
  listen 3000;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location /healthz {\n\
    return 200 "ok";\n\
    add_header Content-Type text/plain;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
