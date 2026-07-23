#!/usr/bin/env bash
# One-shot: generate secrets, write .env if missing, mint anon/service_role JWTs.
# Requires: openssl, jq, python3 (for HS256 signing).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]] && grep -qE '^POSTGRES_PASSWORD=' .env; then
  echo "[bootstrap] .env exists — skipping generation."
elif [[ -f .env ]]; then
  # Lovable's dev-preview environment also writes a 6-key .env (SUPABASE_URL,
  # SUPABASE_PUBLISHABLE_KEY, etc. pointed at Lovable Cloud) which is a
  # different shape than the self-host template and would otherwise get
  # silently reused with the wrong backend. Preserve it and start fresh.
  echo "[bootstrap] Existing .env doesn't look like a self-host env (no POSTGRES_PASSWORD)."
  echo "[bootstrap] Assuming it's Lovable's dev-preview file — backing it up to .env.lovable.bak"
  mv .env .env.lovable.bak
  cp .env.example .env
else
  cp .env.example .env
fi

gen() { openssl rand -hex 32; }
patch() { # patch KEY VALUE
  local k="$1" v="$2"
  if grep -qE "^${k}=" .env; then
    sed -i.bak "s|^${k}=.*|${k}=${v}|" .env && rm -f .env.bak
  else
    echo "${k}=${v}" >> .env
  fi
}

# Generate any missing secrets
[[ "$(grep -E '^SESSION_SECRET=' .env | cut -d= -f2-)" =~ ^$|change-me ]] && patch SESSION_SECRET "$(gen)"
[[ "$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)" =~ ^$|change-me ]] && patch POSTGRES_PASSWORD "$(gen)"
[[ "$(grep -E '^MINIO_ROOT_PASSWORD=' .env | cut -d= -f2-)" =~ ^$|change-me ]] && patch MINIO_ROOT_PASSWORD "$(gen)"

# GoTrue/PostgREST/Storage all sign or verify with this — anything short makes
# the anon/service_role HS256 JWTs trivially brute-forceable. `gen` already
# produces 64 hex chars, but guard the case where someone hand-edited .env
# with a weak value instead of running this script.
CURRENT_JWT_SECRET="$(grep -E '^SUPABASE_JWT_SECRET=' .env | cut -d= -f2-)"
if [[ -z "$CURRENT_JWT_SECRET" || ${#CURRENT_JWT_SECRET} -lt 32 ]]; then
  [[ -n "$CURRENT_JWT_SECRET" ]] && echo "[bootstrap] SUPABASE_JWT_SECRET is under 32 chars — regenerating."
  patch SUPABASE_JWT_SECRET "$(gen)"
fi

JWT_SECRET="$(grep -E '^SUPABASE_JWT_SECRET=' .env | cut -d= -f2-)"

mint_jwt() {
  local role="$1"
  python3 - "$JWT_SECRET" "$role" <<'PY'
import base64, hmac, hashlib, json, sys, time
secret, role = sys.argv[1], sys.argv[2]
def b64(x): return base64.urlsafe_b64encode(x).rstrip(b'=').decode()
header = b64(json.dumps({"alg":"HS256","typ":"JWT"},separators=(',',':')).encode())
payload = b64(json.dumps({"role":role,"iss":"supabase","iat":int(time.time()),"exp":int(time.time())+60*60*24*365*10},separators=(',',':')).encode())
sig = b64(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
print(f"{header}.{payload}.{sig}")
PY
}

ANON="$(mint_jwt anon)"
SERVICE="$(mint_jwt service_role)"

patch SUPABASE_PUBLISHABLE_KEY "$ANON"
patch VITE_SUPABASE_PUBLISHABLE_KEY "$ANON"
patch SUPABASE_SERVICE_ROLE_KEY "$SERVICE"

echo "[bootstrap] .env ready."
echo "  Anon key:         $ANON"
echo "  Service role key: (hidden — see .env)"
echo
echo "Next steps:"
echo "  docker compose up -d"
echo "  scripts/create-admin.sh admin@example.com 'YourPassword'"
