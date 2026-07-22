#!/usr/bin/env bash
# Off-site backup sync. Ships local ./backups/*.tar.gz to a remote target
# using restic (encrypted, deduplicated). Run after scripts/backup.sh.
#
# Requirements on the host (not in a container):
#   apt-get install -y restic
#
# Env vars (add to .env):
#   RESTIC_REPOSITORY=b2:my-bucket:nolte     # or s3:s3.amazonaws.com/bucket, sftp:user@host:/path
#   RESTIC_PASSWORD=<strong-random>          # keep safe — losing this = losing backups
#   B2_ACCOUNT_ID=...  B2_ACCOUNT_KEY=...    # if using Backblaze B2
#   AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...  # if using S3
#
# First run: restic -r "$RESTIC_REPOSITORY" init
#
# Cron: 0 4 * * *  cd /opt/nolte && ./scripts/backup-offsite.sh >> /var/log/nolte-offsite.log 2>&1

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY not set}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD not set}"

echo "[offsite] backing up ./backups to $RESTIC_REPOSITORY"
restic backup ./backups --tag nolte-erp

echo "[offsite] pruning old snapshots (keep 7 daily, 4 weekly, 6 monthly)"
restic forget --prune \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --tag nolte-erp

echo "[offsite] done"
