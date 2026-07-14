
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_warehouse ON public.orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_warehouse ON public.sales(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_invoices_warehouse ON public.invoices(warehouse_id);

-- Update triggers to pass warehouse_id into stock_movements
CREATE OR REPLACE FUNCTION public.apply_sale_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE item record; uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
  IF NOT NEW.stock_applied THEN
    FOR item IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Vente ' || NEW.sale_number, uid, NEW.warehouse_id, NEW.sale_number);
    END LOOP;
    UPDATE public.sales SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_sale_stock_deferred()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s record; uid uuid;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = NEW.sale_id;
  IF s.stock_applied THEN RETURN NEW; END IF;
  IF NEW.product_id IS NOT NULL THEN
    uid := COALESCE(s.created_by, auth.uid());
    INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
    VALUES (NEW.product_id, 'out', GREATEST(1, ceil(NEW.quantity)::int), 'Vente ' || s.sale_number, uid, s.warehouse_id, s.sale_number);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_order_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE item record; uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
  IF NEW.status = 'delivered' AND NOT NEW.stock_applied THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Commande ' || NEW.order_number, uid, NEW.warehouse_id, NEW.order_number);
    END LOOP;
    NEW.stock_applied := true;
  ELSIF NEW.status = 'cancelled' AND NEW.stock_applied THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'in', GREATEST(1, ceil(item.quantity)::int), 'Annulation commande ' || NEW.order_number, uid, NEW.warehouse_id, NEW.order_number);
    END LOOP;
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_invoice_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE item record; should_apply boolean; should_revert boolean; uid uuid;
BEGIN
  should_apply := (NEW.status IN ('pending','paid')) AND NOT NEW.stock_applied;
  should_revert := (NEW.status = 'cancelled') AND NEW.stock_applied;
  uid := COALESCE(NEW.created_by, auth.uid());
  IF should_apply THEN
    FOR item IN SELECT product_id, quantity FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Facture ' || NEW.invoice_number, uid, NEW.warehouse_id, NEW.invoice_number);
    END LOOP;
    NEW.stock_applied := true;
  ELSIF should_revert THEN
    FOR item IN SELECT product_id, quantity FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'in', GREATEST(1, ceil(item.quantity)::int), 'Annulation facture ' || NEW.invoice_number, uid, NEW.warehouse_id, NEW.invoice_number);
    END LOOP;
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_invoice_stock_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE item record; uid uuid;
BEGIN
  IF NEW.status IN ('pending','paid') AND NOT NEW.stock_applied THEN
    uid := COALESCE(NEW.created_by, auth.uid());
    FOR item IN SELECT product_id, quantity FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Facture ' || NEW.invoice_number, uid, NEW.warehouse_id, NEW.invoice_number);
    END LOOP;
    UPDATE public.invoices SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;
