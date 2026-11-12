COMPOSE = docker compose --env-file .env

.PHONY: env master unstick up api down backup logs ps urls

env:
	@sh scripts/make-env.sh

master:
	@sh scripts/require-master.sh

up: master env
	$(COMPOSE) up --build -d --wait
	@$(MAKE) --no-print-directory urls

unstick:
	@ps -axo pid=,stat=,command= | awk '$$2 ~ /^T/ && /docker.*compose|buildx bake/ {print $$1}' | xargs kill -9 2>/dev/null; true

api: env unstick
	$(COMPOSE) build wakala-api
	$(COMPOSE) up -d --no-deps --no-build --wait --wait-timeout 120 wakala-api

down:
	$(COMPOSE) down

backup:
	@mkdir -p backups && chmod 700 backups
	@file=backups/hubsteward-$$(date +%Y%m%d-%H%M%S).sql; \
	$(COMPOSE) exec -T db pg_dump -U postgres postgres > $$file && gzip $$file || { rm -f $$file $$file.gz; exit 1; }; \
	echo "backup written: $$file.gz"

logs:
	$(COMPOSE) logs -f --tail=100

ps:
	$(COMPOSE) ps

urls:
	@. ./.env; \
	echo "console  http://localhost:$$CONSOLE_PORT"; \
	echo "app      http://localhost:$$APP_PORT"; \
	echo "api      http://localhost:$$API_PORT"; \
	echo "inbox    http://localhost:$$INBOX_PORT"; \
	echo "admin token  $$WAKALA_ADMIN_TOKEN"
