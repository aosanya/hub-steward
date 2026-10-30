DEV_PORT ?= 5171
APP_LOG ?= $(or $(TMPDIR),/tmp)/hubsteward-app/dev.log

.PHONY: run restart logs

run:
	@lsof -ti tcp:$(DEV_PORT) | xargs kill -9 2>/dev/null || true
	npx vite --port $(DEV_PORT) --strictPort

restart:
	DEV_PORT=$(DEV_PORT) APP_LOG=$(APP_LOG) ./scripts/restart-dev.sh

logs:
	tail -n 50 -f "$(APP_LOG)"
