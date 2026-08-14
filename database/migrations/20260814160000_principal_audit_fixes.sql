-- Principal Section Audit — Comprehensive Migration
-- Fixes: quote_id linkage, deliver_order RPC, damaged enum, quote number format

-- ============================================================
-- 1. Add quote_id to orders for proper linkage (Bug 4)
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Add 'damaged' to movement_type enum (Bug 15)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'damaged'
      AND enumtypid = 'public.movement_type'::regtype
  ) THEN
    ALTER TYPE public.movement_type ADD VALUE 'damaged';
  END IF;
END $$;

-- ============================================================
-- 3. Update apply_stock_movement to handle 'damaged' as outflow
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur numeric; delta numeric; nxt numeric;
BEGIN
  SELECT stock_quantity INTO cur
    FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF cur IS NULL THEN
    RAISE EXCEPTION 'Produit introuvable : %', NEW.product_id;
  END IF;

  IF NEW.type IN ('in', 'purchase', 'customer_return', 'inventory') THEN
    delta := NEW.quantity;
  ELSIF NEW.type IN ('out', 'sale', 'supplier_return', 'damaged') THEN
    delta := -NEW.quantity;
  ELSE
    delta := 0;
  END IF;

  nxt := cur + delta;
  IF nxt < 0 THEN
    RAISE EXCEPTION 'Stock insuffisant pour ce produit : % en stock, % demandé',
      cur, NEW.quantity USING ERRCODE = '23514';
  END IF;

  NEW.stock_before := cur;
  NEW.stock_after  := nxt;
  UPDATE public.products SET stock_quantity = nxt WHERE id = NEW.product_id;
  RETURN NEW;
END $$;

-- ============================================================
-- 4. Update apply_order_stock to skip when stock_applied is already true
--    This prevents double-deduction when deliver_order sets stock_applied
--    before updating status.
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_order_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
  -- Skip if stock was already applied (e.g. by deliver_order RPC)
  IF NEW.status = 'delivered' AND NOT NEW.stock_applied THEN
    PERFORM public.move_document_stock(
      'order_items','order_id',NEW.id,'out',
      'Commande ' || NEW.order_number, uid, NEW.warehouse_id, NEW.order_number);
    NEW.stock_applied := true;
  ELSIF NEW.status <> 'delivered' AND NEW.stock_applied THEN
    PERFORM public.move_document_stock(
      'order_items','order_id',NEW.id,'in',
      'Retour commande ' || NEW.order_number, uid, NEW.warehouse_id, NEW.order_number);
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END $$;

-- ============================================================
-- 5. deliver_order RPC — Atomic delivery that creates a sale,
--    copies items (triggering stock deduction via sale_items trigger),
--    transfers payments, and marks the order as delivered.
-- ============================================================
CREATE OR REPLACE FUNCTION public.deliver_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  ord record;
  new_sale_id uuid;
  sale_num text;
  pay record;
BEGIN
  -- Lock the order row
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF ord IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable' USING ERRCODE = '23503';
  END IF;
  IF ord.status = 'delivered' THEN
    RAISE EXCEPTION 'Cette commande est déjà livrée' USING ERRCODE = '23514';
  END IF;
  IF ord.status = 'cancelled' THEN
    RAISE EXCEPTION 'Impossible de livrer une commande annulée' USING ERRCODE = '23514';
  END IF;

  -- 1. Create the sale record (stock_applied = false so item trigger fires)
  INSERT INTO public.sales (
    customer_id, order_id, sale_date, payment_due_date, payment_method,
    payment_status, subtotal_ht, tax_amount, total_ttc, paid_amount,
    stock_applied, warehouse_id, notes, created_by
  ) VALUES (
    ord.customer_id, ord.id, CURRENT_DATE, ord.due_date, 'cash',
    'unpaid', ord.subtotal_ht, ord.tax_amount, ord.total_ttc, 0,
    false, ord.warehouse_id,
    'Vente générée depuis la commande ' || ord.order_number,
    auth.uid()
  ) RETURNING id, sale_number INTO new_sale_id, sale_num;

  -- 2. Copy order_items → sale_items (triggers apply_sale_stock_deferred → stock out)
  INSERT INTO public.sale_items (
    sale_id, product_id, description, quantity, unit_price,
    tax_rate, discount_rate, line_total_ht, line_tax, line_total_ttc, warehouse_id
  )
  SELECT new_sale_id, product_id, description, quantity, unit_price,
         tax_rate, discount_rate, line_total_ht, line_tax, line_total_ttc, warehouse_id
    FROM public.order_items
   WHERE order_id = _order_id
     AND product_id IS NOT NULL;

  -- 3. Mark sale stock as applied (prevents future item inserts from moving stock again)
  UPDATE public.sales SET stock_applied = true WHERE id = new_sale_id;

  -- 4. Transfer order payments → sale payments
  FOR pay IN SELECT amount, method, note, paid_at, created_by
               FROM public.order_payments WHERE order_id = _order_id
  LOOP
    INSERT INTO public.sale_payments (sale_id, amount, method, note, paid_at, created_by)
    VALUES (new_sale_id, pay.amount, pay.method, pay.note, pay.paid_at, pay.created_by);
  END LOOP;

  -- 5. Mark order as delivered + stock_applied = true
  --    (stock_applied = true BEFORE status update prevents apply_order_stock
  --     from doing a second deduction)
  UPDATE public.orders
     SET stock_applied = true,
         status = 'delivered'
   WHERE id = _order_id;

  RETURN jsonb_build_object(
    'sale_id', new_sale_id,
    'sale_number', sale_num
  );
END $$;

-- Grant execute to authenticated users (RLS still applies via SECURITY INVOKER)
GRANT EXECUTE ON FUNCTION public.deliver_order(uuid) TO authenticated;

-- ============================================================
-- 6. Align generate_quote_number to DEV-YYMM-XXXX format
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  prefix text;
  seq_val bigint;
BEGIN
  prefix := 'DEV-' || to_char(CURRENT_DATE, 'YYMM');
  seq_val := nextval('public.quote_number_seq');
  RETURN prefix || '-' || lpad(seq_val::text, 4, '0');
END $$;
