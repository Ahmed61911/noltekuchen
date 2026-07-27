-- Grant the storage/auth schema access that hosted Supabase ships and our
-- self-hosted bootstrap never applied.
--
-- backend/volumes/db/init/00-roles.sh creates the `storage` and `auth`
-- schemas (owned by supabase_storage_admin / supabase_auth_admin) but never
-- grants anything on them, so:
--   * `authenticated` had no USAGE on schema storage and no privileges at
--     all on storage.objects — every upload/download/list failed. storage-api
--     reports this as the misleading "new row violates row-level security
--     policy", which is what made it look like a policy bug rather than a
--     missing GRANT.
--   * `service_role` had no USAGE on storage either, so server-side code
--     using the service key hit the same wall.
--   * schema `auth` had no USAGE for anyone. Stored RLS policies calling
--     auth.uid() still work — a stored expression already has the function
--     OID bound, so it only rechecks EXECUTE, which is granted — but any
--     freshly-parsed SQL naming auth.uid() fails on the schema lookup.
--
-- RLS stays the actual gate: the storage.objects policies from
-- 20260711164236 are all TO authenticated and admin-scoped for writes, and
-- both buckets are private. These grants only make those policies reachable
-- (a GRANT controls whether a role may touch the object at all; RLS then
-- restricts which rows) — the same distinction 20260723120000 fixed for the
-- public tables.
GRANT USAGE ON SCHEMA storage TO authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
GRANT SELECT ON storage.buckets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets TO service_role;

-- Multipart upload bookkeeping: storage-api writes these for any upload big
-- enough to be chunked, so they need the same reachability as objects.
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.s3_multipart_uploads TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.s3_multipart_uploads_parts TO authenticated, service_role;

-- anon is deliberately left out: both buckets are private and every
-- storage.objects policy is TO authenticated, so anon has nothing to reach.
