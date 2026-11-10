COMPOSE = docker compose --env-file .env

.PHONY: env master up down backup logs ps urls

env:
	@sh scripts/make-env.sh

master:
	@sh scripts/require-master.sh

up: master env
	$(COMPOSE) up --build -d --wait
	@$(MAKE) --no-print-directory urls
	@sh scripts/seed-swe.sh

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
