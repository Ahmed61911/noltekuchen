#!/usr/bin/env bash
# One-time: bootstrap real Let's Encrypt certs for DOMAIN_APP / DOMAIN_SUPABASE
# on a fresh VPS, then start the prod stack. Run this ONCE, before the first
# `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.
#
# Nginx refuses to start at all if the cert files its config `ssl_certificate`
# directives point at don't exist yet — but certbot can't issue real certs
# until nginx is already serving the ACME HTTP-01 challenge on port 80. This
# script breaks that chicken-and-egg loop the standard way: generate a
# throwaway self-signed cert so nginx can start, request the real cert via
# the webroot method, swap it in, then start the renewal loop.
#
# Usage:
#   scripts/init-letsencrypt.sh          # real Let's Encrypt certs
#   scripts/init-letsencrypt.sh --staging  # Let's Encrypt STAGING (untrusted
#                                           # certs, but no rate limits — use
#                                           # this first to check DNS/ports
#                                           # are correct before spending your
#                                           # limited real-cert quota)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

[[ -f .env ]] || { echo "No .env found — run scripts/bootstrap.sh first." >&2; exit 1; }
set -a; . ./.env; set +a

: "${DOMAIN_APP:?set DOMAIN_APP in .env}"
: "${DOMAIN_SUPABASE:?set DOMAIN_SUPABASE in .env}"
: "${LETSENCRYPT_EMAIL:?set LETSENCRYPT_EMAIL in .env}"

for d in "$DOMAIN_APP" "$DOMAIN_SUPABASE" "$LETSENCRYPT_EMAIL"; do
  if [[ "$d" == *example.com ]]; then
    echo "Refusing to run: .env still has an example.com placeholder ($d)." >&2
    echo "Set DOMAIN_APP, DOMAIN_SUPABASE, LETSENCRYPT_EMAIL to your real values first." >&2
    exit 1
  fi
done

STAGING_ARG=""
if [[ "${1:-}" == "--staging" ]]; then
  STAGING_ARG="--staging"
  echo "[init-letsencrypt] STAGING mode — certs will NOT be trusted by browsers."
fi

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

echo "[init-letsencrypt] rendering nginx config for $DOMAIN_APP / $DOMAIN_SUPABASE"
./scripts/render-nginx.sh

# nginx.conf writes a second copy of the access log here (besides the
# stdout one `docker logs` shows) so scripts/harden-host.sh's fail2ban jail
# can tail it from the host. Bind-mounted, so it has to exist and be
# writable by nginx's worker process (not root) before nginx ever starts.
mkdir -p nginx/logs
chmod 777 nginx/logs

echo "[init-letsencrypt] generating throwaway self-signed certs so nginx can start"
for domain in "$DOMAIN_APP" "$DOMAIN_SUPABASE"; do
  "${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
    mkdir -p /etc/letsencrypt/live/$domain && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/$domain/privkey.pem \
      -out /etc/letsencrypt/live/$domain/fullchain.pem \
      -subj '/CN=localhost'
  "
done

echo "[init-letsencrypt] starting nginx with the throwaway certs"
"${COMPOSE[@]}" up -d nginx

echo "[init-letsencrypt] requesting real certificates"
for domain in "$DOMAIN_APP" "$DOMAIN_SUPABASE"; do
  "${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
    rm -rf /etc/letsencrypt/live/$domain /etc/letsencrypt/archive/$domain /etc/letsencrypt/renewal/$domain.conf && \
    certbot certonly --webroot -w /var/www/certbot \
      -d $domain \
      --email $LETSENCRYPT_EMAIL --agree-tos --no-eff-email $STAGING_ARG
  "
done

echo "[init-letsencrypt] reloading nginx with real certs"
"${COMPOSE[@]}" exec nginx nginx -s reload

echo "[init-letsencrypt] done. Bring up the rest of the stack with:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
