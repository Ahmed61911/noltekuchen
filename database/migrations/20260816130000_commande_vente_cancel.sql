-- Commande <-> Vente workflow rework + cancellation for devis/commandes/ventes
--
-- New rules:
--   * A commande "validée" creates its vente immediately (validate_order).
--   * Stock still leaves at "livrée" — so a vente that belongs to an order is
--     STOCK-NEUTRAL: the order owns the stock movement. Standalone ventes
--     (order_id IS NULL, created from the Ventes screen) keep owning theirs.
--   * Cancelling a commande cancels its vente and returns stock if delivered.
--   * Ventes gain a status so they can be cancelled (annulée) instead of deleted.
--   * Devis gain a 'cancelled' status.

-- ============================================================
-- 1. Sale status (for cancellation)
-- ============================================================
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- ============================================================
-- 2. 'cancelled' devis status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cancelled'
      AND enumtypid = 'public.quote_status'::regtype
  ) THEN
    ALTER TYPE public.quote_status ADD VALUE 'cancelled';
  END IF;
END $$;

-- ============================================================
-- 3. Order-linked ventes are stock-neutral (the order owns stock)
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_sale_stock_deferred()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
        p record;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = NEW.sale_id;
  -- A vente attached to a commande never moves stock itself: the commande
  -- does, at delivery. Only standalone ventes own their stock.
  IF s.order_id IS NOT NULL THEN RETURN NEW; END IF;
  -- Guard against re-applying to a sale whose stock was already taken.
  IF s.stock_applied THEN RETURN NEW; END IF;

  IF NEW.product_id IS NOT NULL AND COALESCE(NEW.quantity,0) > 0 THEN
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

CREATE OR REPLACE FUNCTION public.revert_sale_stock_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Order-linked ventes never moved stock, so nothing to give back.
  IF OLD.order_id IS NOT NULL THEN RETURN OLD; END IF;
  IF OLD.stock_applied THEN
    PERFORM public.move_document_stock(
      'sale_items','sale_id',OLD.id,'in',
      'Suppression vente ' || OLD.sale_number,
      COALESCE(OLD.created_by, auth.uid()), OLD.warehouse_id, OLD.sale_number);
  END IF;
  RETURN OLD;
END $$;

-- ============================================================
-- 4. validate_order — commande validée crée la vente (sans mouvement de stock)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  ord record;
  existing_id  uuid;
  existing_num text;
  new_sale_id  uuid;
  sale_num     text;
  pay record;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF ord IS NULL THEN RAISE EXCEPTION 'Commande introuvable' USING ERRCODE = '23503'; END IF;
  IF ord.status = 'cancelled' THEN
    RAISE EXCEPTION 'Impossible de valider une commande annulée' USING ERRCODE = '23514';
  END IF;

  -- Idempotency: reuse the vente if one already exists for this commande
  SELECT id, sale_number INTO existing_id, existing_num
    FROM public.sales WHERE order_id = _order_id LIMIT 1;
  IF existing_id IS NOT NULL THEN
    IF ord.status = 'pending' THEN
      UPDATE public.orders SET status = 'validated' WHERE id = _order_id;
    END IF;
    RETURN jsonb_build_object('sale_id', existing_id, 'sale_number', existing_num, 'already', true);
  END IF;

  -- Create the vente (order-linked => stock-neutral until delivery)
  INSERT INTO public.sales (
    customer_id, order_id, sale_date, payment_due_date, payment_method,
    payment_status, total_ttc, paid_amount, stock_applied, warehouse_id, notes, created_by
  ) VALUES (
    ord.customer_id, ord.id, CURRENT_DATE, ord.due_date, 'cash',
    'unpaid', ord.total_ttc, 0, false, ord.warehouse_id,
    'Vente générée depuis la commande ' || ord.order_number, auth.uid()
  ) RETURNING id, sale_number INTO new_sale_id, sale_num;

  INSERT INTO public.sale_items (
    sale_id, product_id, description, quantity, unit_price,
    discount_rate, line_total_ttc, warehouse_id
  )
  SELECT new_sale_id, product_id, description, quantity, unit_price,
         discount_rate, line_total_ttc, warehouse_id
    FROM public.order_items
   WHERE order_id = _order_id AND product_id IS NOT NULL;

  -- Carry any payments already recorded on the commande over to the vente
  FOR pay IN SELECT amount, method, note, paid_at, created_by
               FROM public.order_payments WHERE order_id = _order_id
  LOOP
    INSERT INTO public.sale_payments (sale_id, amount, method, note, paid_at, created_by)
    VALUES (new_sale_id, pay.amount, pay.method, pay.note, pay.paid_at, pay.created_by);
  END LOOP;

  IF ord.status = 'pending' THEN
    UPDATE public.orders SET status = 'validated' WHERE id = _order_id;
  END IF;

  RETURN jsonb_build_object('sale_id', new_sale_id, 'sale_number', sale_num, 'already', false);
END $$;

-- ============================================================
-- 5. cancel_order — annule la commande + sa vente, rend le stock si livrée
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ord record;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF ord IS NULL THEN RAISE EXCEPTION 'Commande introuvable' USING ERRCODE = '23503'; END IF;
  IF ord.status = 'cancelled' THEN
    RETURN jsonb_build_object('already', true);
  END IF;

  -- Cancel the linked vente (stock-neutral: no stock effect here)
  UPDATE public.sales SET status = 'cancelled'
   WHERE order_id = _order_id AND status <> 'cancelled';

  -- Setting status away from 'delivered' makes apply_order_stock return the
  -- goods to stock, but only if they had actually left (stock_applied).
  UPDATE public.orders SET status = 'cancelled' WHERE id = _order_id;

  RETURN jsonb_build_object('already', false);
END $$;

-- ============================================================
-- 6. cancel_sale — annule une vente (rend le stock), cascade vers la commande
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE sal record;
BEGIN
  SELECT * INTO sal FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF sal IS NULL THEN RAISE EXCEPTION 'Vente introuvable' USING ERRCODE = '23503'; END IF;
  IF sal.status = 'cancelled' THEN
    RETURN jsonb_build_object('already', true);
  END IF;

  IF sal.order_id IS NOT NULL THEN
    -- Order owns the stock: cancelling the commande returns it (if delivered)
    UPDATE public.orders SET status = 'cancelled'
     WHERE id = sal.order_id AND status <> 'cancelled';
  ELSIF sal.stock_applied THEN
    -- Standalone vente: give its own stock back
    PERFORM public.move_document_stock(
      'sale_items','sale_id',_sale_id,'in',
      'Annulation vente ' || sal.sale_number,
      COALESCE(sal.created_by, auth.uid()), sal.warehouse_id, sal.sale_number);
  END IF;

  UPDATE public.sales SET status = 'cancelled' WHERE id = _sale_id;
  RETURN jsonb_build_object('already', false);
END $$;

GRANT EXECUTE ON FUNCTION public.validate_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid)    TO authenticated;
