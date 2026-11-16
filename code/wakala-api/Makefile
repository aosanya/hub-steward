PORT ?= 8082
QA_PORT ?= 8183
QA_DIR ?= /tmp/hubsteward-qa
GIT_FOLDER ?= /Users/tony/Agents/workdir/CodeVald-AIProject/mwanachama/git-repositories

-include .env.qa

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
	GIT_REPOSITORY_FOLDER=$(GIT_FOLDER) WAKALA_REQUEST_LOG=true PORT=$(PORT) go run ./cmd/server

restartQA:
	@test -n "$(WAKALA_ADMIN_TOKEN)" -a -n "$(WAKALA_SESSION_SECRET)" -a -n "$(AI_MASTER_KEY)" || { echo "restartQA needs WAKALA_ADMIN_TOKEN, WAKALA_SESSION_SECRET and AI_MASTER_KEY in .env.qa (copy .env.qa.example)"; exit 1; }
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
		GIT_REPOSITORY_FOLDER=$(QA_DIR)/git-repositories \
		WAKALA_ADMIN_TOKEN=$(WAKALA_ADMIN_TOKEN) \
		WAKALA_SESSION_SECRET=$(WAKALA_SESSION_SECRET) \
		AI_MASTER_KEY=$(AI_MASTER_KEY) \
		STUDIO_ORIGINS=http://localhost:5180,http://127.0.0.1:5180,http://localhost:5181,http://127.0.0.1:5181,http://localhost:5173,http://127.0.0.1:5173 \
		MEMBER_APP_ORIGINS=http://localhost:5174,http://127.0.0.1:5174 \
		go run ./cmd/server
