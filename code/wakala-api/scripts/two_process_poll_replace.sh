#!/usr/bin/env bash
set -euo pipefail

free_ports() {
	for port in $(seq 55920 55929 | sort -R); do
		if ! lsof -ti "tcp:$port" -sTCP:LISTEN >/dev/null; then echo "$port"; fi
	done
}

PORTS=($(free_ports))
PG_PORT="${PG_PORT:-${PORTS[0]}}"
API_PORT_A="${API_PORT_A:-${PORTS[1]}}"
API_PORT_B="${API_PORT_B:-${PORTS[2]}}"
ROUNDS_COUNT="${ROUNDS_COUNT:-1}"
WORK="$(mktemp -d)"
SECRET="test-secret"

cleanup() {
	for pid in ${API_A_PID:-} ${API_B_PID:-}; do kill "$pid" 2>/dev/null || true; done
	pg_ctl -D "$WORK/pg" -m immediate stop >/dev/null 2>&1 || true
	rm -rf "$WORK"
}
trap cleanup EXIT

initdb -D "$WORK/pg" -U postgres --auth=trust --locale=C --encoding=UTF8 >/dev/null
pg_ctl -D "$WORK/pg" -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories= -c max_connections=200" -l "$WORK/pg.log" -w start >/dev/null
createdb -h 127.0.0.1 -p "$PG_PORT" -U postgres twoprocess

export DATABASE_URL="postgres://postgres@127.0.0.1:$PG_PORT/twoprocess?sslmode=disable"
go build -o "$WORK/server" ./cmd/server

start_api() {
	env -i PATH="$PATH" HOME="$HOME" DATABASE_URL="$DATABASE_URL" PORT="$1" \
		WAKALA_SESSION_SECRET="$SECRET" WAKALA_ADMIN_TOKEN=two-process-admin \
		AI_MASTER_KEY=two-process-master-key-000000000 \
		"$WORK/server" >"$WORK/api-$1.log" 2>&1 &
	echo $!
}

wait_up() {
	for _ in $(seq 1 60); do
		if curl -s -o /dev/null "http://127.0.0.1:$1/healthz" || curl -s -o /dev/null "http://127.0.0.1:$1/"; then return 0; fi
		sleep 1
	done
	echo "api on $1 did not start" >&2
	tail -20 "$WORK/api-$1.log" >&2
	return 1
}

API_A_PID=$(start_api "$API_PORT_A")
wait_up "$API_PORT_A"
API_B_PID=$(start_api "$API_PORT_B")
wait_up "$API_PORT_B"

export WAKALA_TWO_API_A="http://127.0.0.1:$API_PORT_A"
export WAKALA_TWO_API_B="http://127.0.0.1:$API_PORT_B"
go test ./internal/api/http/ -run TestTwoAPIProcessesReplacingOneAnswerLeaveOneBallotOnPostgres -count="$ROUNDS_COUNT" -v
