-- Creating a vente now also creates a validated commande behind it, so every
-- vente has a bon de commande to print and can be marked "livrée" (which is
-- what actually moves the stock out — the commande owns the stock, exactly like
-- the devis -> commande -> vente flow).
--
-- The vente is linked to the commande (order_id set), which makes it
-- stock-neutral: nothing leaves stock at creation. Stock leaves when the
-- commande is delivered.

CREATE OR REPLACE FUNCTION public.create_sale_with_order(_sale jsonb, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  new_order_id uuid;
  order_num    text;
  new_sale_id  uuid;
  sale_num     text;
  cust  uuid;
  wh    uuid;
  s_date date;
  due   date;
  total numeric;
  paid  numeric;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins une ligne' USING ERRCODE = '23514';
  END IF;

  cust   := NULLIF(_sale->>'customer_id','')::uuid;
  wh     := NULLIF(_sale->>'warehouse_id','')::uuid;
  s_date := COALESCE((_sale->>'sale_date')::date, CURRENT_DATE);
  due    := COALESCE(NULLIF(_sale->>'payment_due_date','')::date, (s_date + INTERVAL '30 days')::date);
  total  := COALESCE((_sale->>'total_ttc')::numeric, 0);
  paid   := COALESCE((_sale->>'paid_amount')::numeric, 0);

  -- 1. Validated commande (owns the stock; nothing moves until it is delivered)
  INSERT INTO public.orders (
    customer_id, order_date, due_date, status, payment_status,
    total_ttc, paid_amount, stock_applied, notes, created_by, warehouse_id
  ) VALUES (
    cust, s_date, due, 'validated',
    COALESCE(_sale->>'payment_status','unpaid')::payment_status,
    total, paid, false, NULLIF(_sale->>'notes',''), auth.uid(), wh
  ) RETURNING id, order_number INTO new_order_id, order_num;

  INSERT INTO public.order_items (
    order_id, product_id, description, quantity, unit_price,
    discount_rate, line_total_ttc, warehouse_id
  )
  SELECT new_order_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_price')::numeric, 0),
         COALESCE((x->>'discount_rate')::numeric, 0),
         COALESCE((x->>'line_total_ttc')::numeric, 0),
         NULLIF(x->>'warehouse_id','')::uuid
    FROM jsonb_array_elements(_items) x;

  -- 2. Vente linked to the commande (stock-neutral: the order owns the stock)
  INSERT INTO public.sales (
    customer_id, order_id, sale_date, payment_due_date, payment_method,
    payment_status, total_ttc, paid_amount, stock_applied, warehouse_id,
    notes, created_by
  ) VALUES (
    cust, new_order_id, s_date, NULLIF(_sale->>'payment_due_date','')::date,
    COALESCE(_sale->>'payment_method','cash')::payment_method,
    COALESCE(_sale->>'payment_status','unpaid')::payment_status,
    total, paid, false, wh, NULLIF(_sale->>'notes',''), auth.uid()
  ) RETURNING id, sale_number INTO new_sale_id, sale_num;

  INSERT INTO public.sale_items (
    sale_id, product_id, description, quantity, unit_price,
    discount_rate, line_total_ttc, warehouse_id
  )
  SELECT new_sale_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_price')::numeric, 0),
         COALESCE((x->>'discount_rate')::numeric, 0),
         COALESCE((x->>'line_total_ttc')::numeric, 0),
         NULLIF(x->>'warehouse_id','')::uuid
    FROM jsonb_array_elements(_items) x;

  -- Record the down payment on the vente (trigger recomputes paid/status)
  IF paid > 0 THEN
    INSERT INTO public.sale_payments (sale_id, amount, method, created_by)
    VALUES (new_sale_id, paid, COALESCE(_sale->>'payment_method','cash')::payment_method, auth.uid());
  END IF;

  RETURN jsonb_build_object(
    'sale_id', new_sale_id, 'sale_number', sale_num,
    'order_id', new_order_id, 'order_number', order_num);
END $$;

GRANT EXECUTE ON FUNCTION public.create_sale_with_order(jsonb, jsonb) TO authenticated;
