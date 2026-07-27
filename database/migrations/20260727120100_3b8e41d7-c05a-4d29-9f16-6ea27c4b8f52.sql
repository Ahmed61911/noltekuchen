-- Restore EXECUTE on public.user_has_permission to `authenticated`.
--
-- Migrations 20260627142329 and 20260711164236 both ran
--   REVOKE EXECUTE ON FUNCTION public.user_has_permission(...) FROM PUBLIC, anon;
-- intending only to lock out anonymous callers — 20260711164236 even says
-- "keep authenticated EXECUTE ... (used by app RLS/UI)". But that comment
-- assumed `authenticated` held an explicit grant. It never did: its only
-- access was the implicit EXECUTE that PostgreSQL grants to PUBLIC on every
-- new function, so revoking PUBLIC revoked it for authenticated too.
-- (has_role and get_user_permissions survived the identical REVOKE only
-- because 20260510190607 and 20260702122250 had granted them to
-- authenticated explicitly.)
--
-- Effect: ~75 RLS policies across customers, suppliers, stock_movements,
-- orders, order_items, order_payments, invoices, invoice_items, quotes,
-- quote_items, sales, sale_items, sale_payments, purchase_orders,
-- purchase_order_items, projects, project_stages, project_attachments and
-- project_activity call this function, so every read and write against
-- those tables failed with "permission denied for function
-- user_has_permission" for every logged-in user — admins included, since
-- the admin short-circuit lives *inside* the function that can't be called.
GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, text, text) TO authenticated;

-- Re-assert the other two so all three are explicit and survive any future
-- REVOKE ... FROM PUBLIC. Both are already granted; this is a no-op today.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;

-- anon must stay locked out — these drive authorization decisions.
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(uuid) FROM PUBLIC, anon;
