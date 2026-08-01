-- Three unrelated correctness fixes that each stand alone.

-- ============================================================ 1. ROLES ====
-- Migration 20260702122250 added quotes / projects / purchase_orders to the
-- permissions catalogue but never granted them to any role. Every non-admin
-- role therefore had zero access to those three modules — not even 'view'.
-- Admins were unaffected only because user_has_permission short-circuits
-- admin => true, which is exactly why this went unnoticed.
--
-- Verified before the fix: user_has_permission(<manager>,'quotes','view')
-- returned false while the same call for an admin returned true.

-- admin gets everything, including actions added after the original seed
-- (export/print), which had left admin with *fewer* rows than manager.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- manager: everything except user administration.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', id FROM public.permissions WHERE module <> 'users'
ON CONFLICT DO NOTHING;

-- commercial: owns quotes, sees the rest.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'commercial', id FROM public.permissions
WHERE module = 'quotes'
   OR (module IN ('projects','purchase_orders') AND action = 'view')
ON CONFLICT DO NOTHING;

-- warehouse: works purchase orders, sees projects.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'warehouse', id FROM public.permissions
WHERE (module = 'purchase_orders' AND action IN ('view','create','update'))
   OR (module = 'projects' AND action = 'view')
ON CONFLICT DO NOTHING;

-- accountant: read and report, no editing.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'accountant', id FROM public.permissions
WHERE (module = 'quotes' AND action IN ('view','export','print'))
   OR (module IN ('purchase_orders','projects') AND action = 'view')
ON CONFLICT DO NOTHING;

-- employee: read-only.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'employee', id FROM public.permissions
WHERE module IN ('quotes','projects') AND action = 'view'
ON CONFLICT DO NOTHING;

-- ============================================================ 2. AUDIT ====
-- The INSERT policy was WITH CHECK (auth.uid() IS NOT NULL) — it never tied
-- the row to its author, so any authenticated user could write audit entries
-- attributed to a colleague. Since non-admins can only read their own rows,
-- a forged entry was also hard to notice.
DROP POLICY IF EXISTS "audit insert any auth" ON public.audit_logs;
CREATE POLICY "audit insert self" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- An audit trail nobody can rewrite: no UPDATE or DELETE policy exists, so
-- entries are append-only for every non-superuser role. Stated explicitly
-- here so a future migration does not "helpfully" add one.
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- ========================================================== 3. PAYMENTS ===
-- sync_order_payment_status / sync_sale_payment_status already COALESCE over
-- OLD, i.e. they were written for INSERT *and* UPDATE *and* DELETE — but both
-- were only ever wired to AFTER INSERT. Editing or deleting a payment left
-- paid_amount and payment_status stale, showing an invoice as paid after its
-- payment had been removed.
DROP TRIGGER IF EXISTS trg_order_payments_sync ON public.order_payments;
CREATE TRIGGER trg_order_payments_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.order_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_payment_status();

DROP TRIGGER IF EXISTS trg_sale_payments_sync ON public.sale_payments;
CREATE TRIGGER trg_sale_payments_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_sale_payment_status();
