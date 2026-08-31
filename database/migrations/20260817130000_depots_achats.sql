-- Dépôts partout + module Achats
--
-- 1. Les projets, les lignes de devis et les achats portent un dépôt.
-- 2. Les achats (purchase_orders) mouvementent le stock dans LEUR dépôt et à
--    LEUR coût réel, au lieu de NULL / prix d'achat courant du produit.
-- 3. accept_quote reporte le dépôt du devis sur la commande générée.
-- 4. create_purchase_order : création atomique d'un achat + ses lignes.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- ============================================================
-- move_document_stock : valoriser au coût réel de la ligne quand elle en a un
-- ============================================================
-- purchase_order_items porte unit_cost (le prix réellement payé). Auparavant
-- tous les mouvements étaient valorisés au purchase_price courant du produit,
-- ce qui faussait le KPI « Achats ». Les tables de vente n'ont pas de unit_cost
-- (leur unit_price est un prix de vente), elles gardent donc le prix d'achat.
CREATE OR REPLACE FUNCTION public.move_document_stock(
  _items_table text, _fk_col text, _doc_id uuid,
  _dir public.movement_type, _reason text, _uid uuid,
  _doc_warehouse uuid, _ref text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item record; has_wh boolean; has_cost boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _items_table
      AND column_name = 'warehouse_id'
  ) INTO has_wh;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _items_table
      AND column_name = 'unit_cost'
  ) INTO has_cost;

  FOR item IN EXECUTE format(
    'SELECT i.product_id, i.quantity, %s AS warehouse_id, %s AS unit_cost,
            p.purchase_price
       FROM public.%I i
       LEFT JOIN public.products p ON i.product_id = p.id
       WHERE i.%I = $1 AND i.product_id IS NOT NULL',
    CASE WHEN has_wh   THEN 'i.warehouse_id' ELSE 'NULL::uuid'    END,
    CASE WHEN has_cost THEN 'i.unit_cost'    ELSE 'NULL::numeric' END,
    _items_table, _fk_col
  ) USING _doc_id
  LOOP
    IF COALESCE(item.quantity, 0) > 0 THEN
      INSERT INTO public.stock_movements
        (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost)
      VALUES
        (item.product_id, _dir, item.quantity, _reason, _uid,
         COALESCE(item.warehouse_id, _doc_warehouse), _ref,
         COALESCE(item.unit_cost, item.purchase_price, 0));
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- apply_purchase_order_stock : mouvementer dans le dépôt de l'achat
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_purchase_order_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
  IF NEW.status = 'received' AND NOT NEW.stock_applied THEN
    PERFORM public.move_document_stock(
      'purchase_order_items','purchase_order_id',NEW.id,'purchase',
      'Achat ' || NEW.po_number, uid, NEW.warehouse_id, NEW.po_number);
    NEW.stock_applied := true;
    NEW.received_date := COALESCE(NEW.received_date, CURRENT_DATE);
  ELSIF NEW.status <> 'received' AND NEW.stock_applied THEN
    PERFORM public.move_document_stock(
      'purchase_order_items','purchase_order_id',NEW.id,'supplier_return',
      'Annulation achat ' || NEW.po_number, uid, NEW.warehouse_id, NEW.po_number);
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END $$;

-- ============================================================
-- accept_quote : reporter le dépôt des lignes du devis sur la commande
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_quote(_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  q             record;
  existing_id   uuid;
  existing_num  text;
  new_order_id  uuid;
  order_num     text;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF q IS NULL THEN
    RAISE EXCEPTION 'Devis introuvable' USING ERRCODE = '23503';
  END IF;

  SELECT id, order_number INTO existing_id, existing_num
    FROM public.orders WHERE quote_id = _quote_id LIMIT 1;
  IF existing_id IS NOT NULL THEN
    UPDATE public.quotes SET status = 'accepted'
     WHERE id = _quote_id AND status <> 'accepted';
    RETURN jsonb_build_object(
      'order_id', existing_id, 'order_number', existing_num, 'already', true);
  END IF;

  INSERT INTO public.orders (
    customer_id, quote_id, order_date, due_date, status, payment_status,
    total_ttc, paid_amount, stock_applied, notes, created_by, warehouse_id
  ) VALUES (
    q.customer_id, q.id, CURRENT_DATE,
    COALESCE(q.expiry_date, (CURRENT_DATE + INTERVAL '30 days')::date),
    'pending', 'unpaid', q.total_ttc, 0, false,
    'Commande générée depuis le devis ' || q.quote_number, auth.uid(),
    (SELECT warehouse_id FROM public.quote_items
      WHERE quote_id = _quote_id AND warehouse_id IS NOT NULL LIMIT 1)
  ) RETURNING id, order_number INTO new_order_id, order_num;

  INSERT INTO public.order_items (
    order_id, product_id, description, quantity, unit_price,
    discount_rate, line_total_ttc, warehouse_id
  )
  SELECT new_order_id, product_id, description, quantity, unit_price,
         COALESCE(discount, 0), COALESCE(total, 0), warehouse_id
    FROM public.quote_items
   WHERE quote_id = _quote_id;

  UPDATE public.quotes SET status = 'accepted' WHERE id = _quote_id;

  RETURN jsonb_build_object(
    'order_id', new_order_id, 'order_number', order_num, 'already', false);
END $$;

-- ============================================================
-- create_purchase_order : achat + lignes en une transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_purchase_order(_po jsonb, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE new_id uuid; po_num text; total numeric := 0;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins une ligne' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(
           round(COALESCE((x->>'quantity')::numeric, 0)
               * COALESCE((x->>'unit_cost')::numeric, 0), 2)), 0)
    INTO total
    FROM jsonb_array_elements(_items) x;

  INSERT INTO public.purchase_orders (
    supplier_id, order_date, expected_date, status, total, notes,
    warehouse_id, stock_applied, created_by
  ) VALUES (
    NULLIF(_po->>'supplier_id','')::uuid,
    COALESCE((_po->>'order_date')::date, CURRENT_DATE),
    NULLIF(_po->>'expected_date','')::date,
    COALESCE(_po->>'status','draft')::purchase_order_status,
    total, NULLIF(_po->>'notes',''),
    NULLIF(_po->>'warehouse_id','')::uuid, false, auth.uid()
  ) RETURNING id, po_number INTO new_id, po_num;

  INSERT INTO public.purchase_order_items (
    purchase_order_id, product_id, description, quantity, unit_cost, total
  )
  SELECT new_id,
         NULLIF(x->>'product_id','')::uuid,
         COALESCE(x->>'description',''),
         COALESCE((x->>'quantity')::numeric, 0),
         COALESCE((x->>'unit_cost')::numeric, 0),
         round(COALESCE((x->>'quantity')::numeric, 0)
             * COALESCE((x->>'unit_cost')::numeric, 0), 2)
    FROM jsonb_array_elements(_items) x
   WHERE COALESCE((x->>'quantity')::numeric, 0) > 0;

  RETURN jsonb_build_object('purchase_order_id', new_id, 'po_number', po_num, 'total', total);
END $$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order(jsonb, jsonb) TO authenticated;
