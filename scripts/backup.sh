#!/usr/bin/env bash
# Nightly backup: pg_dump + MinIO bucket mirror, tarred and gzipped.
# Retains last 14 archives.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a

# Always resolve services through the prod override. With the base file
# alone, compose sees db/minio/app as having diverged from their definition
# and may recreate them with their dev ports published to the internet.
export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml

STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="./backups/$STAMP"
mkdir -p "$OUT/storage"

echo "[backup] pg_dump -> $OUT/db.sql.gz"
# Dumps the WHOLE database (public + auth + storage — GoTrue/Storage own
# schemas too, and we want auth.users et al. backed up, not just app data).
# --clean --if-exists makes the dump self-cleaning on restore (DROP ...  IF
# EXISTS right before each CREATE) so restore.sh doesn't need its own
# schema-drop logic and doesn't hit "already exists" conflicts against
# whatever GoTrue/Storage already created on the target.
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -Fp --no-owner --clean --if-exists "$POSTGRES_DB" | gzip > "$OUT/db.sql.gz"
# pipefail catches a failed pg_dump, but not one that produced nothing.
[[ $(gunzip -c "$OUT/db.sql.gz" | head -c 1024 | wc -c) -gt 0 ]] || { echo "[backup] ERROR: empty database dump" >&2; exit 1; }

echo "[backup] MinIO buckets -> $OUT/storage/"
# --user: mc otherwise writes the mirror as root, and the `rm -rf "$OUT"`
# below then fails under `set -e` — aborting before retention, so archives
# would pile up until the disk fills. MC_CONFIG_DIR: that uid has no
# writable $HOME in the image. --no-deps: minio is already running; never
# let a backup touch it.
docker compose run --rm -T --no-deps \
  --user "$(id -u):$(id -g)" -e MC_CONFIG_DIR=/tmp/.mc \
  -v "$PWD/$OUT/storage:/backup" \
  --entrypoint /bin/sh minio-init -c "
    set -e;
    mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD >/dev/null;
    mc mirror --overwrite --preserve local/product-images /backup/product-images;
    mc mirror --overwrite --preserve local/documents      /backup/documents;
    mc mirror --overwrite --preserve local/$STORAGE_S3_BUCKET /backup/$STORAGE_S3_BUCKET;
  " || echo "[backup] WARNING: storage mirror failed — archive contains the database only" >&2

echo "[backup] tarball"
tar -czf "backups/backup-$STAMP.tar.gz" -C "$OUT" .
rm -rf "$OUT"

# Retain last 14
ls -1t backups/backup-*.tar.gz | tail -n +15 | xargs -r rm -f
echo "[backup] done: backups/backup-$STAMP.tar.gz ($(du -h "backups/backup-$STAMP.tar.gz" | cut -f1))"
