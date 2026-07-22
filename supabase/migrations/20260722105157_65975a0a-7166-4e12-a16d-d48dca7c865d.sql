
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_warehouse ON public.order_items(warehouse_id);

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
    FOR item IN SELECT product_id, quantity, warehouse_id FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Commande ' || NEW.order_number, uid, COALESCE(item.warehouse_id, NEW.warehouse_id), NEW.order_number);
    END LOOP;
    NEW.stock_applied := true;
  ELSIF NEW.status = 'cancelled' AND NEW.stock_applied THEN
    FOR item IN SELECT product_id, quantity, warehouse_id FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'in', GREATEST(1, ceil(item.quantity)::int), 'Annulation commande ' || NEW.order_number, uid, COALESCE(item.warehouse_id, NEW.warehouse_id), NEW.order_number);
    END LOOP;
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END $function$;
