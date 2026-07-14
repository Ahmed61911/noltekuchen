#!/usr/bin/env bash
# One-time: export data + storage from the existing Lovable Cloud project.
# Prereqs:
#   1. Get a pg_dump of the `public` schema via Cloud → Advanced settings →
#      Export data. Save to lovable-export/public.sql.
#   2. Set LOVABLE_SUPABASE_URL and LOVABLE_SUPABASE_SERVICE_ROLE_KEY in .env.
#
# This script downloads storage bucket contents + a JSON dump of auth users.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a

: "${LOVABLE_SUPABASE_URL:?set in .env}"
: "${LOVABLE_SUPABASE_SERVICE_ROLE_KEY:?set in .env}"

OUT="./lovable-export"
mkdir -p "$OUT/storage/product-images" "$OUT/storage/documents"

echo "[export] auth users"
curl -s "$LOVABLE_SUPABASE_URL/auth/v1/admin/users?per_page=1000" \
  -H "apikey: $LOVABLE_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $LOVABLE_SUPABASE_SERVICE_ROLE_KEY" \
  > "$OUT/users.json"

dl_bucket() {
  local bucket="$1"
  echo "[export] storage: $bucket"
  # List objects (recursive)
  local files
  files=$(curl -s -X POST "$LOVABLE_SUPABASE_URL/storage/v1/object/list/$bucket" \
    -H "apikey: $LOVABLE_SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $LOVABLE_SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"limit":10000,"prefix":""}' | python3 -c 'import sys,json;[print(o["name"]) for o in json.load(sys.stdin)]')
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    mkdir -p "$OUT/storage/$bucket/$(dirname "$name")"
    curl -s -o "$OUT/storage/$bucket/$name" \
      "$LOVABLE_SUPABASE_URL/storage/v1/object/$bucket/$name" \
      -H "apikey: $LOVABLE_SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $LOVABLE_SUPABASE_SERVICE_ROLE_KEY"
  done <<< "$files"
}
dl_bucket product-images
dl_bucket documents

echo "[export] done."
echo "  Place your pg_dump at $OUT/public.sql (from Cloud → Export data)."
echo "  Then run: scripts/import-lovable.sh"
