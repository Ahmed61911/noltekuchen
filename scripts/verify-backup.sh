#!/usr/bin/env bash
# Proves a backup archive actually restores — without touching production.
# Restores the database dump into a throwaway, network-less Postgres
# container (same image as prod), using the same code path as restore.sh,
# then compares key row counts against the live database and the archive's
# storage file count against storage.objects. Removes the container after.
#
# Usage: scripts/verify-backup.sh [backups/backup-YYYYMMDD-HHMMSS.tar.gz]
#        (defaults to the newest archive)
# Exit code 0 = restorable and consistent, non-zero = do not trust it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a
export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml COMPOSE_IGNORE_ORPHANS=1
. "$ROOT/scripts/lib/restore-db.sh"

ARCHIVE="${1:-$(ls -1t backups/backup-*.tar.gz 2>/dev/null | head -1)}"
[[ -n "$ARCHIVE" && -f "$ARCHIVE" ]] || { echo "[verify] no backup archive found" >&2; exit 1; }
echo "[verify] archive: $ARCHIVE"

NAME="nolte-verify-backup-$$"
TMP="$(mktemp -d)"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

tar -xzf "$ARCHIVE" -C "$TMP" ./db.sql.gz
files_in_archive=$(tar -tzf "$ARCHIVE" | grep -c '^\./storage/.*[^/]$' || true)

IMAGE="$(docker compose config --images db 2>/dev/null | head -1)"
PW="$(openssl rand -hex 16)"
# Image defaults (superuser supabase_admin) so the image's own init creates
# the Supabase roles the dump references. --network none: it can reach
# nothing and nothing can reach it. Memory-capped: this host has no swap.
docker run -d --name "$NAME" --network none --memory 512m \
  -e POSTGRES_PASSWORD="$PW" -e POSTGRES_DB="$POSTGRES_DB" \
  -e JWT_SECRET="$(openssl rand -hex 20)" -e JWT_EXP=3600 \
  "$IMAGE" postgres -D /etc/postgresql >/dev/null

echo "[verify] waiting for throwaway database"
for _ in $(seq 90); do
  [[ "$(docker inspect -f '{{.State.Running}}' "$NAME")" == true ]] || { docker logs --tail 20 "$NAME" >&2; exit 1; }
  docker logs "$NAME" 2>&1 | grep -q 'PostgreSQL init process complete' \
    && docker exec "$NAME" pg_isready -q -U supabase_admin 2>/dev/null && break
  sleep 2
done

TEST_PSQL=(docker exec -i -e PGPASSWORD="$PW" "$NAME" psql -U supabase_admin -d "$POSTGRES_DB")
echo "[verify] restoring"
restore_db_dump "$TMP/db.sql.gz" "${TEST_PSQL[@]}"

COUNTS="select (select count(*) from auth.users)||' '||(select count(*) from storage.objects)||' '||(select count(*) from information_schema.tables where table_schema='public')"
read -r t_users t_objects t_tables < <("${TEST_PSQL[@]}" -tAc "$COUNTS")
read -r p_users p_objects p_tables < <(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$COUNTS")

echo "[verify]                 backup   live"
echo "[verify] auth.users      $t_users        $p_users"
echo "[verify] storage.objects $t_objects       $p_objects   (files in archive: $files_in_archive)"
echo "[verify] public tables   $t_tables       $p_tables"

fail=0
[[ "$t_tables" -gt 0 && "$t_users" -gt 0 ]] || { echo "[verify] FAIL: restored database is empty" >&2; fail=1; }
[[ "$t_tables" -eq "$p_tables" ]] || { echo "[verify] WARN: table count differs from live (schema changed since backup?)" >&2; }
[[ "$files_in_archive" -ge "$t_objects" ]] || { echo "[verify] FAIL: archive has fewer storage files than storage.objects rows" >&2; fail=1; }

[[ $fail -eq 0 ]] && echo "[verify] PASS" || echo "[verify] FAIL" >&2
exit $fail
