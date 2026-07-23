# Deployment Runbook — Hetzner CX32 / Ubuntu 24.04

End-to-end guide for taking this repo from zero to a running production
instance, and for operating it afterward (updates, rollback, disaster
recovery). If you just want local dev, see [MIGRATION.md](MIGRATION.md)
instead — this file is production-only.

---

## 1. Provision the VPS

1. **Create the server.** Hetzner Cloud console → Add Server → CX32 →
   Ubuntu 24.04 → add your SSH public key at creation time (don't use the
   emailed root password).
2. **First login, create a non-root deploy user:**
   ```bash
   ssh root@<server-ip>
   adduser deploy
   usermod -aG sudo deploy
   rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
   ```
   From here on, do everything as `deploy`, not `root`:
   ```bash
   ssh deploy@<server-ip>
   ```
3. **Harden SSH** (`sudo nano /etc/ssh/sshd_config`): set
   `PermitRootLogin no` and `PasswordAuthentication no`, then
   `sudo systemctl restart sshd`. Confirm you can still log in as `deploy`
   in a **second** terminal before closing your first session.
4. **Install Docker Engine + Compose plugin:**
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker deploy
   ```
   Log out and back in for the group change to take effect.
5. **Clone the repo:**
   ```bash
   sudo mkdir -p /opt/nolte && sudo chown deploy:deploy /opt/nolte
   git clone <your-repo-url> /opt/nolte
   cd /opt/nolte
   ```
6. **Run the host-hardening script** (UFW allowing only 22/80/443, fail2ban
   for SSH + nginx rate-limiting, Docker daemon log rotation/live-restore):
   ```bash
   sudo scripts/harden-host.sh
   ```
   This is the only step in this whole runbook that touches the host
   directly rather than a container — review the script before running it
   on anything you don't fully control.

---

## 2. DNS

Point two A records at the VPS's IP:

| Record | Value |
|---|---|
| `app.yourdomain.com` | `<server-ip>` |
| `supabase.yourdomain.com` | `<server-ip>` |

Wait for propagation (`dig +short app.yourdomain.com` should return the
server IP) before continuing — step 4 needs port 80 reachable at both
domains for the ACME HTTP-01 challenge to succeed.

---

## 3. Bootstrap secrets and configuration

```bash
cd /opt/nolte
scripts/bootstrap.sh
```

This generates `.env` from `.env.example` with strong random
`POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `SESSION_SECRET`,
`SUPABASE_JWT_SECRET`, and HS256-signed anon/service_role keys. Now edit
`.env` and set:

```bash
NODE_ENV=production
APP_URL=https://app.yourdomain.com
VITE_SUPABASE_URL=https://supabase.yourdomain.com
DOMAIN_APP=app.yourdomain.com
DOMAIN_SUPABASE=supabase.yourdomain.com
LETSENCRYPT_EMAIL=you@yourdomain.com
SMTP_HOST=...   # Resend or SES — see the comments in .env.example.
SMTP_PORT=...   # MailHog only exists in dev; prod has no fallback.
SMTP_USER=...
SMTP_PASS=...
```

Leave `SUPABASE_URL` as `http://kong:8000` — that's the in-network address
the app container uses to reach Kong, not a public URL.

---

## 4. TLS and first boot

