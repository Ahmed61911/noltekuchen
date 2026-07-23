# backend/

Self-hosted Supabase stack configuration.

The "backend" is a bundle of open-source services orchestrated by
`docker-compose.yml` in the repo root:

- **Postgres** (`supabase/postgres`) — database
- **GoTrue** — auth (`/auth/v1/*`)
- **PostgREST** — Data API (`/rest/v1/*`)
- **Storage API** — file storage (`/storage/v1/*`) backed by MinIO (S3)
- **Kong** — API gateway that fronts all of the above on port `8000`
- **MinIO** — S3-compatible object store for uploaded files

Files:
- `volumes/api/kong.yml` — declarative Kong config, routes `/auth`, `/rest`,
  `/storage` to the correct upstream services.
- `volumes/db/init/00-roles.sh` — runs during Postgres's own first-boot
  `docker-entrypoint-initdb.d` phase, before any other service starts. Creates
  the Supabase-internal roles (`anon`, `authenticated`, `service_role`,
  `authenticator`, `supabase_auth_admin`, `supabase_storage_admin`).
- `volumes/db/run-app-migrations.sh` — applies `database/migrations/*.sql`,
  run by the one-shot `db-migrate` compose service *after* `auth` (GoTrue) is
  healthy. This has to be a separate, later step: most app migrations have
  foreign keys into `auth.users`, which only exists once GoTrue has run its
  own migrations — that hasn't happened yet during `00-roles.sh`'s init phase.

See `MIGRATION.md` at the repo root for setup, secret generation, and the
one-time migration from Lovable Cloud.
