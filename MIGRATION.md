# Migration: Lovable Cloud → Self-Hosted

This document explains how to run the app on your own infrastructure,
starting on your laptop and moving to an Ubuntu VPS.

---

## 1. What changed

Application code (`src/`, routes, RLS, server functions, UI) is **unchanged**.
Only infrastructure, build target, and deployment changed.

| Concern | Before (Lovable Cloud) | After (self-hosted) |
|---|---|---|
| Hosting | Cloudflare Worker (Lovable) | Node.js container behind Nginx |
| Backend | Lovable-managed Supabase | Self-hosted `supabase/*` images (Apache-2.0) |
| Auth | Lovable-managed GoTrue | Self-hosted GoTrue |
| Data API | Lovable-managed PostgREST | Self-hosted PostgREST |
| Storage | Lovable-managed Supabase Storage | Supabase Storage → MinIO (S3) |
| Secrets | Lovable-managed env | Local `.env` + `scripts/bootstrap.sh` |
| Migrations | Lovable migration tool | `database/migrations/` + `scripts/migrate.sh` |
| Deployment | Lovable Publish | `docker compose … up -d` |

New top-level files/directories:

```
.env.example              docker-compose.yml         docker-compose.prod.yml
frontend/                 backend/                   database/
nginx/                    scripts/                   uploads/
MIGRATION.md
```

The application source **remains at the repo root** (`src/`, `package.json`,
etc.) so Lovable's preview environment keeps working during the transition.
`frontend/Dockerfile` builds from the repo root as its context and swaps in
`frontend/vite.config.node.ts` + `frontend/server-node.ts` to target Node
instead of Cloudflare Workers.

---

## 2. One-time migration from Lovable Cloud

You'll perform this **once**, on the machine where you first run the
self-hosted stack.

### 2.1 Export data

1. In Lovable, open **Cloud → Advanced settings → Export data**. Save the
   resulting SQL file to `lovable-export/public.sql`.
