DEV_PORT ?= 5170
QA_PORT ?= 5180
QA_API ?= http://127.0.0.1:8183
CONSOLE_LOG ?= $(or $(TMPDIR),/tmp)/hubsteward-console/dev.log

.PHONY: run restart restartQA logs

run:
	@lsof -ti tcp:$(DEV_PORT) | xargs kill -9 2>/dev/null || true
	npx vite --port $(DEV_PORT) --strictPort

restart:
	DEV_PORT=$(DEV_PORT) CONSOLE_LOG=$(CONSOLE_LOG) ./scripts/restart-dev.sh

restartQA:
	WAKALA_URL=$(QA_API) DEV_PORT=$(QA_PORT) CONSOLE_LOG=$(or $(TMPDIR),/tmp)/hubsteward-console-qa/dev.log ./scripts/restart-dev.sh

logs:
	tail -n 50 -f "$(CONSOLE_LOG)"