```bash
scripts/init-letsencrypt.sh --staging   # verify DNS/ports first — no rate limit
scripts/init-letsencrypt.sh             # then request the real certificate
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`init-letsencrypt.sh` renders `nginx/conf.d/app.conf` from
`app.conf.template` with your real domains, bootstraps a throwaway
self-signed cert so nginx can start at all, requests the real Let's
Encrypt cert via the webroot method, and reloads nginx with it. The
`up -d` afterward brings up the full stack; on a fresh volume this
includes the one-shot `db-migrate` service applying all of
`database/migrations/*.sql` once GoTrue is healthy.

Watch it come up:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Everything with a healthcheck should reach `healthy`; `minio-init` and
`db-migrate` should show `Exited (0)` — that's success for one-shot jobs,
not a crash.

Set up the daily backup cron:

```bash
scripts/install-cron.sh
```

And if you want off-site backups (recommended), set `RESTIC_REPOSITORY`,
`RESTIC_PASSWORD` (and provider credentials) in `.env`, then run
`restic -r "$RESTIC_REPOSITORY" init` once — `install-cron.sh` already
schedules `backup-offsite.sh` to run after the local backup.

---

## 5. Create the first admin user

```bash
scripts/create-admin.sh admin@yourdomain.com 'a-strong-password'
```

This creates the user via GoTrue's admin API with `email_confirm=true`
(usable immediately) and inserts the `admin` role into `public.user_roles`.

---

## 6. Configure CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` redeploys on every push to `main` — it SSHes
in, `git pull --ff-only`s, rebuilds the `app` image, runs
`scripts/migrate.sh`, and restarts `app`. In the GitHub repo, go to
**Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `SSH_HOST` | the VPS IP or hostname |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | private key whose public half is in `deploy`'s `~/.ssh/authorized_keys` |
| `SSH_PORT` | optional, defaults to 22 |
| `DEPLOY_PATH` | `/opt/nolte` (or wherever you cloned it) |

**Known limitation:** the workflow only rebuilds/restarts `app`. If you
change `nginx/`, `backend/volumes/api/kong.yml`, or anything else that
isn't `src/`/`frontend/`, redeploy those services manually (see §9).

---

## 7. Smoke test

```bash
curl -I https://app.yourdomain.com/                          # 200 or 307
curl -s https://supabase.yourdomain.com/auth/v1/health        # GoTrue JSON
curl -s -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  https://supabase.yourdomain.com/rest/v1/                    # OpenAPI schema
```

Then in a browser:

1. **Login** — open `https://app.yourdomain.com/login`, sign in with the
   admin account from §5.
2. **Create a product** — Products → New, confirm it appears in the list.
3. **Upload an image** — attach a product image, confirm it renders (it's
   round-tripping through Storage-API → MinIO).
4. **Generate a PDF invoice** — create an invoice and download the PDF
   (client-side via `jspdf`); confirm it opens and the data matches.

If any of these fail, check `docker compose -f docker-compose.yml -f
docker-compose.prod.yml logs <service>` for the relevant service first —
`app`, `kong`, `auth`, `rest`, and `storage` cover most of the request path.

---

## 8. Rollback

**App-only rollback** (no schema change involved — the common case):

```bash
cd /opt/nolte
git log --oneline -10                 # find the last known-good commit
git checkout <good-sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml build app
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d app
```

**If the bad deploy included a migration** that needs undoing: there are no
down-migrations in this repo (every migration is forward-only and
idempotent-safe, per `database/migrations/`). Rolling back the app code
alone will NOT undo a schema change. Your options, in order of preference:
1. Write and apply a new forward migration that reverses the change.
2. Restore from the backup taken before the bad deploy (§10) — destructive,
   loses any writes made after that backup.

---

## 9. Routine updates

This is what `.github/workflows/deploy.yml` automates on push to `main`;
run it manually if you need to deploy something the workflow doesn't cover
(nginx, Kong config, etc.):

```bash
cd /opt/nolte
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build app
scripts/migrate.sh        # applies any new files in database/migrations/
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d app

# Only if nginx/ changed:
scripts/render-nginx.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx

# Only if backend/volumes/api/kong.yml changed:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate kong
```

---

## 10. Disaster recovery

Scenario: the VPS is gone (or badly corrupted) and you're restoring onto a
fresh box from off-site (restic) backups.

1. **Provision a new VPS** and repeat §1–§4 up through `docker compose ...
   up -d` — this gives you a fresh, empty, correctly-configured stack
   (new secrets are fine; see the note below on why that's safe).
2. **Pull the latest snapshot down from restic:**
   ```bash
   restic -r "$RESTIC_REPOSITORY" snapshots            # find the one you want
   restic -r "$RESTIC_REPOSITORY" restore latest --target ./restic-restore
   ```
   This gives you back a `backup-YYYYMMDD-HHMMSS.tar.gz` — the exact tarball
   `scripts/backup.sh` produced, since restic is just shipping those files
   off-host, not repacking them.
3. **Restore it:**
   ```bash
   scripts/restore.sh ./restic-restore/backups/backup-YYYYMMDD-HHMMSS.tar.gz
   ```
   This replaces the fresh stack's database (all schemas — `public`, `auth`,
   `storage`) and mirrors the backed-up MinIO buckets back in. It's a full
   `pg_dump --clean --if-exists` replay, so it cleanly drops and recreates
   each object rather than conflicting with what the fresh box's GoTrue/
   Storage-API already created on first boot.
4. **Why fresh secrets are fine:** `scripts/bootstrap.sh` on the new box
   generates a brand new `POSTGRES_PASSWORD`/`SUPABASE_JWT_SECRET` — that's
   fine, because the restored dump contains actual *data* (rows), not role
   definitions or passwords. The new box's `00-roles.sh` already set up
   `authenticator`/`supabase_auth_admin`/`supabase_storage_admin` correctly
   under the new password before you ever restore anything. Existing user
   *sessions* (JWTs signed with the old secret) won't validate anymore —
   users just log in again, which is a completely different tradeoff than
   the "everyone must reset their password" situation in the one-time
   Lovable migration (see [MIGRATION.md](MIGRATION.md) §2.2): here, password
   hashes ARE preserved, since `auth.users` is part of the restored dump.
5. **Point DNS at the new IP**, and re-run `scripts/init-letsencrypt.sh` if
   you provisioned a genuinely new box (a fresh IP means a fresh cert
   bootstrap regardless of restored data).
6. **Smoke test again** (§7) before considering the recovery complete.