2. From Lovable's Cloud dashboard, copy the Supabase project URL and
   service-role key. Put them in `.env` as:
   ```
   LOVABLE_SUPABASE_URL=https://<your-project>.supabase.co
   LOVABLE_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
3. Run `scripts/export-lovable.sh`. This downloads:
   - `lovable-export/users.json` — every auth user (metadata only)
   - `lovable-export/storage/product-images/…`
   - `lovable-export/storage/documents/…`

### 2.2 Existing users

**Every existing user will be forced to reset their password on first login.**
Lovable Cloud's Auth JWT signing keys can't be exported, so the self-hosted
stack mints its own. `scripts/import-lovable.sh` re-creates each user with a
random unusable password; users click "Forgot password" on the login page
(which uses `supabase.auth.resetPasswordForEmail`, already wired) and receive
a reset email.

Tell users this in advance.

### 2.3 Import

After the stack is up (§3), run:

```bash
scripts/import-lovable.sh
```

This drops the empty `public` schema, replays `lovable-export/public.sql`,
mirrors the storage buckets into MinIO, and re-creates users.

---

## 3. Run locally

Requirements: Docker Desktop (or Docker Engine + Compose plugin), `openssl`,
`python3`, `bash`.

```bash
git clone <your-repo>
cd <repo>
scripts/bootstrap.sh          # generates secrets, mints anon/service_role JWTs
docker compose up -d          # first boot: ~2 minutes; migrations auto-apply
scripts/create-admin.sh admin@example.com 'ChangeMe!123'
open http://localhost:8080
```

> **First-boot migrations.** On an empty `pg_data` volume, Postgres runs
> `backend/volumes/db/init/00-roles.sh` (Supabase roles/schemas) during its
> own `docker-entrypoint-initdb.d` phase. The app schema in
> `database/migrations/*.sql` is applied separately, by the one-shot
> `db-migrate` service, *after* `auth` (GoTrue) is healthy — most migrations
> have foreign keys into `auth.users`, which doesn't exist until GoTrue has
> run its own migrations, and that can't have happened yet while `db` is
> still in its first-boot init phase (the `auth` container isn't even
> started at that point). `db-migrate` records each applied filename in
> `public._schema_migrations`. To apply new migrations later against a live
> database, run `scripts/migrate.sh` — it skips already-recorded files, so
> the two paths never conflict. To fully reset, `docker compose down -v`
> wipes the volume and the next `up` re-runs both first-boot init and
> `db-migrate`.

`scripts/bootstrap.sh` writes `.env` (from `.env.example`) with:
- random `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `SESSION_SECRET`,
  `SUPABASE_JWT_SECRET`
- HS256-signed `SUPABASE_PUBLISHABLE_KEY` (anon) and `SUPABASE_SERVICE_ROLE_KEY`

Services:

| Service       | Local URL                  | Notes                              |
|---------------|----------------------------|------------------------------------|
| App           | http://localhost:8080      | TanStack Start SSR                 |
| Supabase API  | http://localhost:8000      | Kong (auth/rest/storage)           |
| MinIO console | http://localhost:9001      | Login = `MINIO_ROOT_USER/PASSWORD` |
| MailHog UI    | http://localhost:8025      | Catches all dev SMTP               |
| Postgres      | localhost:5432             | User = `POSTGRES_USER`             |

Frontend hot-reload for iterative dev is still done via the Lovable preview
(which runs on Lovable Cloud). Docker mode is for validating self-hosting
and for prod.

---

## 4. Deploy to an Ubuntu VPS

1. **Provision** an Ubuntu 22.04+ box, open ports 80 and 443, point two
   DNS A records at it (e.g. `app.example.com`, `supabase.example.com`).
2. **Install** Docker Engine + the Compose plugin (see
   https://docs.docker.com/engine/install/ubuntu/).
3. **Clone** the repo, then:
   ```bash
   scripts/bootstrap.sh
   # Edit .env: set DOMAIN_APP, DOMAIN_SUPABASE, LETSENCRYPT_EMAIL,
   # SMTP_* (real provider), APP_URL=https://<DOMAIN_APP>,
   # VITE_SUPABASE_URL=https://<DOMAIN_SUPABASE>
   ```
4. **First-run TLS**: `scripts/init-letsencrypt.sh` renders
   `nginx/conf.d/app.conf` from `app.conf.template` with your real domains
   (nginx doesn't interpolate `.env` itself), bootstraps a throwaway
   self-signed cert so nginx can start at all, requests real Let's Encrypt
   certs via the webroot method, then reloads nginx with them:
   ```bash
   scripts/init-letsencrypt.sh --staging   # verify DNS/ports first, no rate limit
   scripts/init-letsencrypt.sh             # then for real
   ```
5. **Bring up the full prod stack**:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   scripts/create-admin.sh admin@yourdomain.com '<strong-password>'
   ```

Restart policies (`restart: always`) ensure services come back after reboot.
Named Docker volumes (`pg_data`, `minio_data`, `storage_data`, `letsencrypt`)
persist data across container recreates.

### Traefik alternative

If you prefer Traefik: drop the `nginx` + `certbot` services from
`docker-compose.prod.yml` and add a Traefik service with labels on `app` and
`kong` (`traefik.http.routers.app.rule=Host(...)`, etc.). Everything else is
Traefik-agnostic.

---

## 5. Update the application

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build app
scripts/migrate.sh    # applies any new files in database/migrations/
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d app
```

`scripts/migrate.sh` tracks applied files in `public._schema_migrations`, so
re-running is safe.

---

## 6. Backup and restore

**Backup** (daily cron on the VPS):

```bash
scripts/install-cron.sh   # idempotent; installs both lines below for you
```

which installs:

```
0 3 * * *  cd <repo path> && ./scripts/backup.sh          >> /var/log/nolte-backup.log 2>&1
15 3 * * * cd <repo path> && ./scripts/backup-offsite.sh  >> /var/log/nolte-offsite.log 2>&1
```

Produces `backups/backup-YYYYMMDD-HHMMSS.tar.gz` (pg_dump + all MinIO bucket
contents). Keeps the last 14 locally; `backup-offsite.sh` additionally syncs
to restic (see §9) for 14 daily / 8 weekly / 6 monthly off-host retention.

**Restore**:

```bash
scripts/restore.sh backups/backup-YYYYMMDD-HHMMSS.tar.gz
```

Destructive — drops `public` schema and re-mirrors storage. Confirms
interactively.

---

## 7. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| App can't reach Supabase (`fetch failed`) | `SUPABASE_URL` in `.env` must be `http://kong:8000` inside the compose network; `VITE_SUPABASE_URL` must be the public URL the browser can reach. |
| Login returns 401 immediately | `SUPABASE_JWT_SECRET` changed but anon/service_role keys weren't regenerated. Re-run `scripts/bootstrap.sh` (delete those three env keys first). |
| `Expected 3 parts in JWT; got 1` | You put an `sb_publishable_*` key in `SUPABASE_PUBLISHABLE_KEY`. Self-hosted uses HS256 JWTs from `bootstrap.sh`, not new-format keys. |
| MinIO bucket missing (`NoSuchBucket`) | The `minio-init` one-shot didn't run. `docker compose up minio-init`. |
| `role "anon" does not exist` on first boot | `backend/volumes/db/init/00-roles.sh` didn't run. That only executes on an **empty** volume. `docker compose down -v` (WARNING: wipes data) and back up. |
| `relation "auth.users" does not exist` applying a migration | You're running `database/migrations/*.sql` too early — most have FKs into `auth.users`, which only exists after GoTrue's own migrations run. On first boot this is handled by the `db-migrate` service (gated on `auth` being healthy); for manual runs use `scripts/migrate.sh` after `docker compose up`, not before. |
| PostgREST shows "0 Relations" in its logs | `db-migrate` hasn't completed yet, or failed. `docker compose logs db-migrate`. |
| Certbot fails with "connection refused" | Port 80 not reachable from the internet. Check firewall/DNS. |
| `docker compose exec db …` hangs | Postgres still starting; wait for `pg_isready` (~10s). |
| Nginx: `no such file … fullchain.pem` | Certs not issued yet — run `scripts/init-letsencrypt.sh` (§4). |

---

## 8. What we deliberately did NOT do

- **Did not rewrite Supabase away.** Self-hosted Supabase is open-source
  (Apache-2.0). Replacing it would rewrite all auth, RLS, and server
  functions with zero benefit vs. hosting the same code yourself.
- **Did not add Realtime, Vault, or Edge Functions** — the app doesn't use
  them. If you add features that need them, extend `docker-compose.yml` with
  the corresponding `supabase/realtime` / `supabase/edge-runtime` images.
- **Did not port to a different framework.** TanStack Start runs on Node
  natively; only the Cloudflare-specific wrapper was replaced.

---

## 9. Production hardening (added)

- **Nginx rate limiting** (`nginx/nginx.conf` + `nginx/conf.d/app.conf.template`):
  `/auth/v1/{token,signup,recover,otp,verify,magiclink}` limited to 5 r/s
  (burst 10) per IP; general API to 30 r/s (burst 60).
- **Nginx security headers** (`nginx/conf.d/security-headers.conf` +
  `app.conf.template`): HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, and a CSP on the app domain.
- **Off-site backups** (`scripts/backup-offsite.sh`): restic-based encrypted
  sync to Backblaze B2 / S3 / SFTP, 14 daily / 8 weekly / 6 monthly
  retention. Run daily after `scripts/backup.sh` — `scripts/install-cron.sh`
  sets up both. Set `RESTIC_REPOSITORY`, `RESTIC_PASSWORD` (and provider
  creds) in `.env`, then `restic init` once.
- **Monitoring** (optional, opt-in): `docker compose -f docker-compose.yml
  -f docker-compose.monitoring.yml up -d` adds Grafana + Loki + Promtail +
  Prometheus + postgres-exporter. See `docker-compose.monitoring.yml` for
  details.
- **Host hardening** (`scripts/harden-host.sh`, run once on the VPS as
  root): UFW allowing only 22/80/443, fail2ban for SSH + nginx rate-limit
  429s, and a `/etc/docker/daemon.json` with log rotation, live-restore, and
  userland-proxy disabled.
- **CI/CD** (`.github/workflows/deploy.yml`): on push to `main`, SSH into
  the VPS, `git pull`, rebuild the `app` image, run migrations, restart.
  Configure repo secrets `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `DEPLOY_PATH`.
- **SMTP in prod**: MailHog is dev-only. Set `SMTP_HOST/PORT/USER/PASS` in
  `.env` (Resend / Postmark / SES / Sendgrid) before `up -d`, otherwise
  password reset & invites silently fail.

## 10. Deployment cost reference

| Option | Stack | ~ Monthly cost |
|---|---|---|
| Hetzner CX32 (4 vCPU / 8 GB) — single VPS | app + Supabase + Postgres + MinIO | **~10 €** |
| Hetzner CPX41 (8 vCPU / 16 GB) | same, more headroom | ~26 € |
| VPS + managed Postgres (Neon/Supabase Cloud) | app on VPS, PG managed | ~25–40 € |
| Fly.io / Railway / Render | container platform + managed PG + S3 | ~30–45 $ |
| Kubernetes managed (GKE/EKS/DOKS) | overkill for this workload | 150–250 $ |

Add ~4 €/mo for off-site backup storage (B2 or Hetzner Storage Box) and
0–20 $/mo for transactional SMTP (Resend has a 3000-mail free tier).
