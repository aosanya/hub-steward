PORT ?= 8082

.PHONY: restart

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
