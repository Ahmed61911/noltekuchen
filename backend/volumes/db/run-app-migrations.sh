#!/usr/bin/env bash
# Applies database/migrations/*.sql over the network, run by the one-shot
# `db-migrate` compose service once the `auth` (GoTrue) service is healthy.
#
# Most of our migrations have foreign keys into auth.users, so they cannot
# run during Postgres's own docker-entrypoint-initdb.d phase — that phase
# executes during the `db` container's first boot, before the `auth`
# container even starts and creates auth.users via its own migrations.
# (Confirmed by testing: every migration referencing auth.users failed with
# "relation auth.users does not exist" when run from docker-entrypoint-initdb.d
# on a fresh volume.)
#
# Mirrors scripts/migrate.sh, but connects directly over the compose network
# (`psql -h db`) instead of via `docker compose exec` — there's no docker
# socket available inside this container.
set -euo pipefail

export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL=(psql -v ON_ERROR_STOP=1 -h db -U "${POSTGRES_USER}" -d "${POSTGRES_DB}")

"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS public._schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

shopt -s nullglob
for f in /migrations/*.sql; do
  name="$(basename "$f")"
  applied="$("${PSQL[@]}" -tAc "SELECT 1 FROM public._schema_migrations WHERE filename='${name}'")"
  if [ "$applied" = "1" ]; then
    echo "[migrate] skip ${name}"
    continue
  fi
  echo "[migrate] apply ${name}"
  "${PSQL[@]}" -f "$f"
  "${PSQL[@]}" -c "INSERT INTO public._schema_migrations(filename) VALUES ('${name}');"
done

echo "[migrate] done"
