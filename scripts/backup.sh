#!/usr/bin/env bash
# Nightly backup: pg_dump + MinIO bucket mirror, tarred and gzipped.
# Retains last 14 archives.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a

STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="./backups/$STAMP"
mkdir -p "$OUT"

echo "[backup] pg_dump -> $OUT/db.sql.gz"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -Fp --no-owner "$POSTGRES_DB" | gzip > "$OUT/db.sql.gz"

echo "[backup] MinIO buckets -> $OUT/storage/"
docker compose run --rm -T \
  -v "$PWD/$OUT/storage:/backup" \
  --entrypoint /bin/sh minio-init -c "
    mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD >/dev/null;
    mc mirror --overwrite --preserve local/product-images /backup/product-images;
    mc mirror --overwrite --preserve local/documents      /backup/documents;
    mc mirror --overwrite --preserve local/$STORAGE_S3_BUCKET /backup/$STORAGE_S3_BUCKET;
  " || true

echo "[backup] tarball"
tar -czf "backups/backup-$STAMP.tar.gz" -C "$OUT" .
rm -rf "$OUT"

# Retain last 14
ls -1t backups/backup-*.tar.gz | tail -n +15 | xargs -r rm -f
echo "[backup] done: backups/backup-$STAMP.tar.gz"
