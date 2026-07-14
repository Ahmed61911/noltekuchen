
-- 1. Roles table
CREATE TABLE IF NOT EXISTS public.roles (
  key text PRIMARY KEY,
  label text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles read auth" ON public.roles;
DROP POLICY IF EXISTS "roles admin manage" ON public.roles;
CREATE POLICY "roles read auth" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles admin manage" ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed system + legacy roles
INSERT INTO public.roles (key, label, is_system) VALUES
  ('admin','Admin',true),
  ('manager','Manager',true),
  ('commercial','Commercial',true),
  ('warehouse','Magasinier',false),
  ('accountant','Comptable',false),
  ('employee','Employé',false)
ON CONFLICT (key) DO NOTHING;

-- 2. Extend permissions catalog to standard 6 actions per module
INSERT INTO public.permissions (module, action, label) VALUES
  ('products','export','Exporter produits'),('products','print','Imprimer produits'),
  ('stock','create','Ajouter mouvement stock'),('stock','update','Modifier stock'),('stock','delete','Supprimer stock'),('stock','export','Exporter stock'),('stock','print','Imprimer stock'),
  ('sales','export','Exporter ventes'),('sales','print','Imprimer ventes'),
  ('orders','delete','Supprimer commandes'),('orders','export','Exporter commandes'),('orders','print','Imprimer commandes'),
  ('customers','export','Exporter clients'),('customers','print','Imprimer clients'),
  ('suppliers','export','Exporter fournisseurs'),('suppliers','print','Imprimer fournisseurs'),
  ('reports','create','Créer rapport'),('reports','update','Modifier rapport'),('reports','delete','Supprimer rapport'),('reports','export','Exporter rapport'),('reports','print','Imprimer rapport'),
  ('users','export','Exporter utilisateurs'),('users','print','Imprimer utilisateurs')
ON CONFLICT (module, action) DO NOTHING;

-- 3. user_roles: allow custom roles via role_key
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_key text;
UPDATE public.user_roles SET role_key = role::text WHERE role_key IS NULL;

-- One role per user (drop old (user_id, role) uniqueness)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_unique') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 4. Update permission check: admin => true; else check by role_key/role
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH perm AS (SELECT id FROM public.permissions WHERE module=_module AND action=_action),
       override AS (
         SELECT granted FROM public.user_permissions up
         JOIN perm ON perm.id = up.permission_id
         WHERE up.user_id = _user_id LIMIT 1
       )
  SELECT COALESCE(
    (SELECT granted FROM override),
    (SELECT true WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=_user_id AND ur.role='admin'::app_role)),
    EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN perm ON perm.id = rp.permission_id
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE rp.role = COALESCE(ur.role_key, ur.role::text)
    ),
    false
  );
$$;

-- Bulk permission map for a user (used by client to hide UI)
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(module text, action text, allowed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.module, p.action, public.user_has_permission(_user_id, p.module, p.action)
  FROM public.permissions p;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;

-- 5. Seed default role_permissions for manager & commercial
DELETE FROM public.role_permissions WHERE role IN ('manager','commercial');

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', id FROM public.permissions WHERE module <> 'users'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'commercial', id FROM public.permissions
WHERE (module IN ('sales','customers','orders') AND action IN ('view','create','update','export','print'))
   OR (module = 'products' AND action IN ('view','export','print'))
ON CONFLICT DO NOTHING;
