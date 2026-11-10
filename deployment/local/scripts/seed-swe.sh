set -eu

cd "$(dirname "$0")/.."

. ./.env

file=${SWE_AGENCY_FILE:-../../../hub-steward-swe/agency/agency.json}
loader=${SWE_LOADER_DIR:-../../../hub-steward-swe/loader}
boards_root=${BOARDS_ROOT:-../../../..}
api=${SEED_API_URL:-http://localhost:${API_PORT:-8092}}

if [ ! -f "$file" ] || [ ! -d "$loader" ]; then
  echo "SWE hub skipped: the hub-steward-swe repo is not next to this one"
  exit 0
fi

boards_root=$(cd "$boards_root" && pwd)

if [ -z "${OWNER_EMAIL:-}" ] || [ -z "${OWNER_PASSWORD:-}" ]; then
  echo "SWE hub skipped: set OWNER_EMAIL and OWNER_PASSWORD in .env"
  exit 0
fi

if ! command -v go >/dev/null || ! command -v jq >/dev/null; then
  echo "SWE hub skipped: go and jq are needed"
  exit 0
fi

jar=$(mktemp)
key_id=
revoke_key() {
  if [ -n "$key_id" ]; then
    curl -sS -o /dev/null -b "$jar" -X DELETE "$api/auth/api-keys/$key_id" || true
  fi
  rm -f "$jar"
}
trap revoke_key EXIT

call() { curl -fsS -b "$jar" -H 'content-type: application/json' "$@"; }

login=$(jq -n --arg email "$OWNER_EMAIL" --arg password "$OWNER_PASSWORD" '{email: $email, password: $password}')

curl -sS -o /dev/null -X POST "$api/auth/credentials" \
  -H 'content-type: application/json' -H "X-Admin-Token: $WAKALA_ADMIN_TOKEN" -d "$login"

curl -fsS -o /dev/null -c "$jar" -X POST "$api/auth/signin" \
  -H 'content-type: application/json' -d "$login"

name=$(jq -r '.agency.name' "$file")
instance=$(call "$api/instances" | jq -r --arg name "$name" '[.[] | select(.name == $name)][0].id // empty')

if [ -n "$instance" ]; then
  echo "hub already there: $name"
else
  imported=$(call -X POST "$api/instances/import" --data-binary "@$file")
  instance=$(echo "$imported" | jq -r '.instance.id')
  draft=$(echo "$imported" | jq -r '.draft_id')
  call -o /dev/null -X POST "$api/instances/$instance/publications" \
    -d "$(jq -n --arg draft "$draft" '{draft_id: $draft, tag: "v1", channel: "production"}')"
  echo "hub created: $name, owned by $OWNER_EMAIL"
fi

key=$(call -X POST "$api/auth/api-keys" -d '{"name":"loader"}')
key_id=$(echo "$key" | jq -r '.id')

(
  cd "$loader"
  HUBSTEWARD_URL="$api" HUBSTEWARD_INSTANCE="$instance" HUBSTEWARD_TOKEN=$(echo "$key" | jq -r '.token') \
    go run ./cmd/loadboards --root "$boards_root"
)
