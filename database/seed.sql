-- Optional dev seed. Run manually with:
--   docker compose exec -T db psql -U ${POSTGRES_USER} ${POSTGRES_DB} < database/seed.sql
--
-- Baseline reference data. Auth users are NOT created here — use
-- scripts/create-admin.sh (calls the GoTrue Admin API) after the stack is up.

INSERT INTO public.warehouses (name, code, is_default)
VALUES ('Dépôt principal', 'MAIN', true)
ON CONFLICT DO NOTHING;

-- Roles table baseline (application-level roles, not Postgres roles)
INSERT INTO public.roles (key, label, is_system) VALUES
  ('admin',      'Administrateur', true),
  ('employee',   'Employé',        true),
  ('manager',    'Manager',        true),
  ('commercial', 'Commercial',     true),
  ('warehouse',  'Magasinier',     true),
  ('accountant', 'Comptable',      true)
ON CONFLICT (key) DO NOTHING;
