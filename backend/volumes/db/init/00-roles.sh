#!/usr/bin/env bash
# Supabase-internal roles required by GoTrue, PostgREST, and Storage.
# Runs before database/migrations/ on the first boot of an empty pg volume.
#
# This must be a .sh (not a plain .sql) file: Postgres does not expose Docker
# environment variables as SQL current_setting() values, so the previous
# 00-roles.sql tried `current_setting('POSTGRES_PASSWORD', true)` and always
# got NULL — every role below was created with PASSWORD NULL (i.e. no
# password at all), so GoTrue/PostgREST/Storage could never authenticate.
# A .sh init script runs with the container's real env vars in scope, so we
# pass POSTGRES_PASSWORD in as a psql variable and let psql's `:'var'`
# literal-quoting substitute it into the SQL. Note: psql does NOT perform
# that substitution inside a $$...$$ dollar-quoted block (deliberately, so it
# doesn't collide with PL/pgSQL's `:=` operator) — so passwords are set via
# plain top-level ALTER ROLE statements outside the DO block, not via
# EXECUTE format(...) inside it.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  -v pgpass="${POSTGRES_PASSWORD}" -v pgdb="${POSTGRES_DB}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN CREATEROLE;
  END IF;
END $$;

-- Idempotent-safe: always syncs these roles' passwords to the current
-- POSTGRES_PASSWORD, whether the role was just created above or already existed.
ALTER ROLE authenticator PASSWORD :'pgpass';
ALTER ROLE supabase_auth_admin PASSWORD :'pgpass';
ALTER ROLE supabase_storage_admin PASSWORD :'pgpass';

GRANT anon, authenticated, service_role TO authenticator;

-- Schemas expected by the Supabase services
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;

-- Postgres 15 changed defaults: PUBLIC no longer gets CREATE on the public
-- schema, and a role isn't automatically granted CREATE on the database it
-- didn't create. GoTrue/Storage each run their own internal migrations
-- (creating extensions, tracking tables, etc.) and need both. Owning the
-- `auth`/`storage` schemas above isn't enough on its own — GoTrue's migration
-- tool builds unqualified table names that resolve via each role's
-- search_path, which defaults to `public` unless set explicitly.
GRANT CREATE ON DATABASE :"pgdb" TO supabase_auth_admin, supabase_storage_admin;
ALTER ROLE supabase_auth_admin SET search_path = auth, public, extensions;
ALTER ROLE supabase_storage_admin SET search_path = storage, public, extensions;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
SQL
