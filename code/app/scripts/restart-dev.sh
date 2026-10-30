#!/bin/sh
set -eu

port="${DEV_PORT:-5171}"
log="${APP_LOG:-${TMPDIR:-/tmp}/hubsteward-app/dev.log}"
patience="${APP_START_SECONDS:-30}"
pidfile="$(dirname "$log")/dev.pid"

listeners() {
	lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null || true
}

mkdir -p "$(dirname "$log")"

old=$(listeners)
if [ -n "$old" ]; then
	kill $old
	waited=0
	while [ -n "$(listeners)" ] && [ "$waited" -lt 20 ]; do
		sleep 0.5
		waited=$((waited + 1))
	done
	[ -z "$(listeners)" ] || kill -9 $(listeners)
fi

nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' npx vite --port "$port" --strictPort >"$log" 2>&1 &
starter=$!
printf '%s\n' "$starter" >"$pidfile"

tail -n +1 -f "$log" &
tailer=$!
trap 'sleep 1; kill $tailer 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM

elapsed=0
while [ "$elapsed" -lt "$patience" ]; do
	if ! kill -0 "$starter" 2>/dev/null; then
		echo "app stopped while starting, see the log above ($log)" >&2
		exit 1
	fi
	code=$(curl -s -o /dev/null -m 3 -w "%{http_code}" "http://localhost:$port/" 2>/dev/null || true)
	if [ -n "$code" ] && [ "$code" != "000" ]; then
		echo "app up on :$port (pid $(listeners | head -n 1)), streaming $log; Ctrl-C stops the stream, not the server"
		wait "$tailer"
		exit 0
	fi
	sleep 1
	elapsed=$((elapsed + 1))
done

echo "app did not answer on :$port within ${patience}s, see the log above ($log)" >&2
exit 1
