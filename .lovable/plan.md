# Self-Hosting Migration Plan

Before touching any code, here is a full analysis of what this project depends on today and what changes are needed to run it entirely on your own infrastructure (local Docker Compose → Ubuntu VPS).

---

## 1. Cloud Dependency Audit

### 1.1 Lovable-specific pieces
- **Lovable Cloud** = a managed Supabase project (Postgres + Auth + Storage + Edge runtime + Data API) provisioned by Lovable. There is no Lovable-proprietary runtime in the app itself.
- **Lovable AI Gateway** — not used at runtime in this codebase (no `LOVABLE_API_KEY` calls in the app code; the secret exists but is unused). Safe to drop.
- **Lovable preview/publish hosting** — build output is a Cloudflare Worker (see `wrangler.jsonc`, `@cloudflare/vite-plugin` in `@lovable.dev/vite-tanstack-config`). This is Lovable's hosting; on your VPS we replace it with Node SSR behind Nginx.
- **`@lovable.dev/vite-tanstack-config`** — bundles TanStack Start + Cloudflare adapter + component tagger. On self-host we swap this for a direct TanStack Start + Node adapter config so the app runs as `node .output/server/index.mjs`.
- **`src/integrations/lovable`** OAuth broker — only relevant if you use Google/Apple sign-in through Lovable's broker. Current `auth.tsx` uses email/password only, so this can be removed without loss of function.

