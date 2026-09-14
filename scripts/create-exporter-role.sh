#!/usr/bin/env bash
# Creates (or re-syncs the password of) the read-only `nolte_exporter` role
# that postgres-exporter in docker-compose.monitoring.yml connects as.
# Membership in pg_monitor grants exactly the stats views the exporter reads
# (pg_stat_*, pg_settings, replication/wal info) — no table data, no DDL.
#
# Idempotent — re-run after changing POSTGRES_EXPORTER_PASSWORD in .env.
# Usage: scripts/create-exporter-role.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a
export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml

: "${POSTGRES_EXPORTER_PASSWORD:?set POSTGRES_EXPORTER_PASSWORD in .env (openssl rand -hex 32)}"

# Same psql-variable technique as backend/volumes/db/init/00-roles.sh: the
# password is substituted by psql's :'var' quoting at top level, never
# interpolated into the SQL by the shell.
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v pgpass="$POSTGRES_EXPORTER_PASSWORD" -v pgdb="$POSTGRES_DB" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nolte_exporter') THEN
    CREATE ROLE nolte_exporter LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;
ALTER ROLE nolte_exporter WITH LOGIN PASSWORD :'pgpass' CONNECTION LIMIT 5;
GRANT pg_monitor TO nolte_exporter;
GRANT CONNECT ON DATABASE :"pgdb" TO nolte_exporter;
SQL

echo "[create-exporter-role] nolte_exporter ready"
