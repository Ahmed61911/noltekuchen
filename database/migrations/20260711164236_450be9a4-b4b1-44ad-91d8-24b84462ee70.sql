
-- ============ 1) Revoke EXECUTE on internal SECURITY DEFINER trigger/helper functions ============
REVOKE EXECUTE ON FUNCTION public.apply_purchase_order_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_project_progress() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_project_stages() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text, text) FROM PUBLIC, anon;
-- keep authenticated EXECUTE on has_role/user_has_permission/get_user_permissions (used by app RLS/UI)

-- ============ 2) Appointments — scope to owner/assignee/admin ============
DROP POLICY IF EXISTS "Authenticated can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated can delete appointments" ON public.appointments;

CREATE POLICY "appointments_select_own_or_admin" ON public.appointments FOR SELECT TO authenticated
USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "appointments_insert_self" ON public.appointments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "appointments_update_own_or_admin" ON public.appointments FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_role(auth.uid(),'admin'))
WITH CHECK (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "appointments_delete_own_or_admin" ON public.appointments FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

-- ============ 3) Customers — permission-based ============
DROP POLICY IF EXISTS "Authenticated read customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated manage customers" ON public.customers;

CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'customers','view'));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'customers','create'));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'customers','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'customers','update'));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'customers','delete'));

-- ============ 4) Documents — creator or admin ============
DROP POLICY IF EXISTS "Authenticated can read documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated can update documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated can delete documents" ON public.documents;

CREATE POLICY "documents_select_own_or_admin" ON public.documents FOR SELECT TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "documents_insert_self" ON public.documents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);
CREATE POLICY "documents_update_own_or_admin" ON public.documents FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'))
WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "documents_delete_own_or_admin" ON public.documents FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

-- document_history follows document ownership
DROP POLICY IF EXISTS "auth read history" ON public.document_history;
DROP POLICY IF EXISTS "auth insert history" ON public.document_history;
CREATE POLICY "document_history_select" ON public.document_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id
  AND (d.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "document_history_insert" ON public.document_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============ 5) Invoices — permission-based (sales module) ============
DROP POLICY IF EXISTS "Authenticated read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated read invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated manage invoice_items" ON public.invoice_items;

CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','view'));
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'sales','create'));
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'sales','update'));
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','delete'));

CREATE POLICY "invoice_items_select" ON public.invoice_items FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','view'));
CREATE POLICY "invoice_items_insert" ON public.invoice_items FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'sales','create'));
CREATE POLICY "invoice_items_update" ON public.invoice_items FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'sales','update'));
CREATE POLICY "invoice_items_delete" ON public.invoice_items FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','delete'));

-- ============ 6) Orders (+items, payments) ============
DROP POLICY IF EXISTS "auth all orders" ON public.orders;
DROP POLICY IF EXISTS "auth all order_items" ON public.order_items;
DROP POLICY IF EXISTS "auth all order_payments" ON public.order_payments;

CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'orders','view'));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'orders','create'));
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'orders','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'orders','update'));
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'orders','delete'));

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'orders','view'));
CREATE POLICY "order_items_write" ON public.order_items FOR ALL TO authenticated
USING (public.user_has_permission(auth.uid(),'orders','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'orders','update'));

CREATE POLICY "order_payments_select" ON public.order_payments FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'orders','view'));
CREATE POLICY "order_payments_write" ON public.order_payments FOR ALL TO authenticated
USING (public.user_has_permission(auth.uid(),'orders','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'orders','update'));

-- ============ 7) Sales (+items, payments) ============
DROP POLICY IF EXISTS "auth all sales" ON public.sales;
DROP POLICY IF EXISTS "auth all sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "auth all sale_payments" ON public.sale_payments;

CREATE POLICY "sales_select" ON public.sales FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','view'));
CREATE POLICY "sales_insert" ON public.sales FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'sales','create'));
CREATE POLICY "sales_update" ON public.sales FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'sales','update'));
CREATE POLICY "sales_delete" ON public.sales FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','delete'));

CREATE POLICY "sale_items_select" ON public.sale_items FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','view'));
CREATE POLICY "sale_items_write" ON public.sale_items FOR ALL TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'sales','update'));

