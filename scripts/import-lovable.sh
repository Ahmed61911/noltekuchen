#!/usr/bin/env bash
# One-time: import the export produced by export-lovable.sh into the local stack.
# Users are re-created with random passwords — everyone must use "forgot password"
# on first login. See MIGRATION.md § Existing users.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a; . ./.env; set +a

OUT="./lovable-export"
[[ -f "$OUT/public.sql" ]] || { echo "Missing $OUT/public.sql (see export-lovable.sh)" >&2; exit 1; }

echo "[import] public schema"
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$OUT/public.sql"

# The Lovable export already contains the full schema at export time, so mark
# every historical migration as applied to keep scripts/migrate.sh idempotent.
echo "[import] seed _schema_migrations tracker"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS public._schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
for f in database/migrations/*.sql; do
  name=$(basename "$f")
  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "INSERT INTO public._schema_migrations(filename) VALUES ('$name') ON CONFLICT DO NOTHING;" >/dev/null
done

echo "[import] storage objects"
docker compose run --rm -T \
  -v "$PWD/$OUT/storage:/import:ro" \
  --entrypoint /bin/sh minio-init -c "
    mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD >/dev/null;
    for b in product-images documents; do
      [ -d /import/\$b ] && mc mirror --overwrite --preserve /import/\$b local/\$b || true;
    done
  "

echo "[import] users (forced password reset)"
python3 - <<PY
import json, os, secrets, urllib.request
API = "http://localhost:8000/auth/v1/admin/users"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
users = json.load(open("$OUT/users.json"))["users"] if isinstance(json.load(open("$OUT/users.json")), dict) else json.load(open("$OUT/users.json"))
for u in users:
    body = json.dumps({
        "email": u.get("email"),
        "email_confirm": True,
        "password": secrets.token_urlsafe(24),  # unusable — users must reset
        "user_metadata": u.get("user_metadata", {}),
        "app_metadata": u.get("app_metadata", {}),
    }).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
    })
    try:
        urllib.request.urlopen(req).read()
        print("  +", u.get("email"))
    except Exception as e:
        print("  !", u.get("email"), e)
PY

echo "[import] done. Users must reset passwords via the login page."
