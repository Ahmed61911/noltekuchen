-- Update apply_sale_stock_deferred to include unit_cost
CREATE OR REPLACE FUNCTION public.apply_sale_stock_deferred()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
        p record;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = NEW.sale_id;
  -- Guard against re-applying to a sale whose stock was already taken.
  IF s.stock_applied THEN RETURN NEW; END IF;
  
  IF NEW.product_id IS NOT NULL AND COALESCE(NEW.quantity,0) > 0 THEN
    -- Fetch the current product price to record unit_cost
    SELECT purchase_price INTO p FROM public.products WHERE id = NEW.product_id;
    
    INSERT INTO public.stock_movements
      (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost)
    VALUES
      (NEW.product_id, 'out', NEW.quantity, 'Vente ' || s.sale_number,
       COALESCE(s.created_by, auth.uid()),
       COALESCE(NEW.warehouse_id, s.warehouse_id), s.sale_number, COALESCE(p.purchase_price, 0));
  END IF;
  RETURN NEW;
END $$;
