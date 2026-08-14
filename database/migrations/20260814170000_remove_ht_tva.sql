-- Migration: Remove HT/TVA logic and columns across the platform
-- Enforces a strict TTC pricing model as per business requirements

-- 1. Drop columns from transaction headers
ALTER TABLE public.quotes
  DROP COLUMN IF EXISTS subtotal_ht,
  DROP COLUMN IF EXISTS tax;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS subtotal_ht,
  DROP COLUMN IF EXISTS tax_amount;

ALTER TABLE public.sales
  DROP COLUMN IF EXISTS subtotal_ht,
  DROP COLUMN IF EXISTS tax_amount;

ALTER TABLE public.invoices
  DROP COLUMN IF EXISTS subtotal_ht,
  DROP COLUMN IF EXISTS tax_amount;

-- 2. Drop columns from transaction lines
ALTER TABLE public.quote_items
  DROP COLUMN IF EXISTS tax_rate,
  DROP COLUMN IF EXISTS line_total_ht;

ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS tax_rate,
  DROP COLUMN IF EXISTS line_total_ht,
  DROP COLUMN IF EXISTS line_tax;

ALTER TABLE public.sale_items
  DROP COLUMN IF EXISTS tax_rate,
  DROP COLUMN IF EXISTS line_total_ht,
  DROP COLUMN IF EXISTS line_tax;

ALTER TABLE public.invoice_items
  DROP COLUMN IF EXISTS tax_rate,
  DROP COLUMN IF EXISTS line_total_ht,
  DROP COLUMN IF EXISTS line_tax;

-- 3. Re-create create_sale RPC without HT/TVA
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
    total_ttc, paid_amount, notes, created_by, warehouse_id
  ) VALUES (
    NULLIF(_sale->>'customer_id','')::uuid,
    COALESCE((_sale->>'sale_date')::date, CURRENT_DATE),
    NULLIF(_sale->>'payment_due_date','')::date,
    COALESCE(_sale->>'payment_method','cash')::payment_method,
    COALESCE(_sale->>'payment_status','unpaid')::payment_status,
    COALESCE((_sale->>'total_ttc')::numeric, 0),
    COALESCE((_sale->>'paid_amount')::numeric, 0),
    NULLIF(_sale->>'notes',''),
    auth.uid(),
    NULLIF(_sale->>'warehouse_id','')::uuid
  ) RETURNING id, paid_amount INTO new_id, paid;

  INSERT INTO public.sale_items (
    sale_id, product_id, description, quantity, unit_price,
    discount_rate, line_total_ttc, warehouse_id
  )
  SELECT new_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_price')::numeric, 0),
         COALESCE((x->>'discount_rate')::numeric, 0),
         COALESCE((x->>'line_total_ttc')::numeric, 0),
         NULLIF(x->>'warehouse_id','')::uuid
    FROM jsonb_array_elements(_items) x;

  UPDATE public.sales SET stock_applied = true WHERE id = new_id;

  IF paid > 0 THEN
    INSERT INTO public.sale_payments (sale_id, amount, method, created_by)
    VALUES (new_id, paid, COALESCE(_sale->>'payment_method','cash')::payment_method, auth.uid());
  END IF;

  RETURN new_id;
END $$;

-- 4. Re-create create_order RPC without HT/TVA
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
    total_ttc, paid_amount, notes, created_by, warehouse_id, quote_id
  ) VALUES (
    NULLIF(_order->>'customer_id','')::uuid,
    COALESCE((_order->>'order_date')::date, CURRENT_DATE),
    NULLIF(_order->>'due_date','')::date,
    COALESCE(_order->>'status','pending')::order_status,
    COALESCE(_order->>'payment_status','unpaid')::payment_status,
    COALESCE((_order->>'total_ttc')::numeric, 0),
    COALESCE((_order->>'paid_amount')::numeric, 0),
    NULLIF(_order->>'notes',''),
    auth.uid(),
    NULLIF(_order->>'warehouse_id','')::uuid,
    NULLIF(_order->>'quote_id','')::uuid
  ) RETURNING id, paid_amount INTO new_id, paid;

  INSERT INTO public.order_items (
    order_id, product_id, description, quantity, unit_price,
    discount_rate, line_total_ttc, warehouse_id
  )
  SELECT new_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_price')::numeric, 0),
         COALESCE((x->>'discount_rate')::numeric, 0),
         COALESCE((x->>'line_total_ttc')::numeric, 0),
         NULLIF(x->>'warehouse_id','')::uuid
    FROM jsonb_array_elements(_items) x;

  IF paid > 0 THEN
    INSERT INTO public.order_payments (order_id, amount, method, created_by)
    VALUES (new_id, paid, COALESCE(_order->>'payment_method','cash')::payment_method, auth.uid());
  END IF;

  RETURN new_id;
