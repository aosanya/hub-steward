PORT ?= 8082
QA_PORT ?= 8183
QA_DIR ?= /tmp/hubsteward-qa

.PHONY: restart restartQA

restart:
	@pids=$$(lsof -ti tcp:$(PORT) -sTCP:LISTEN); \
	if [ -n "$$pids" ]; then kill $$pids; fi; \
	for i in 1 2 3 4 5 6 7 8 9 10; do \
		lsof -ti tcp:$(PORT) -sTCP:LISTEN >/dev/null || break; \
		sleep 1; \
	done; \
	pids=$$(lsof -ti tcp:$(PORT) -sTCP:LISTEN); \
	if [ -n "$$pids" ]; then kill -9 $$pids; sleep 1; fi
	WAKALA_REQUEST_LOG=true PORT=$(PORT) go run ./cmd/server

restartQA:
	@pids=$$(lsof -ti tcp:$(QA_PORT) -sTCP:LISTEN); \
	if [ -n "$$pids" ]; then kill $$pids; fi; \
	for i in 1 2 3 4 5 6 7 8 9 10; do \
		lsof -ti tcp:$(QA_PORT) -sTCP:LISTEN >/dev/null || break; \
		sleep 1; \
	done; \
	pids=$$(lsof -ti tcp:$(QA_PORT) -sTCP:LISTEN); \
	if [ -n "$$pids" ]; then kill -9 $$pids; sleep 1; fi
	env -i PATH="$$PATH" HOME="$$HOME" \
		PORT=$(QA_PORT) \
		WAKALA_REQUEST_LOG=true \
		WAKALA_SQLITE_PATH=$(QA_DIR)/hub.db \
		WAKALA_ADMIN_TOKEN=local-admin-token \
		WAKALA_SESSION_SECRET=local-only-session-secret-change-before-sharing \
		AI_MASTER_KEY=local-only-master-key-change-me0 \
		STUDIO_ORIGINS=http://localhost:5180,http://127.0.0.1:5180,http://localhost:5173,http://127.0.0.1:5173 \
		MEMBER_APP_ORIGINS=http://localhost:5181,http://127.0.0.1:5181,http://localhost:5174,http://127.0.0.1:5174 \
		go run ./cmd/server
