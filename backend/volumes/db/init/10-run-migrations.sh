#!/usr/bin/env bash
# First-boot migration runner.
# Applies every *.sql file in /migrations in sorted order and records each
# filename in public._schema_migrations so scripts/migrate.sh won't reapply
# them later.
#
# This script only runs when the pg_data volume is empty (docker-entrypoint
# initdb phase). Subsequent schema changes go through scripts/migrate.sh.
set -euo pipefail

MIG_DIR=/migrations
if [ ! -d "$MIG_DIR" ]; then
  echo "[init] no /migrations mount, skipping"
  exit 0
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL=(psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}")

"${PSQL[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS public._schema_migrations (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
for f in "$MIG_DIR"/*.sql; do
  name="$(basename "$f")"
  applied="$( "${PSQL[@]}" -tAc "SELECT 1 FROM public._schema_migrations WHERE filename='${name}'" )"
  if [ "$applied" = "1" ]; then
    echo "[init] skip ${name}"
    continue
  fi
  echo "[init] apply ${name}"
  "${PSQL[@]}" -f "$f"
  "${PSQL[@]}" -c "INSERT INTO public._schema_migrations(filename) VALUES ('${name}');"
done

echo "[init] migrations complete"
