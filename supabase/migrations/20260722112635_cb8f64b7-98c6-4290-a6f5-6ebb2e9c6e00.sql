
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sale_items_warehouse ON public.sale_items(warehouse_id);

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
    FOR item IN SELECT product_id, quantity, warehouse_id FROM public.sale_items WHERE sale_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Vente ' || NEW.sale_number, uid, COALESCE(item.warehouse_id, NEW.warehouse_id), NEW.sale_number);
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
    VALUES (NEW.product_id, 'out', GREATEST(1, ceil(NEW.quantity)::int), 'Vente ' || s.sale_number, uid, COALESCE(NEW.warehouse_id, s.warehouse_id), s.sale_number);
  END IF;
  RETURN NEW;
END $function$;
