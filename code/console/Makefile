DEV_PORT ?= 5170
CONSOLE_LOG ?= $(or $(TMPDIR),/tmp)/hubsteward-console/dev.log

.PHONY: run restart logs

run:
	@lsof -ti tcp:$(DEV_PORT) | xargs kill -9 2>/dev/null || true
	npx vite --port $(DEV_PORT) --strictPort

restart:
	DEV_PORT=$(DEV_PORT) CONSOLE_LOG=$(CONSOLE_LOG) ./scripts/restart-dev.sh

logs:
	tail -n 50 -f "$(CONSOLE_LOG)"
