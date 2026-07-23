#!/usr/bin/env bash
# One-time VPS host hardening: UFW, fail2ban, Docker daemon settings.
# Run ONCE on the target Ubuntu VPS as root (sudo scripts/harden-host.sh),
# from the repo checkout — NOT in a container, and NOT on this dev machine.
# Idempotent where practical, but review before re-running on a box you've
# already customized.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run this as root: sudo scripts/harden-host.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[harden] installing ufw + fail2ban"
apt-get update -qq
apt-get install -y -qq ufw fail2ban

echo "[harden] configuring UFW (22, 80, 443 only)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[harden] preparing nginx's host-visible log directory"
# Must exist and be writable by nginx's worker process (non-root) before
# nginx starts — see docker-compose.prod.yml's nginx volumes and
# scripts/init-letsencrypt.sh, which also creates this on first boot.
mkdir -p "$ROOT/nginx/logs"
chmod 777 "$ROOT/nginx/logs"

echo "[harden] configuring fail2ban: sshd + nginx rate-limit (429s)"
cat > /etc/fail2ban/filter.d/nginx-ratelimit.conf <<'EOF'
# Matches nginx access log lines with a 429 (rate-limited) response —
# see nginx/nginx.conf's limit_req_zone auth_zone/api_zone.
[Definition]
failregex = ^<HOST> -.*"(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) [^"]*" 429
ignoreregex =
EOF

cat > /etc/fail2ban/jail.d/nolte.local <<EOF
[sshd]
enabled = true
maxretry = 5
findtime = 600
bantime = 3600

[nginx-ratelimit]
enabled = true
port = http,https
filter = nginx-ratelimit
logpath = $ROOT/nginx/logs/access.log
maxretry = 20
findtime = 60
bantime = 3600
EOF

systemctl enable fail2ban
systemctl restart fail2ban

echo "[harden] configuring Docker daemon (log rotation, live-restore, no userland-proxy)"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  },
  "live-restore": true,
  "userland-proxy": false
}
EOF

echo "[harden] restarting Docker to apply daemon.json (containers stay running via live-restore)"
systemctl restart docker

echo "[harden] done."
echo "  ufw status:      ufw status verbose"
echo "  fail2ban status: fail2ban-client status nginx-ratelimit"
