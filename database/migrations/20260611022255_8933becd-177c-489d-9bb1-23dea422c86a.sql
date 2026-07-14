
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blocked')),
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 2. Add new enum values (must be committed before use; we use TEXT in permission tables to bypass)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commercial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';

-- 3. permissions catalog
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module, action)
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perms readable by authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "perms admin manage" ON public.permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. role_permissions (role stored as text to avoid enum-in-same-tx restriction)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp read auth" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp admin manage" ON public.role_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. user_permissions overrides
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_id)
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "up self read" ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "up admin manage" ON public.user_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 6. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit self or admin read" ON public.audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert any auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_module_idx ON public.audit_logs(module, created_at DESC);

-- 7. has_permission function (uses TEXT role)
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH perm AS (SELECT id FROM public.permissions WHERE module = _module AND action = _action),
       override AS (
         SELECT granted FROM public.user_permissions up
         JOIN perm ON perm.id = up.permission_id
         WHERE up.user_id = _user_id
         LIMIT 1
       )
  SELECT COALESCE(
    (SELECT granted FROM override),
    EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN perm ON perm.id = rp.permission_id
      JOIN public.user_roles ur ON ur.role::text = rp.role AND ur.user_id = _user_id
    )
  )
$$;

-- 8. Seed permissions catalog
INSERT INTO public.permissions (module, action, label) VALUES
  ('products','view','Voir produits'),
  ('products','create','Ajouter produits'),
  ('products','update','Modifier produits'),
  ('products','delete','Supprimer produits'),
  ('stock','view','Voir stock'),
  ('stock','in','Entrée stock'),
  ('stock','out','Sortie stock'),
  ('stock','adjust','Ajustement inventaire'),
  ('orders','view','Voir commandes'),
  ('orders','create','Créer commandes'),
  ('orders','update','Modifier commandes'),
  ('orders','cancel','Annuler commandes'),
  ('orders','validate','Valider commandes'),
  ('sales','view','Voir ventes'),
  ('sales','create','Créer ventes'),
  ('sales','update','Modifier ventes'),
  ('sales','delete','Supprimer ventes'),
  ('sales','invoice','Générer facture'),
  ('customers','view','Voir clients'),
  ('customers','create','Ajouter clients'),
  ('customers','update','Modifier clients'),
  ('customers','delete','Supprimer clients'),
  ('suppliers','view','Voir fournisseurs'),
  ('suppliers','create','Ajouter fournisseurs'),
  ('suppliers','update','Modifier fournisseurs'),
  ('suppliers','delete','Supprimer fournisseurs'),
  ('reports','view','Consulter rapports'),
  ('reports','export_pdf','Exporter PDF'),
  ('reports','export_excel','Exporter Excel'),
  ('users','view','Voir utilisateurs'),
  ('users','create','Créer utilisateurs'),
  ('users','update','Modifier utilisateurs'),
  ('users','delete','Supprimer utilisateurs'),
  ('users','manage_permissions','Gérer permissions')
ON CONFLICT (module, action) DO NOTHING;

-- 9. Seed role_permissions
-- admin: all
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- manager: everything except users
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', id FROM public.permissions WHERE module <> 'users'
ON CONFLICT DO NOTHING;

-- commercial: sales/customers/orders full, products view
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'commercial', id FROM public.permissions
WHERE module IN ('sales','customers','orders')
   OR (module='products' AND action='view')
   OR (module='reports' AND action='view')
ON CONFLICT DO NOTHING;

-- warehouse
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'warehouse', id FROM public.permissions
WHERE module='stock'
   OR (module='products' AND action IN ('view','update'))
   OR (module='orders' AND action IN ('view','validate'))
   OR (module='suppliers' AND action='view')
ON CONFLICT DO NOTHING;

-- accountant
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'accountant', id FROM public.permissions
WHERE (module='sales' AND action IN ('view','invoice'))
   OR module='reports'
   OR (module='customers' AND action='view')
ON CONFLICT DO NOTHING;

-- employee (utilisateur standard): view only
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee', id FROM public.permissions
WHERE action='view' AND module IN ('products','customers','orders','sales')
ON CONFLICT DO NOTHING;