### 1.2 Supabase surface actually used
- `auth.users` + `auth.getUser/getSession/onAuthStateChange/signIn/signUp/signOut`
- Postgres tables under `public.*` (33 tables) with RLS policies
- Storage buckets: `product-images`, `documents`
- `.rpc()` calls: `has_role`, `get_user_permissions`, `user_has_permission`
- Server functions (`createServerFn` + `requireSupabaseAuth`) using `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- No Edge Functions, no Realtime, no Supabase Vault, no external OAuth providers currently enabled

### 1.3 What can remain unchanged
- All `public.*` schema, RLS, triggers, functions — pure Postgres, portable
- All `@/integrations/supabase/*` client code — points at whatever `SUPABASE_URL` you give it
- All TanStack Start route/server-function code
- All UI code

### 1.4 What must change
- Hosting target: Cloudflare Worker → Node.js container
- Supabase endpoint: Lovable-managed → self-hosted Supabase stack
- Storage: cloud Supabase Storage → self-hosted Supabase Storage (MinIO-backed)
- Env vars: hardcoded Lovable project ref/keys in committed `.env` → generated locally
- Migrations: currently applied via Lovable's migration tool → applied via Supabase CLI against local stack

### 1.5 Risks
- **Supabase Auth JWT signing keys** on Lovable Cloud use asymmetric keys we can't export. Self-hosted Supabase will generate new keys → **all existing users must reset passwords or be re-created**. `auth.users` rows themselves can be exported (email, metadata, hashed password if using bcrypt), but password hashes only migrate cleanly if algorithm matches. Plan: export users, re-import via Auth Admin API, force password reset email on first login.
- **Data export**: use Lovable Cloud → Advanced settings → Export data for a pg_dump of `public` schema. Storage objects must be downloaded manually per bucket (script provided).
- **Cloudflare-specific code paths**: `src/server.ts` wraps `@tanstack/react-start/server-entry` for the Worker fetch handler. We'll replace with a Node HTTP server entry. No `child_process`/native-only libs are used, so no other porting concerns.
- **`nodejs_compat` shims**: none of the currently-used npm packages require polyfills that only exist on Workers; Node runs them natively.

---

## 2. Target Architecture

Self-hosted Supabase (official `supabase/docker` stack) + our app + Nginx reverse proxy, all orchestrated with Docker Compose.

```text
                  ┌────────── Nginx (443/80, TLS) ──────────┐
                  │                                          │
      https://app.example.com                    https://supabase.example.com
                  │                                          │
        ┌─────────▼─────────┐                     ┌──────────▼─────────┐
        │  app (Node SSR)   │──── SUPABASE_URL ──▶│  Supabase Kong     │
        │  TanStack Start   │                     │  ├─ GoTrue (auth)  │
        └───────────────────┘                     │  ├─ PostgREST      │
                                                  │  ├─ Storage API    │
                                                  │  └─ Realtime       │
                                                  └──┬─────────┬───────┘
                                                     │         │
                                          ┌──────────▼──┐  ┌───▼─────┐
                                          │  Postgres   │  │  MinIO  │
                                          │  (volume)   │  │(volume) │
                                          └─────────────┘  └─────────┘
```

Rationale for keeping Supabase (self-hosted) instead of ripping it out:
- Preserves every line of `@/integrations/supabase/*`, all RLS policies, all `.rpc()` calls, all server functions — zero application-code rewrites for the auth/data layer.
- The alternative (replace Supabase with raw Postgres + custom auth + S3 client) would require rewriting the entire auth flow, all RLS enforcement in application code, and every server function. That is a multi-week rewrite with high regression risk and is explicitly not needed to escape vendor lock-in — self-hosted Supabase is Apache-2.0 open source.

MinIO is used as the S3 backend for Supabase Storage (Storage API already supports S3-compatible backends via env vars), so uploaded files live on a Docker volume you control.

---

## 3. Target Project Structure

```text
/
├── docker-compose.yml            # dev: app + full supabase stack + minio
├── docker-compose.prod.yml       # prod overrides: restart:always, no bind mounts, resource limits
├── .env.example                  # every variable, documented
├── .env                          # gitignored
├── frontend/                     # (renamed from repo root src/) TanStack Start app
│   ├── Dockerfile                # multi-stage: build → node:20-alpine runtime
│   ├── package.json
│   ├── src/
│   └── ...
├── database/
│   ├── migrations/               # copied from supabase/migrations
│   └── seed.sql                  # optional dev seed
├── supabase/                     # self-hosted stack config (from supabase/docker)
│   ├── volumes/
│   │   ├── db/init/              # runs migrations on first boot
│   │   ├── api/kong.yml
│   │   └── functions/            # empty, kept for parity
│   └── .env                      # supabase-internal secrets
├── nginx/
│   ├── nginx.conf
│   ├── conf.d/app.conf
│   └── certs/                    # letsencrypt or self-signed for dev
├── minio/                        # (volume mount target)
├── uploads/                      # legacy local uploads (unused after MinIO)
├── scripts/
│   ├── bootstrap.sh              # generate secrets, create .env, init db
│   ├── migrate.sh                # apply SQL migrations to running db
│   ├── backup.sh                 # pg_dump + mc mirror of MinIO buckets
│   ├── restore.sh                # restore from backup archive
│   ├── export-lovable.sh         # one-time: pull data + storage from Lovable Cloud
│   └── import-lovable.sh         # one-time: load exported data into local stack
└── MIGRATION.md
```

Note: the current repo is flat (no `backend/`). Since our "backend" is the Supabase stack + Node SSR bundled with the frontend, we use `frontend/` for the app and `supabase/` for the backend services. A separate `backend/` directory would be empty — I'll skip it rather than create noise. If you prefer the exact `backend/` name, tell me and I'll rename `supabase/` → `backend/`.

---

## 4. Concrete Changes

### 4.1 Build & runtime
- Replace `@lovable.dev/vite-tanstack-config` with a plain TanStack Start Vite config using the Node target.
- Rewrite `src/server.ts` to export a Node HTTP handler (or use TanStack Start's built-in Node entry) instead of a Cloudflare `fetch` export.
- Remove `wrangler.jsonc` and `@cloudflare/vite-plugin`.
- Add `frontend/Dockerfile` (multi-stage build, final image runs `node .output/server/index.mjs` on port 3000).
- Keep every `src/*` file untouched functionally.

### 4.2 Env vars (`.env.example`)
```env
# --- App ---
APP_URL=http://localhost:8080
NODE_ENV=development
SESSION_SECRET=change-me

# --- Supabase (public, sent to browser) ---
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>

# --- Supabase (server-only) ---
SUPABASE_URL=http://kong:8000
SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_JWT_SECRET=<40+ char random>

# --- Postgres ---
POSTGRES_PASSWORD=<random>
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# --- Auth ---
GOTRUE_SITE_URL=http://localhost:8080
GOTRUE_DISABLE_SIGNUP=true
GOTRUE_MAILER_AUTOCONFIRM=true
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SENDER_NAME="Nolte Kuchen"

# --- Storage / MinIO ---
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=<random>
STORAGE_S3_BUCKET=supabase-storage
STORAGE_S3_ENDPOINT=http://minio:9000
STORAGE_S3_REGION=us-east-1

# --- Domain / TLS (prod) ---
DOMAIN_APP=app.example.com
DOMAIN_SUPABASE=supabase.example.com
LETSENCRYPT_EMAIL=you@example.com
```

The two committed keys currently in `.env` (Lovable's anon key + project ref) get removed.

### 4.3 Database
- Copy every file from `supabase/migrations/` into `database/migrations/`.
- Mount them into the `db` container's `docker-entrypoint-initdb.d/` so a fresh Postgres volume replays them in order.
- `scripts/migrate.sh` uses `supabase db push` or `psql -f` against the running container for incremental changes.
- `database/seed.sql` seeds an initial admin user + baseline `roles`, `permissions`, `warehouses` for dev.

### 4.4 Storage
- Self-hosted Supabase Storage points at MinIO via `STORAGE_BACKEND=s3` + the `STORAGE_S3_*` vars above.
- Buckets `product-images` and `documents` are recreated by a one-shot `mc` init container that also mirrors any files exported from Lovable.
- Existing app code (`supabase.storage.from(...)`) works without changes.

### 4.5 Auth
- GoTrue runs in Supabase stack, signup disabled (matches current behavior).
- Users migrated via `scripts/import-lovable.sh` calling the Auth Admin API. Users receive a password-reset email on first login (documented in MIGRATION.md).
- `src/lib/auth.tsx` unchanged.

### 4.6 Reverse proxy
- Nginx container terminates TLS (Let's Encrypt via certbot sidecar for prod; self-signed for dev).
- Routes:
  - `app.example.com/*` → `app:3000`
  - `supabase.example.com/*` → `kong:8000` (needed so the browser can call the Supabase API cross-container from the user's laptop)
- Compatible with swapping in Traefik later (documented).

### 4.7 Dev vs prod
- `docker-compose.yml`: dev — bind-mounts frontend source for hot reload, exposes ports directly, MailHog instead of real SMTP.
- `docker-compose.prod.yml`: override with `restart: always`, resource limits, no source bind-mount, real SMTP, letsencrypt volume, nginx enabled.
- Both use named volumes: `pg_data`, `minio_data`, `storage_data`, `letsencrypt`.

### 4.8 Backup / restore
- `scripts/backup.sh`: `pg_dump` → gzipped SQL in `./backups/YYYY-MM-DD.sql.gz`, `mc mirror` MinIO buckets → `./backups/storage-YYYY-MM-DD/`, tars both.
- `scripts/restore.sh`: reverse.
- Cron example in MIGRATION.md.

### 4.9 Health checks
- Postgres: `pg_isready`
- Kong/PostgREST/GoTrue/Storage: HTTP `/health` where available, TCP probe otherwise
- App: `GET /` returns 200
- MinIO: `/minio/health/ready`

### 4.10 Documentation (`MIGRATION.md`)
Sections:
1. What changed (mapping old → new)
2. One-time data migration from Lovable Cloud
3. Local development (clone, `cp .env.example .env`, `scripts/bootstrap.sh`, `docker compose up`)
4. VPS deployment (Ubuntu, install Docker, DNS, `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`, first-run TLS)
5. Updating the app (`git pull`, rebuild image, migrate, restart)
6. Backup & restore
7. Troubleshooting (common: wrong JWT secret, MinIO bucket missing, kong routes not registered, TLS cert renewal)

---

## 5. Execution Order (once you approve)

1. Create `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`, `nginx/`, `scripts/`, `MIGRATION.md` (no app changes yet — verify stack boots empty).
2. Move `src/` and app config into `frontend/`, add `frontend/Dockerfile`, swap Vite config away from Lovable/Cloudflare, rewrite `src/server.ts` for Node.
3. Copy migrations into `database/migrations/` + init hook. Bring up stack, confirm schema applies cleanly on a fresh volume.
4. Wire MinIO into Supabase Storage, recreate buckets.
5. Write the Lovable export/import scripts, dry-run against your current cloud project.
6. Full end-to-end smoke test: login, create product, upload image, create invoice, view PDF.
7. Prod compose + Nginx + TLS.

Nothing in `src/` that isn't infra-related will change. All routes, RLS, server functions, and UI stay identical.

---

## 6. Open Questions Before I Start

1. **Users**: are you OK with all existing users getting a "reset your password" email on first login after migration? (Alternative: I keep them logged out and you re-create the admin manually, plus optionally re-invite others.)
2. **Domain names for prod**: what domains will you point at the VPS for the app and for Supabase? (I'll template them into `.env.example` and Nginx config.)
3. **SMTP for prod**: do you have an existing SMTP provider (Mailgun/SES/Postmark/etc.), or should I default to MailHog for dev + placeholder env vars for prod for you to fill in later?
4. **Directory naming**: keep `frontend/` + `supabase/` as I proposed, or force the exact `backend/` name from your example (I'd put the Supabase stack config under `backend/` in that case)?

Answer those four and I'll execute the plan end-to-end.
