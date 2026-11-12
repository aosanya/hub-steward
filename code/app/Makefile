DEV_PORT ?= 5171
QA_PORT ?= 5181
QA_API ?= http://127.0.0.1:8183
STAGING_PORT ?= 5191
STAGING_API ?= http://localhost:8092
APP_LOG ?= $(or $(TMPDIR),/tmp)/hubsteward-app/dev.log

MUNICIPALITY_PORT ?= 5192
MUNICIPALITY_API ?= http://127.0.0.1:8092
MUNICIPALITY_NAME ?= Zöldhalom

.PHONY: run restart restartQA runStaging runMunicipality logs

run:
	@lsof -ti tcp:$(DEV_PORT) | xargs kill -9 2>/dev/null || true
	npx vite --port $(DEV_PORT) --strictPort

restart:
	DEV_PORT=$(DEV_PORT) APP_LOG=$(APP_LOG) ./scripts/restart-dev.sh

restartQA:
	@lsof -ti tcp:$(QA_PORT) | xargs kill -9 2>/dev/null || true
	HUBSTEWARD_WAKALA_URL=$(QA_API) npx vite build --outDir dist-qa --emptyOutDir
	npx vite preview --outDir dist-qa --host 127.0.0.1 --port $(QA_PORT) --strictPort

runStaging:
	@lsof -ti tcp:$(STAGING_PORT) | xargs kill -9 2>/dev/null || true
	HUBSTEWARD_WAKALA_URL=$(STAGING_API) npx vite --host 127.0.0.1 --port $(STAGING_PORT) --strictPort

runMunicipality:
	@lsof -ti tcp:$(MUNICIPALITY_PORT) | xargs kill -9 2>/dev/null || true
	HUBSTEWARD_PROXY_TO=$(MUNICIPALITY_API) HUBSTEWARD_ONLY_AGENCY="$(MUNICIPALITY_NAME)" npx vite --host 127.0.0.1 --port $(MUNICIPALITY_PORT) --strictPort

logs:
	tail -n 50 -f "$(APP_LOG)"
