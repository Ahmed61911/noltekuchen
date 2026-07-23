#!/usr/bin/env bash
# Generates nginx/conf.d/app.conf from app.conf.template by substituting
# DOMAIN_APP / DOMAIN_SUPABASE from .env. nginx does not interpolate env vars
# in conf.d files at runtime by default, so this has to happen before nginx
# starts — run this (directly, or via scripts/init-letsencrypt.sh, which
# calls it automatically) any time you change domains in .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

[[ -f .env ]] || { echo "No .env found — run scripts/bootstrap.sh first." >&2; exit 1; }
set -a; . ./.env; set +a

: "${DOMAIN_APP:?set DOMAIN_APP in .env}"
: "${DOMAIN_SUPABASE:?set DOMAIN_SUPABASE in .env}"

command -v envsubst >/dev/null 2>&1 || { echo "envsubst not found — install gettext-base." >&2; exit 1; }

TEMPLATE="nginx/conf.d/app.conf.template"
OUT="nginx/conf.d/app.conf"

[[ -f "$TEMPLATE" ]] || { echo "Missing $TEMPLATE" >&2; exit 1; }

# Only substitute the two vars we actually reference — an unscoped `envsubst`
# would also mangle nginx's own $host / $request_uri / $scheme variables.
envsubst '${DOMAIN_APP} ${DOMAIN_SUPABASE}' < "$TEMPLATE" > "$OUT"

echo "[render-nginx] wrote $OUT for:"
echo "  DOMAIN_APP=$DOMAIN_APP"
echo "  DOMAIN_SUPABASE=$DOMAIN_SUPABASE"
