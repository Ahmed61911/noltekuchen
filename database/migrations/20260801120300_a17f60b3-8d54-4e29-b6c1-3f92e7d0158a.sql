-- Atomic document creation for sales, orders and invoices.
--
-- Each of these was built client-side as 3-4 sequential HTTP calls with no
-- transaction: insert header -> insert items -> insert payment -> flag. Any
-- failure part-way left a document that is wrong in a way nothing repairs:
--   * a header with no lines, having already consumed a document number;
--   * for sales specifically, items inserted (so stock was deducted) but the
--     stock_applied flag never set — which then lets a later item insert
--     deduct the same goods a second time, and stops the delete trigger
--     from giving the stock back.
--
-- A function body is a single transaction, so all of it commits or none of
-- it does. SECURITY INVOKER (not DEFINER) on purpose: these run as the
-- caller, so every RLS policy still applies exactly as it did when the
-- client issued the inserts itself. This buys atomicity, not privilege.

-- ---------------------------------------------------------------- sales ---
CREATE OR REPLACE FUNCTION public.create_sale(_sale jsonb, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE new_id uuid; paid numeric;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins une ligne' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.sales (
    customer_id, sale_date, payment_due_date, payment_method, payment_status,
    subtotal_ht, tax_amount, total_ttc, paid_amount, notes, created_by, warehouse_id
  ) VALUES (
    NULLIF(_sale->>'customer_id','')::uuid,
    COALESCE((_sale->>'sale_date')::date, CURRENT_DATE),
    NULLIF(_sale->>'payment_due_date','')::date,
    COALESCE(_sale->>'payment_method','cash')::payment_method,
    COALESCE(_sale->>'payment_status','unpaid')::payment_status,
    COALESCE((_sale->>'subtotal_ht')::numeric, 0),
    COALESCE((_sale->>'tax_amount')::numeric, 0),
    COALESCE((_sale->>'total_ttc')::numeric, 0),
    COALESCE((_sale->>'paid_amount')::numeric, 0),
    NULLIF(_sale->>'notes',''),
    auth.uid(),
    NULLIF(_sale->>'warehouse_id','')::uuid
  ) RETURNING id, paid_amount INTO new_id, paid;

  -- The per-item stock trigger reads sales.stock_applied, which is still
  -- false here, so every line of this batch moves stock exactly once.
  INSERT INTO public.sale_items (
    sale_id, product_id, description, quantity, unit_price, tax_rate,
    discount_rate, line_total_ht, line_tax, line_total_ttc, warehouse_id
  )
  SELECT new_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_price')::numeric, 0),
         COALESCE((x->>'tax_rate')::numeric, 0),
         COALESCE((x->>'discount_rate')::numeric, 0),
         COALESCE((x->>'line_total_ht')::numeric, 0),
         COALESCE((x->>'line_tax')::numeric, 0),
         COALESCE((x->>'line_total_ttc')::numeric, 0),
         NULLIF(x->>'warehouse_id','')::uuid
    FROM jsonb_array_elements(_items) x;

  UPDATE public.sales SET stock_applied = true WHERE id = new_id;

  -- Recorded as a real payment so sync_sale_payment_status owns paid_amount
  -- and payment_status; the client no longer computes them separately.
  IF paid > 0 THEN
    INSERT INTO public.sale_payments (sale_id, amount, method, created_by)
    VALUES (new_id, paid, COALESCE(_sale->>'payment_method','cash')::payment_method, auth.uid());
  END IF;

  RETURN new_id;
END $$;

