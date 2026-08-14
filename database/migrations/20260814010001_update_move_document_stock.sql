-- Update move_document_stock to include unit_cost
CREATE OR REPLACE FUNCTION public.move_document_stock(
  _items_table text, _fk_col text, _doc_id uuid,
  _dir public.movement_type, _reason text, _uid uuid,
  _doc_warehouse uuid, _ref text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item record; has_wh boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _items_table
      AND column_name = 'warehouse_id'
  ) INTO has_wh;

  FOR item IN EXECUTE format(
    'SELECT i.product_id, i.quantity, %s AS warehouse_id, p.purchase_price
       FROM public.%I i
       LEFT JOIN public.products p ON i.product_id = p.id
       WHERE i.%I = $1 AND i.product_id IS NOT NULL',
    CASE WHEN has_wh THEN 'i.warehouse_id' ELSE 'NULL::uuid' END,
    _items_table, _fk_col
  ) USING _doc_id
  LOOP
    -- Skip zero/NULL lines instead of coercing them to 1 unit.
    IF COALESCE(item.quantity, 0) > 0 THEN
      INSERT INTO public.stock_movements
        (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost)
      VALUES
        (item.product_id, _dir, item.quantity, _reason, _uid,
         COALESCE(item.warehouse_id, _doc_warehouse), _ref, COALESCE(item.purchase_price, 0));
    END IF;
  END LOOP;
END $$;
