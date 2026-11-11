set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
demo_dir=${DEMO_DIR:-$root/demo}
api=${API_URL:-http://127.0.0.1:8082}
console=${CONSOLE_URL:-http://localhost:3000}

demos=
invite=

for arg in "$@"; do
  case "$arg" in
    --demos) demos=1 ;;
    --invite=*) invite=${arg#--invite=} ;;
    *) echo "unknown option: $arg" >&2; echo "usage: sh scripts/local-setup.sh [--demos] [--invite=<email>]" >&2; exit 2 ;;
  esac
done

if [ -z "$demos" ] && [ -z "$invite" ]; then
  echo "usage: sh scripts/local-setup.sh [--demos] [--invite=<email>]" >&2
  exit 2
fi

for name in WAKALA_ADMIN_TOKEN LOCAL_EMAIL LOCAL_PASSWORD; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "$name is not set" >&2
    exit 2
  fi
done

for tool in curl jq; do
  command -v "$tool" >/dev/null || { echo "$tool is needed" >&2; exit 2; }
done

jar=$(mktemp)
trap 'rm -f "$jar"' EXIT

login=$(jq -n --arg email "$LOCAL_EMAIL" --arg password "$LOCAL_PASSWORD" '{email: $email, password: $password}')

status_of() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }

make_login() {
  code=$(status_of -X POST "$api/auth/credentials" \
    -H 'content-type: application/json' -H "X-Admin-Token: $WAKALA_ADMIN_TOKEN" -d "$login")
  case "$code" in
    201) echo "made the console login $LOCAL_EMAIL" ;;
    409) echo "console login already there: $LOCAL_EMAIL" ;;
    *) echo "could not make the console login: the API answered $code" >&2; exit 1 ;;
  esac
}

sign_in() {
  code=$(status_of -c "$jar" -X POST "$api/auth/signin" -H 'content-type: application/json' -d "$login")
  if [ "$code" != 201 ] && [ "$code" != 200 ]; then
    echo "could not sign in as $LOCAL_EMAIL: the API answered $code" >&2
    exit 1
  fi
}

register_service() {
  if curl -fsS -b "$jar" "$api/services" | jq -e 'any(.[]; .service == "hub-steward")' >/dev/null; then
    echo "service hub-steward already registered"
    return
  fi
  code=$(status_of -X POST "$api/auth/service-keys" \
    -H 'content-type: application/json' -H "X-Admin-Token: $WAKALA_ADMIN_TOKEN" \
    -d '{"service":"hub-steward","name":"local console"}')
  if [ "$code" != 201 ]; then
    echo "could not register the hub-steward service: the API answered $code" >&2
    exit 1
  fi
  echo "registered the hub-steward service"
}

hub_names() { curl -fsS -b "$jar" "$api/instances" | jq -r '.[].name'; }

import_demos() {
  existing=$(hub_names)
  for file in "$demo_dir"/*/agency.json "$demo_dir"/*.json; do
    [ -f "$file" ] || continue
    name=$(jq -r '.name // .agency.name // empty' "$file")
    [ -n "$name" ] || continue
    if printf '%s\n' "$existing" | grep -Fxq -- "$name"; then
      echo "demo hub already there: $name"
      continue
    fi
    code=$(status_of -b "$jar" -X POST "$api/instances/import" -H 'content-type: application/json' --data-binary "@$file")
    if [ "$code" != 201 ]; then
      echo "could not import $name: the API answered $code" >&2
      exit 1
    fi
    existing=$(printf '%s\n%s' "$existing" "$name")
    echo "imported demo hub: $name"
  done
}

invite_member() {
  hub=$(curl -fsS -b "$jar" "$api/instances" | jq -r '.[0].id // empty')
  if [ -z "$hub" ]; then
    echo "no hub to invite $invite to: run with --demos first" >&2
    exit 1
  fi
  code=$(status_of -b "$jar" -X POST "$api/instances/$hub/invitations" \
    -H 'content-type: application/json' -d "$(jq -n --arg email "$invite" '{email: $email}')")
  if [ "$code" != 202 ]; then
    echo "could not invite $invite: the API answered $code" >&2
    exit 1
  fi
  echo "invited $invite: read the email in the inbox at http://127.0.0.1:54324"
}

make_login
sign_in
[ -z "$demos" ] || { register_service; import_demos; }
[ -z "$invite" ] || invite_member
echo "console: $console  log in with $LOCAL_EMAIL and the password you set"
