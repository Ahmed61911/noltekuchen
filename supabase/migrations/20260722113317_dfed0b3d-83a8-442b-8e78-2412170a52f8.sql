ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);

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
    FOR item IN SELECT product_id, quantity, warehouse_id FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Facture ' || NEW.invoice_number, uid, COALESCE(item.warehouse_id, NEW.warehouse_id), NEW.invoice_number);
    END LOOP;
    NEW.stock_applied := true;
  ELSIF should_revert THEN
    FOR item IN SELECT product_id, quantity, warehouse_id FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'in', GREATEST(1, ceil(item.quantity)::int), 'Annulation facture ' || NEW.invoice_number, uid, COALESCE(item.warehouse_id, NEW.warehouse_id), NEW.invoice_number);
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
    FOR item IN SELECT product_id, quantity, warehouse_id FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Facture ' || NEW.invoice_number, uid, COALESCE(item.warehouse_id, NEW.warehouse_id), NEW.invoice_number);
    END LOOP;
    UPDATE public.invoices SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;