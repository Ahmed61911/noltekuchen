-- Rewrite the stock engine: correct quantities, reachable reversal,
-- no double deduction, no silent negative stock.
--
-- Fixes, in order of damage:
--   1. Every trigger rounded quantities with GREATEST(1, ceil(qty)::int).
--      Now that the columns are numeric(12,2) (previous migration) the real
--      quantity is used.
--   2. Order reversal was unreachable. It required status='cancelled' AND
--      stock_applied, but stock_applied only becomes true at 'delivered' and
--      the UI only offers Cancel when the order is NOT delivered — so a
--      delivered order could never return its stock. Reversal now triggers on
--      *leaving* the applied state, whatever the new status.
--   3. Deleting an order/sale/purchase order never returned stock (only the
--      invoice screen handled it, in client code). Reversal now lives in
--      BEFORE DELETE triggers, so it cannot be bypassed by whoever deletes.
--   4. A sale deducted stock via sale_items, then the invoice generated from
--      it deducted the same goods again on its next status change. Invoices
--      now carry source_sale_id and never move stock when set.
--   5. Nothing stopped stock going negative. apply_stock_movement now refuses.

-- ---------------------------------------------------------------- helpers --
-- One place that turns a document's line items into stock movements, so the
-- five callers cannot drift apart again — which is exactly how the rounding
-- bug ended up duplicated five times.
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
    'SELECT product_id, quantity, %s AS warehouse_id
       FROM public.%I WHERE %I = $1 AND product_id IS NOT NULL',
    CASE WHEN has_wh THEN 'warehouse_id' ELSE 'NULL::uuid' END,
    _items_table, _fk_col
  ) USING _doc_id
  LOOP
    -- Skip zero/NULL lines instead of coercing them to 1 unit.
    IF COALESCE(item.quantity, 0) > 0 THEN
      INSERT INTO public.stock_movements
        (product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
      VALUES
        (item.product_id, _dir, item.quantity, _reason, _uid,
         COALESCE(item.warehouse_id, _doc_warehouse), _ref);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------- the movement itself ----
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur numeric; delta numeric; nxt numeric;
BEGIN
  SELECT stock_quantity INTO cur FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  cur := COALESCE(cur, 0);

  IF NEW.type IN ('in','purchase','customer_return','inventory') THEN
    delta := NEW.quantity;
  ELSIF NEW.type IN ('out','sale','supplier_return') THEN
    delta := -NEW.quantity;
  ELSE
    delta := 0;   -- 'transfer' is net-zero on total stock
  END IF;

  nxt := cur + delta;

  -- Refuse to go negative rather than silently corrupting inventory.
  IF nxt < 0 THEN
    RAISE EXCEPTION
      'Stock insuffisant pour ce produit : % en stock, % demandé', cur, NEW.quantity
      USING ERRCODE = '23514';
  END IF;

  NEW.stock_before := cur;
  NEW.stock_after  := nxt;
  IF delta <> 0 THEN
    UPDATE public.products SET stock_quantity = nxt WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;

-- --------------------------------------------------------------- orders ---
CREATE OR REPLACE FUNCTION public.apply_order_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
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

CREATE OR REPLACE FUNCTION public.revert_order_stock_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.stock_applied THEN
    PERFORM public.move_document_stock(
      'order_items','order_id',OLD.id,'in',
      'Suppression commande ' || OLD.order_number,
      COALESCE(OLD.created_by, auth.uid()), OLD.warehouse_id, OLD.order_number);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_orders_stock ON public.orders;
CREATE TRIGGER trg_orders_stock
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.apply_order_stock();

DROP TRIGGER IF EXISTS trg_orders_stock_delete ON public.orders;
CREATE TRIGGER trg_orders_stock_delete
  BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.revert_order_stock_on_delete();

-- ---------------------------------------------------------------- sales ---
CREATE OR REPLACE FUNCTION public.apply_sale_stock_deferred()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = NEW.sale_id;
  -- Guard against re-applying to a sale whose stock was already taken. The
  -- flag is set once, after the whole item batch is inserted, so every line
  -- of the original batch still moves.
  IF s.stock_applied THEN RETURN NEW; END IF;
  IF NEW.product_id IS NOT NULL AND COALESCE(NEW.quantity,0) > 0 THEN
    INSERT INTO public.stock_movements
      (product_id, type, quantity, reason, user_id, warehouse_id, document_ref)
    VALUES
      (NEW.product_id, 'out', NEW.quantity, 'Vente ' || s.sale_number,
       COALESCE(s.created_by, auth.uid()),
       COALESCE(NEW.warehouse_id, s.warehouse_id), s.sale_number);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.revert_sale_stock_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.stock_applied THEN
    PERFORM public.move_document_stock(
      'sale_items','sale_id',OLD.id,'in',
      'Suppression vente ' || OLD.sale_number,
      COALESCE(OLD.created_by, auth.uid()), OLD.warehouse_id, OLD.sale_number);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_sales_stock_delete ON public.sales;
CREATE TRIGGER trg_sales_stock_delete
  BEFORE DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.revert_sale_stock_on_delete();

-- ------------------------------------------------------------- invoices ---
-- Explicit link back to the originating sale. Without it there is no way for
-- the trigger to know the goods already left stock when the sale was made.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

-- Backfill for invoices already generated from a sale, so their next status
-- change does not double-deduct.
UPDATE public.invoices i
   SET source_sale_id = s.id
  FROM public.sales s
 WHERE s.invoice_id = i.id AND i.source_sale_id IS NULL;

CREATE OR REPLACE FUNCTION public.apply_invoice_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  -- Goods invoiced from a sale already left stock when the sale was recorded.
  IF NEW.source_sale_id IS NOT NULL THEN RETURN NEW; END IF;

  uid := COALESCE(NEW.created_by, auth.uid());
  IF NEW.status IN ('pending','paid') AND NOT NEW.stock_applied THEN
    PERFORM public.move_document_stock(
      'invoice_items','invoice_id',NEW.id,'out',
      'Facture ' || NEW.invoice_number, uid, NEW.warehouse_id, NEW.invoice_number);
    NEW.stock_applied := true;
  ELSIF NEW.status NOT IN ('pending','paid') AND NEW.stock_applied THEN
    PERFORM public.move_document_stock(
      'invoice_items','invoice_id',NEW.id,'in',
      'Annulation facture ' || NEW.invoice_number, uid, NEW.warehouse_id, NEW.invoice_number);
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.revert_invoice_stock_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.stock_applied THEN
    PERFORM public.move_document_stock(
      'invoice_items','invoice_id',OLD.id,'in',
      'Suppression facture ' || OLD.invoice_number,
      COALESCE(OLD.created_by, auth.uid()), OLD.warehouse_id, OLD.invoice_number);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_stock_delete ON public.invoices;
CREATE TRIGGER trg_invoice_stock_delete
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.revert_invoice_stock_on_delete();

-- ------------------------------------------------------ purchase orders ---
CREATE OR REPLACE FUNCTION public.apply_purchase_order_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
  IF NEW.status = 'received' AND NOT NEW.stock_applied THEN
    PERFORM public.move_document_stock(
      'purchase_order_items','purchase_order_id',NEW.id,'purchase',
      'Achat ' || NEW.po_number, uid, NULL, NEW.po_number);
    NEW.stock_applied := true;
    NEW.received_date := COALESCE(NEW.received_date, CURRENT_DATE);
  ELSIF NEW.status <> 'received' AND NEW.stock_applied THEN
    -- Goods un-received have to leave stock again; previously this branch did
    -- not exist at all, so a mistaken "received" was permanent.
    PERFORM public.move_document_stock(
      'purchase_order_items','purchase_order_id',NEW.id,'supplier_return',
      'Annulation achat ' || NEW.po_number, uid, NULL, NEW.po_number);
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.revert_purchase_order_stock_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.stock_applied THEN
    PERFORM public.move_document_stock(
      'purchase_order_items','purchase_order_id',OLD.id,'supplier_return',
      'Suppression achat ' || OLD.po_number,
      COALESCE(OLD.created_by, auth.uid()), NULL, OLD.po_number);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_purchase_orders_stock_delete ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_stock_delete
  BEFORE DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.revert_purchase_order_stock_on_delete();

-- --------------------------------------------------------------- hygiene --
-- Never attached to any trigger; apply_invoice_stock_insert in particular was
-- a half-built second path for the same job.
DROP FUNCTION IF EXISTS public.apply_sale_stock();
DROP FUNCTION IF EXISTS public.apply_invoice_stock_insert();

-- Trigger functions must not be callable directly by clients.
REVOKE EXECUTE ON FUNCTION public.move_document_stock(text,text,uuid,public.movement_type,text,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revert_order_stock_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revert_sale_stock_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revert_invoice_stock_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revert_purchase_order_stock_on_delete() FROM PUBLIC, anon, authenticated;
