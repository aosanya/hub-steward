set -eu

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  exit 0
fi

secret() { openssl rand -hex "$1"; }
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

jwt() {
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  now=$(date +%s)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$now" "$((now + 315360000))" | b64url)
  signature=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)
  printf '%s.%s.%s' "$header" "$payload" "$signature"
}

JWT_SECRET=$(secret 32)

{
  cat .env.example
  echo "POSTGRES_PASSWORD=$(secret 16)"
  echo "WAKALA_API_DB_PASSWORD=$(secret 16)"
  echo "JWT_SECRET=$JWT_SECRET"
  echo "ANON_KEY=$(jwt anon)"
  echo "WAKALA_SESSION_SECRET=$(secret 32)"
  echo "WAKALA_ADMIN_TOKEN=$(secret 16)"
  echo "AI_MASTER_KEY=$(secret 16)"
} > .env
