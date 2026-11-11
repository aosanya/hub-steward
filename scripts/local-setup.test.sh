set -eu

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
port=${FAKE_API_PORT:-18082}
server_pid=

stop_server() {
  if [ -n "$server_pid" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$work"
}
trap stop_server EXIT

python3 "$here/fake-api.py" "$port" &
server_pid=$!

tries=0
until curl -s -o /dev/null "http://127.0.0.1:$port/instances"; do
  tries=$((tries + 1))
  [ "$tries" -lt 50 ] || { echo "fake API did not start" >&2; exit 1; }
  sleep 0.1
done

run() {
  API_URL="http://127.0.0.1:$port" \
  WAKALA_ADMIN_TOKEN=test-admin-token \
  LOCAL_EMAIL=judge@example.com \
  LOCAL_PASSWORD='a password of twelve or more' \
  CONSOLE_URL=http://localhost:3000 \
  sh "$here/local-setup.sh" "$@"
}

fail() { echo "FAIL: $*" >&2; exit 1; }

first=$(run --demos)
second=$(run --demos)

demo_count=$(ls "$here"/../demo/*/agency.json "$here"/../demo/*.json | wc -l | tr -d ' ')
imported_first=$(printf '%s\n' "$first" | grep -c '^imported demo hub: ')
already_second=$(printf '%s\n' "$second" | grep -c '^demo hub already there: ')

printf '%s\n' "$first" | grep -q '^made the console login judge@example.com$' || fail "first run did not make the login"
printf '%s\n' "$first" | grep -q '^registered the hub-steward service$' || fail "first run did not register the service"
printf '%s\n' "$first" | grep -q "^imported demo hub: Siaya Community Computer Lab$" || fail "first run did not import the Siaya lab"
printf '%s\n' "$first" | grep -q "^imported demo hub: Siaya Farmers' Group$" || fail "first run did not import the farmers"
[ "$imported_first" -eq "$demo_count" ] || fail "first run imported $imported_first of $demo_count demo files"
printf '%s\n' "$second" | grep -q '^console login already there: judge@example.com$' || fail "second run did not find the login"
[ "$already_second" -eq "$demo_count" ] || fail "second run found $already_second of $demo_count hubs already there"
printf '%s\n' "$second" | grep -q '^service hub-steward already registered$' || fail "second run registered the service again"
printf '%s\n' "$first$second" | grep -q 'never-printed' && fail "a token was printed"
printf '%s\n' "$second" | grep -q '^imported demo hub: ' && fail "second run imported again"
printf '%s\n' "$second" | grep -q '^console: http://localhost:3000  log in with judge@example.com' || fail "no console line"

invited=$(run --invite=member@example.com)
printf '%s\n' "$invited" | grep -q '^invited member@example.com' || fail "invite line missing"

if sh "$here/local-setup.sh" --nonsense >/dev/null 2>&1; then fail "an unknown option was accepted"; fi
if env -u LOCAL_PASSWORD WAKALA_ADMIN_TOKEN=x LOCAL_EMAIL=a@b.c sh "$here/local-setup.sh" --demos >/dev/null 2>&1; then fail "a missing password was accepted"; fi

echo "local-setup: ok ($demo_count demo files)"
