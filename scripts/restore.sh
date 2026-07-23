#!/usr/bin/env bash
# Restore from a backup tarball produced by backup.sh.
# Usage: scripts/restore.sh backups/backup-YYYYMMDD-HHMMSS.tar.gz
#
# DESTRUCTIVE: drops and recreates every table/schema the dump contains
# (public + auth + storage) before restoring. Confirms interactively.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a

ARCHIVE="${1:?path to backup archive required}"
[[ -f "$ARCHIVE" ]] || { echo "No such file: $ARCHIVE" >&2; exit 1; }

read -p "This will REPLACE the current database and storage. Continue? [yes/NO] " ans
[[ "$ans" == "yes" ]] || { echo "Aborted."; exit 1; }

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT
tar -xzf "$ARCHIVE" -C "$TMP"

echo "[restore] db"
# db.sql.gz is a --clean --if-exists dump (since scripts/backup.sh) — it
# drops each object right before recreating it, so no separate schema-wipe
# is needed here (an earlier version dropped only `public`, which then hit
# dozens of "already exists" errors restoring the auth/storage schema
# objects that pg_dump also captures).
gunzip -c "$TMP/db.sql.gz" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# --no-owner (used at backup time, deliberately, so a restore never depends
# on matching role names) means the dump's CREATE SCHEMA auth/storage lines
# create them owned by whichever role runs this restore instead of
# supabase_auth_admin/supabase_storage_admin — repair that so GoTrue/Storage
# can still manage their own schemas afterward.
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "ALTER SCHEMA auth OWNER TO supabase_auth_admin; ALTER SCHEMA storage OWNER TO supabase_storage_admin;"

echo "[restore] storage"
docker compose run --rm -T \
  -v "$TMP/storage:/backup:ro" \
  --entrypoint /bin/sh minio-init -c "
    mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD >/dev/null;
    for b in product-images documents $STORAGE_S3_BUCKET; do
      [ -d /backup/\$b ] && mc mirror --overwrite --preserve /backup/\$b local/\$b || true;
    done
  "
echo "[restore] done."
