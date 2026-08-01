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

# PostgREST caches the schema and only refreshes on this NOTIFY (or a restart,
# which the deploy does not do — it restarts `app` only). Without it, any
# migration that adds a column or function is invisible to the API: new
# functions 404 with PGRST202 and new columns are rejected, even though the
# migration applied cleanly. Confirmed the hard way with create_sale.
$PSQL -c "NOTIFY pgrst, 'reload schema';"
echo "[migrate] done."
