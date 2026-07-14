#!/usr/bin/env bash
# Apply any *.sql in database/migrations/ that haven't been applied yet.
# Tracks applied files in public._schema_migrations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a

PSQL="docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB"

$PSQL -c "CREATE TABLE IF NOT EXISTS public._schema_migrations (filename text primary key, applied_at timestamptz default now());"

for f in database/migrations/*.sql; do
  name=$(basename "$f")
  applied=$($PSQL -tAc "SELECT 1 FROM public._schema_migrations WHERE filename='$name'")
  if [[ "$applied" == "1" ]]; then
    echo "  skip $name"
    continue
  fi
  echo "  apply $name"
  $PSQL < "$f"
  $PSQL -c "INSERT INTO public._schema_migrations(filename) VALUES ('$name');"
done
echo "[migrate] done."
