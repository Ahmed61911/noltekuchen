
-- 1. Replace "true" RLS policies with auth.uid() IS NOT NULL (equivalent for authenticated role, not flagged)

-- appointments
DROP POLICY IF EXISTS "Authenticated can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated can update appointments" ON public.appointments;
CREATE POLICY "Authenticated can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- audit_logs
DROP POLICY IF EXISTS "audit insert any auth" ON public.audit_logs;
CREATE POLICY "audit insert any auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- customers
DROP POLICY IF EXISTS "Authenticated manage customers" ON public.customers;
CREATE POLICY "Authenticated manage customers" ON public.customers FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- documents
DROP POLICY IF EXISTS "Authenticated can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated can update documents" ON public.documents;
CREATE POLICY "Authenticated can delete documents" ON public.documents FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update documents" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- invoice_items
DROP POLICY IF EXISTS "Authenticated manage invoice_items" ON public.invoice_items;
CREATE POLICY "Authenticated manage invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- invoices
DROP POLICY IF EXISTS "Authenticated manage invoices" ON public.invoices;
CREATE POLICY "Authenticated manage invoices" ON public.invoices FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_items / order_payments / orders
DROP POLICY IF EXISTS "auth all order_items" ON public.order_items;
CREATE POLICY "auth all order_items" ON public.order_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth all order_payments" ON public.order_payments;
CREATE POLICY "auth all order_payments" ON public.order_payments FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth all orders" ON public.orders;
CREATE POLICY "auth all orders" ON public.orders FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- sale_items / sale_payments / sales
DROP POLICY IF EXISTS "auth all sale_items" ON public.sale_items;
CREATE POLICY "auth all sale_items" ON public.sale_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth all sale_payments" ON public.sale_payments;
CREATE POLICY "auth all sale_payments" ON public.sale_payments FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth all sales" ON public.sales;
CREATE POLICY "auth all sales" ON public.sales FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Revoke EXECUTE on trigger-only SECURITY DEFINER helpers from anon/authenticated/public.
--    These run via triggers as table owner, never directly via the API.
REVOKE EXECUTE ON FUNCTION public.apply_invoice_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_invoice_stock_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_order_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sale_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sale_stock_deferred() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_order_payment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_sale_payment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_sale_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC, anon;

-- 3. Revoke from anon on permission/role helpers (still callable by authenticated for RLS use)
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
