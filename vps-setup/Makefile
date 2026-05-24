# ─────────────────────────────────────────────────────────────────────────────
# Nexus Trade OS — VPS Yönetim Komutları
# Kullanım: make <komut>
# ─────────────────────────────────────────────────────────────────────────────

COMPOSE = docker compose -f vps-setup/docker-compose.yml
ENV     = --env-file /opt/nexus/.env

.PHONY: up down restart logs ps build pull update ssl-renew backup clean

## Servisleri başlat (temel: postgres + redis + api + frontend + nginx)
up:
	$(COMPOSE) $(ENV) up -d

## Servisleri durdur
down:
	$(COMPOSE) $(ENV) down

## Yeniden başlat
restart:
	$(COMPOSE) $(ENV) restart

## Tüm logları izle
logs:
	$(COMPOSE) $(ENV) logs -f

## API server logları
logs-api:
	$(COMPOSE) $(ENV) logs -f api

## Frontend logları
logs-frontend:
	$(COMPOSE) $(ENV) logs -f frontend

## Nginx logları
logs-nginx:
	$(COMPOSE) $(ENV) logs -f nginx

## Servis durumu
ps:
	$(COMPOSE) $(ENV) ps

## Yeniden build et ve başlat
build:
	$(COMPOSE) $(ENV) up -d --build

## Tam stack (barter + nautilus dahil)
up-full:
	$(COMPOSE) $(ENV) --profile full up -d --build

## Güncelle (git pull + rebuild)
update:
	git pull
	$(COMPOSE) $(ENV) up -d --build --remove-orphans

## SSL sertifikasını yenile
ssl-renew:
	certbot renew --quiet
	$(COMPOSE) $(ENV) restart nginx

## PostgreSQL yedeği al
backup:
	@mkdir -p /opt/nexus/backups
	$(COMPOSE) $(ENV) exec -T postgres pg_dump -U nexus nexusdb | \
	  gzip > /opt/nexus/backups/nexusdb_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Yedek alındı: /opt/nexus/backups/"

## DB migration çalıştır
migrate:
	$(COMPOSE) $(ENV) exec api node -e "import('./dist/index.mjs').then(m => m.migrate?.())" || \
	  echo "Migration: drizzle-kit push kullanın"

## Temizle (volumes dahil — DİKKAT: veri silinir!)
clean:
	@echo "UYARI: Tüm veriler silinecek! Devam etmek için ENTER'a basın..."
	@read confirm
	$(COMPOSE) $(ENV) down -v --remove-orphans

## Yardım
help:
	@echo ""
	@echo "Nexus Trade OS — Komutlar:"
	@echo "  make up          Servisleri başlat"
	@echo "  make down        Servisleri durdur"
	@echo "  make restart     Yeniden başlat"
	@echo "  make logs        Tüm logları izle"
	@echo "  make logs-api    API logları"
	@echo "  make build       Yeniden build + başlat"
	@echo "  make up-full     Barter + Nautilus dahil tam stack"
	@echo "  make update      git pull + rebuild"
	@echo "  make ssl-renew   SSL sertifikasını yenile"
	@echo "  make backup      PostgreSQL yedeği al"
	@echo "  make ps          Servis durumu"
	@echo ""
