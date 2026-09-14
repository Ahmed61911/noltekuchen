#!/usr/bin/env bash
# Points the SMTP_* settings in .env at a Gmail account, prompting for its
# App Password without echoing it (so it never lands in shell history).
#
# Prerequisite, in the Gmail account: 2-Step Verification on, then
#   https://myaccount.google.com/apppasswords  -> create one named "nolte"
#
# Usage: scripts/set-gmail-smtp.sh noltenador@gmail.com
# Then apply: grafana (alert mail) and auth (password-reset / invite mail):
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml \
#     -f docker-compose.monitoring.yml up -d --no-deps grafana auth
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

ACCOUNT="${1:?usage: scripts/set-gmail-smtp.sh you@gmail.com}"
[[ "$ACCOUNT" == *@* ]] || { echo "not an e-mail address: $ACCOUNT" >&2; exit 1; }

read -rsp "App Password for $ACCOUNT (16 letters, spaces optional): " PASS; echo
PASS="${PASS// /}"
[[ ${#PASS} -eq 16 ]] || { echo "expected 16 characters, got ${#PASS}" >&2; exit 1; }

cp -p "$ENV_FILE" "$ENV_FILE.bak-smtp"

set_var() {
  local key="$1" value="$2"
  if grep -q "^$key=" "$ENV_FILE"; then
    # awk, not sed: the value is never parsed as a pattern or replacement.
    KEY="$key" VALUE="$value" awk 'BEGIN{FS=OFS="="} $1==ENVIRON["KEY"]{print ENVIRON["KEY"], ENVIRON["VALUE"]; next} {print}' \
      "$ENV_FILE" > "$ENV_FILE.tmp" && cat "$ENV_FILE.tmp" > "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_var SMTP_HOST smtp.gmail.com
set_var SMTP_PORT 587
set_var SMTP_USER "$ACCOUNT"
set_var SMTP_PASS "$PASS"
set_var SMTP_ADMIN_EMAIL "$ACCOUNT"

echo "[set-gmail-smtp] .env updated (previous copy: .env.bak-smtp)"
echo "[set-gmail-smtp] apply with:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d --no-deps grafana auth"