CREATE POLICY "sale_payments_select" ON public.sale_payments FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','view'));
CREATE POLICY "sale_payments_write" ON public.sale_payments FOR ALL TO authenticated
USING (public.user_has_permission(auth.uid(),'sales','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'sales','update'));

-- ============ 8) Projects / Quotes / Purchase orders — permission-based ============
DROP POLICY IF EXISTS "projects_auth_all" ON public.projects;
DROP POLICY IF EXISTS "project_stages_auth_all" ON public.project_stages;
DROP POLICY IF EXISTS "project_attachments_auth_all" ON public.project_attachments;
DROP POLICY IF EXISTS "project_activity_auth_all" ON public.project_activity;
DROP POLICY IF EXISTS "quotes_auth_all" ON public.quotes;
DROP POLICY IF EXISTS "quote_items_auth_all" ON public.quote_items;
DROP POLICY IF EXISTS "purchase_orders_auth_all" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_order_items_auth_all" ON public.purchase_order_items;

CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'projects','view'));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'projects','create'));
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'projects','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'projects','update'));
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'projects','delete'));

CREATE POLICY "project_stages_select" ON public.project_stages FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'projects','view'));
CREATE POLICY "project_stages_write" ON public.project_stages FOR ALL TO authenticated
USING (public.user_has_permission(auth.uid(),'projects','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'projects','update'));

CREATE POLICY "project_attachments_select" ON public.project_attachments FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'projects','view'));
CREATE POLICY "project_attachments_write" ON public.project_attachments FOR ALL TO authenticated
USING (public.user_has_permission(auth.uid(),'projects','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'projects','update'));

CREATE POLICY "project_activity_select" ON public.project_activity FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'projects','view'));
CREATE POLICY "project_activity_insert" ON public.project_activity FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'projects','update'));

CREATE POLICY "quotes_select" ON public.quotes FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'quotes','view'));
CREATE POLICY "quotes_insert" ON public.quotes FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'quotes','create'));
CREATE POLICY "quotes_update" ON public.quotes FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'quotes','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'quotes','update'));
CREATE POLICY "quotes_delete" ON public.quotes FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'quotes','delete'));

CREATE POLICY "quote_items_select" ON public.quote_items FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'quotes','view'));
CREATE POLICY "quote_items_write" ON public.quote_items FOR ALL TO authenticated
USING (public.user_has_permission(auth.uid(),'quotes','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'quotes','update'));

CREATE POLICY "purchase_orders_select" ON public.purchase_orders FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'purchase_orders','view'));
CREATE POLICY "purchase_orders_insert" ON public.purchase_orders FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'purchase_orders','create'));
CREATE POLICY "purchase_orders_update" ON public.purchase_orders FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'purchase_orders','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'purchase_orders','update'));
CREATE POLICY "purchase_orders_delete" ON public.purchase_orders FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'purchase_orders','delete'));

CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'purchase_orders','view'));
CREATE POLICY "purchase_order_items_write" ON public.purchase_order_items FOR ALL TO authenticated
USING (public.user_has_permission(auth.uid(),'purchase_orders','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'purchase_orders','update'));

-- ============ 9) Stock movements — permission-based ============
DROP POLICY IF EXISTS "Authenticated read movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Authenticated insert movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins manage movements" ON public.stock_movements;

CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'stock','view'));
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'stock','create') AND auth.uid() = user_id);
CREATE POLICY "stock_movements_admin_manage" ON public.stock_movements FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ 10) Suppliers — permission-based ============
DROP POLICY IF EXISTS "Authenticated read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins manage suppliers" ON public.suppliers;

CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(),'suppliers','view'));
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (public.user_has_permission(auth.uid(),'suppliers','create'));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(),'suppliers','update'))
WITH CHECK (public.user_has_permission(auth.uid(),'suppliers','update'));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(),'suppliers','delete'));

-- ============ 11) Storage bucket policies — tighten ownership/role ============
-- product-images: read any authenticated, writes admin-only
DROP POLICY IF EXISTS "Auth users can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete product images" ON storage.objects;

CREATE POLICY "product_images_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-images');
CREATE POLICY "product_images_insert_admin" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "product_images_update_admin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "product_images_delete_admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));

-- documents bucket: owner (uploader) or admin
DROP POLICY IF EXISTS "Auth read documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Auth update documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete documents bucket" ON storage.objects;

CREATE POLICY "documents_bucket_select_owner_admin" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "documents_bucket_insert_self" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND owner = auth.uid());
CREATE POLICY "documents_bucket_update_owner_admin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')))
WITH CHECK (bucket_id = 'documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "documents_bucket_delete_owner_admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
