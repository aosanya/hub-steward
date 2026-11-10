set -eu

until psql -qAt -c "select 1 from information_schema.schemata where schema_name = 'auth'" | grep -q 1; do
  sleep 2
done

for file in /migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "ALTER ROLE wakala_api PASSWORD :'password'" | psql -v ON_ERROR_STOP=1 -q -v password="$WAKALA_API_DB_PASSWORD"
