COMPOSE = docker compose --env-file .env

.PHONY: env master up down reset logs ps urls

env:
	@sh scripts/make-env.sh

master:
	@sh scripts/require-master.sh

up: master env
	$(COMPOSE) up --build -d --wait
	@$(MAKE) --no-print-directory urls

down:
	$(COMPOSE) down

reset:
	$(COMPOSE) down -v

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
