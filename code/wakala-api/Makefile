PORT ?= 8082

.PHONY: restart

restart:
	@lsof -ti tcp:$(PORT) -sTCP:LISTEN | xargs kill 2>/dev/null || true
	@sleep 1
	PORT=$(PORT) go run ./cmd/server
