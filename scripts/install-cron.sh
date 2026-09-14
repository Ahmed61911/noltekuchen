#!/usr/bin/env bash
# Installs the daily backup (+ off-site sync, once restic is configured) cron
# jobs for the current user, using this checkout's actual path (works
# regardless of where you cloned the repo, unlike hardcoding /opt/nolte).
# Idempotent — safe to re-run, won't duplicate existing entries.
#
# Usage: scripts/install-cron.sh
# Meant to run on the VPS as the deploy user, not in a container.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Not /var/log: the deploy user can't create files there, and cron's
# `>> file` redirect failing means the job never runs at all, silently.
LOG_DIR="${NOLTE_LOG_DIR:-$ROOT/logs}"
mkdir -p "$LOG_DIR"

BACKUP_LINE="0 3 * * * cd $ROOT && ./scripts/backup.sh >> $LOG_DIR/nolte-backup.log 2>&1"
OFFSITE_LINE="15 3 * * * cd $ROOT && ./scripts/backup-offsite.sh >> $LOG_DIR/nolte-offsite.log 2>&1"

existing="$(crontab -l 2>/dev/null || true)"

add_if_missing() {
  local line="$1"
  if printf '%s\n' "$existing" | grep -qF "$line"; then
    echo "[install-cron] already present: $line"
  else
    existing="$(printf '%s\n%s' "$existing" "$line")"
    echo "[install-cron] adding: $line"
  fi
}

add_if_missing "$BACKUP_LINE"
# Weekly proof that the newest archive restores (throwaway container only).
VERIFY_LINE="30 4 * * 0 cd $ROOT && ./scripts/verify-backup.sh >> $LOG_DIR/nolte-verify-backup.log 2>&1"
add_if_missing "$VERIFY_LINE"

# Only once off-site storage is actually configured; otherwise the job would
# fail every night and bury real errors in its log.
if grep -qE '^RESTIC_REPOSITORY=.+' "$ROOT/.env" 2>/dev/null; then
  add_if_missing "$OFFSITE_LINE"
else
  echo "[install-cron] RESTIC_REPOSITORY not set in .env — skipping off-site job (re-run once configured)"
fi

printf '%s\n' "$existing" | sed '/^$/d' | crontab -

echo "[install-cron] done. Current crontab:"
crontab -l
