#!/usr/bin/env bash
# Installs the daily backup + off-site sync cron jobs for the current user,
# using this checkout's actual path (works regardless of where you cloned
# the repo, unlike hardcoding /opt/nolte). Idempotent — safe to re-run,
# won't duplicate existing entries.
#
# Usage: scripts/install-cron.sh
# Meant to run on the VPS as the deploy user, not in a container.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="/var/log"

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
add_if_missing "$OFFSITE_LINE"

printf '%s\n' "$existing" | crontab -

echo "[install-cron] done. Current crontab:"
crontab -l