-- --------------------------------------------------------------- orders ---
CREATE OR REPLACE FUNCTION public.create_order(_order jsonb, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE new_id uuid; paid numeric;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins une ligne' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.orders (
    customer_id, order_date, due_date, status, payment_status,
    subtotal_ht, tax_amount, total_ttc, paid_amount, notes, created_by, warehouse_id
  ) VALUES (
    NULLIF(_order->>'customer_id','')::uuid,
    COALESCE((_order->>'order_date')::date, CURRENT_DATE),
    NULLIF(_order->>'due_date','')::date,
    COALESCE(_order->>'status','pending')::order_status,
    COALESCE(_order->>'payment_status','unpaid')::payment_status,
    COALESCE((_order->>'subtotal_ht')::numeric, 0),
    COALESCE((_order->>'tax_amount')::numeric, 0),
    COALESCE((_order->>'total_ttc')::numeric, 0),
    COALESCE((_order->>'paid_amount')::numeric, 0),
    NULLIF(_order->>'notes',''),
    auth.uid(),
    NULLIF(_order->>'warehouse_id','')::uuid
  ) RETURNING id, paid_amount INTO new_id, paid;

  INSERT INTO public.order_items (
    order_id, product_id, description, quantity, unit_price, tax_rate,
    discount_rate, line_total_ht, line_tax, line_total_ttc, warehouse_id
  )
  SELECT new_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_price')::numeric, 0),
         COALESCE((x->>'tax_rate')::numeric, 0),
         COALESCE((x->>'discount_rate')::numeric, 0),
         COALESCE((x->>'line_total_ht')::numeric, 0),
         COALESCE((x->>'line_tax')::numeric, 0),
         COALESCE((x->>'line_total_ttc')::numeric, 0),
         NULLIF(x->>'warehouse_id','')::uuid
    FROM jsonb_array_elements(_items) x;

  IF paid > 0 THEN
    INSERT INTO public.order_payments (order_id, amount, method, created_by)
    VALUES (new_id, paid, COALESCE(_order->>'payment_method','cash')::payment_method, auth.uid());
  END IF;

  RETURN new_id;
END $$;

-- ------------------------------------------------------------- invoices ---
CREATE OR REPLACE FUNCTION public.create_invoice(_invoice jsonb, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE new_id uuid; wanted invoice_status;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins une ligne' USING ERRCODE = '23514';
  END IF;

  wanted := COALESCE(_invoice->>'status','draft')::invoice_status;

  -- Always born as draft: the stock trigger fires on the status transition
  -- below, by which point the line items exist. Creating it directly as
  -- pending/paid would move stock for an invoice that has no lines yet.
  INSERT INTO public.invoices (
    customer_id, invoice_date, due_date, status,
    subtotal_ht, tax_amount, total_ttc, notes, created_by, warehouse_id,
    source_sale_id
  ) VALUES (
    NULLIF(_invoice->>'customer_id','')::uuid,
    COALESCE((_invoice->>'invoice_date')::date, CURRENT_DATE),
    COALESCE((_invoice->>'due_date')::date, CURRENT_DATE),
    'draft',
    COALESCE((_invoice->>'subtotal_ht')::numeric, 0),
    COALESCE((_invoice->>'tax_amount')::numeric, 0),
    COALESCE((_invoice->>'total_ttc')::numeric, 0),
    NULLIF(_invoice->>'notes',''),
    auth.uid(),
    NULLIF(_invoice->>'warehouse_id','')::uuid,
    NULLIF(_invoice->>'source_sale_id','')::uuid
  ) RETURNING id INTO new_id;

  INSERT INTO public.invoice_items (
    invoice_id, product_id, description, quantity, unit_price, tax_rate,
    discount_rate, line_total_ht, line_tax, line_total_ttc, warehouse_id
  )
  SELECT new_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_price')::numeric, 0),
         COALESCE((x->>'tax_rate')::numeric, 0),
         COALESCE((x->>'discount_rate')::numeric, 0),
         COALESCE((x->>'line_total_ht')::numeric, 0),
         COALESCE((x->>'line_tax')::numeric, 0),
         COALESCE((x->>'line_total_ttc')::numeric, 0),
         NULLIF(x->>'warehouse_id','')::uuid
    FROM jsonb_array_elements(_items) x;

  IF wanted <> 'draft' THEN
    UPDATE public.invoices SET status = wanted WHERE id = new_id;
  END IF;

  RETURN new_id;
END $$;

-- Explicit grants, never relying on the implicit PUBLIC EXECUTE — a REVOKE
-- FROM PUBLIC elsewhere would otherwise silently take these away too.
GRANT EXECUTE ON FUNCTION public.create_sale(jsonb, jsonb)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, jsonb)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice(jsonb, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_sale(jsonb, jsonb)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb, jsonb)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_invoice(jsonb, jsonb) FROM PUBLIC, anon;
