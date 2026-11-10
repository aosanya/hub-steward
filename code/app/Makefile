DEV_PORT ?= 5171
QA_PORT ?= 5181
QA_API ?= http://127.0.0.1:8183
APP_LOG ?= $(or $(TMPDIR),/tmp)/hubsteward-app/dev.log

.PHONY: run restart restartQA logs

run:
	@lsof -ti tcp:$(DEV_PORT) | xargs kill -9 2>/dev/null || true
	npx vite --port $(DEV_PORT) --strictPort

restart:
	DEV_PORT=$(DEV_PORT) APP_LOG=$(APP_LOG) ./scripts/restart-dev.sh

restartQA:
	@lsof -ti tcp:$(QA_PORT) | xargs kill -9 2>/dev/null || true
	HUBSTEWARD_WAKALA_URL=$(QA_API) npx vite build --outDir dist-qa --emptyOutDir
	npx vite preview --outDir dist-qa --host 127.0.0.1 --port $(QA_PORT) --strictPort

logs:
	tail -n 50 -f "$(APP_LOG)"
