FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace
COPY ../../package.json ../../pnpm-workspace.yaml ../../pnpm-lock.yaml ../../tsconfig.base.json ../../tsconfig.json ./
COPY ../../lib ./lib
COPY . ./artifacts/nexus-trade-os

RUN pnpm install --frozen-lockfile

# Build frontend
RUN cd artifacts/nexus-trade-os && \
    PORT=3000 BASE_PATH=/ pnpm run build

# ── Nginx static server ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/artifacts/nexus-trade-os/dist/public /usr/share/nginx/html

# SPA routing config
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /health {
        access_log off;
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
EOF

EXPOSE 80
