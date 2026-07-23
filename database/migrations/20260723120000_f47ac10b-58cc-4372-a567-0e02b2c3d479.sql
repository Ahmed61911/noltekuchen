-- Migration 20260510190532 (the very first one) created categories,
-- products, profiles, stock_movements, suppliers, and user_roles with RLS
-- policies but never granted `authenticated` base table access — every
-- later migration correctly includes this GRANT, but this one predates
-- that convention. Without it, those RLS policies are unreachable (a GRANT
-- controls whether a role can touch the table at all; RLS then further
-- restricts which rows), so every authenticated user — including admins —
-- gets "permission denied" just reading their own role or profile, or any
-- product/category/supplier/stock-movement row.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
