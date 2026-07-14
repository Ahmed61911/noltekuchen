#!/usr/bin/env bash
# Create an initial admin user via the GoTrue Admin API.
# Usage: scripts/create-admin.sh <email> <password>
set -euo pipefail

EMAIL="${1:?email required}"
PASSWORD="${2:?password required}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a

: "${SUPABASE_SERVICE_ROLE_KEY:?run scripts/bootstrap.sh first}"

# Create user (email_confirm=true so they can log in immediately)
RESP=$(curl -s -X POST "http://localhost:8000/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Administrator\"}}")

USER_ID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))')
if [[ -z "$USER_ID" ]]; then
  echo "Failed to create user: $RESP" >&2; exit 1
fi

# Grant admin role
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "INSERT INTO public.user_roles(user_id, role) VALUES ('$USER_ID'::uuid, 'admin') ON CONFLICT DO NOTHING;"

echo "Admin user created: $EMAIL ($USER_ID)"