END $$;

-- 5. Re-create create_invoice RPC without HT/TVA
CREATE OR REPLACE FUNCTION public.create_invoice(_invoice jsonb, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE new_id uuid; wanted invoice_status;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins une ligne' USING ERRCODE = '23514';
  END IF;

  wanted := COALESCE(_invoice->>'status','draft')::invoice_status;

  INSERT INTO public.invoices (
    customer_id, invoice_date, due_date, status,
    total_ttc, notes, created_by, warehouse_id,
    source_sale_id
  ) VALUES (
    NULLIF(_invoice->>'customer_id','')::uuid,
    COALESCE((_invoice->>'invoice_date')::date, CURRENT_DATE),
    COALESCE((_invoice->>'due_date')::date, CURRENT_DATE),
    'draft',
    COALESCE((_invoice->>'total_ttc')::numeric, 0),
    NULLIF(_invoice->>'notes',''),
    auth.uid(),
    NULLIF(_invoice->>'warehouse_id','')::uuid,
    NULLIF(_invoice->>'source_sale_id','')::uuid
  ) RETURNING id INTO new_id;

  INSERT INTO public.invoice_items (
    invoice_id, product_id, description, quantity, unit_price,
    discount_rate, line_total_ttc, warehouse_id
  )
  SELECT new_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_price')::numeric, 0),
         COALESCE((x->>'discount_rate')::numeric, 0),
         COALESCE((x->>'line_total_ttc')::numeric, 0),
         NULLIF(x->>'warehouse_id','')::uuid
    FROM jsonb_array_elements(_items) x;

  IF wanted <> 'draft' THEN
    UPDATE public.invoices SET status = wanted WHERE id = new_id;
  END IF;

  RETURN new_id;
END $$;

-- 6. Re-create deliver_order RPC without HT/TVA
CREATE OR REPLACE FUNCTION public.deliver_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  ord record;
  new_sale_id uuid;
  sale_num text;
  pay record;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF ord IS NULL THEN RAISE EXCEPTION 'Commande introuvable' USING ERRCODE = '23503'; END IF;
  IF ord.status = 'delivered' THEN RAISE EXCEPTION 'Cette commande est déjà livrée' USING ERRCODE = '23514'; END IF;
  IF ord.status = 'cancelled' THEN RAISE EXCEPTION 'Impossible de livrer une commande annulée' USING ERRCODE = '23514'; END IF;

  INSERT INTO public.sales (
    customer_id, order_id, sale_date, payment_due_date, payment_method,
    payment_status, total_ttc, paid_amount,
    stock_applied, warehouse_id, notes, created_by
  ) VALUES (
    ord.customer_id, ord.id, CURRENT_DATE, ord.due_date, 'cash',
    'unpaid', ord.total_ttc, 0,
    false, ord.warehouse_id,
    'Vente générée depuis la commande ' || ord.order_number,
    auth.uid()
  ) RETURNING id, sale_number INTO new_sale_id, sale_num;

  INSERT INTO public.sale_items (
    sale_id, product_id, description, quantity, unit_price,
    discount_rate, line_total_ttc, warehouse_id
  )
  SELECT new_sale_id, product_id, description, quantity, unit_price,
         discount_rate, line_total_ttc, warehouse_id
    FROM public.order_items
   WHERE order_id = _order_id
     AND product_id IS NOT NULL;

  UPDATE public.sales SET stock_applied = true WHERE id = new_sale_id;

  FOR pay IN SELECT amount, method, note, paid_at, created_by
               FROM public.order_payments WHERE order_id = _order_id
  LOOP
    INSERT INTO public.sale_payments (sale_id, amount, method, note, paid_at, created_by)
    VALUES (new_sale_id, pay.amount, pay.method, pay.note, pay.paid_at, pay.created_by);
  END LOOP;

  UPDATE public.orders SET stock_applied = true, status = 'delivered' WHERE id = _order_id;

  RETURN jsonb_build_object('sale_id', new_sale_id, 'sale_number', sale_num);
END $$;
