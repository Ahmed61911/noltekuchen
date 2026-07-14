#!/usr/bin/env bash
# Restore from a backup tarball produced by backup.sh.
# Usage: scripts/restore.sh backups/backup-YYYYMMDD-HHMMSS.tar.gz
#
# DESTRUCTIVE: drops the public schema before restoring. Confirm interactively.
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
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
gunzip -c "$TMP/db.sql.gz" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

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
