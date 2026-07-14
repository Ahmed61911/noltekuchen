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
- `volumes/db/init/` — additional SQL run on first boot of an empty Postgres
  volume, **after** the `database/migrations/` files. Used to create the
  Supabase-internal roles (`anon`, `authenticated`, `service_role`,
  `authenticator`, `supabase_auth_admin`, `supabase_storage_admin`).
- `volumes/functions/` — placeholder for future Supabase Edge Functions
  (empty; the app doesn't currently use any).

See `MIGRATION.md` at the repo root for setup, secret generation, and the
one-time migration from Lovable Cloud.
