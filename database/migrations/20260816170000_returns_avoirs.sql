-- Retours / Avoirs — customer returns (avoirs) and supplier returns.
--
-- * Retour client  -> goods come back into stock (customer_return, IN) and the
--   return value (at sale price) reduces net C.A.
-- * Retour fournisseur -> goods leave stock (supplier_return, OUT); the stock
--   movement carries the unit cost, which reduces net Achats (Achats is derived
--   from stock entries at cost).
--
-- The stock side flows through the existing apply_stock_movement trigger.

-- ============================================================
-- 1. Tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.returns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text UNIQUE,
  type          text NOT NULL CHECK (type IN ('client','supplier')),
  customer_id   uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id   uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  sale_id       uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  return_date   date NOT NULL DEFAULT CURRENT_DATE,
  total_ttc     numeric(12,2) NOT NULL DEFAULT 0,
  reason        text,
  notes         text,
  warehouse_id  uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'active',
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.return_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description  text NOT NULL DEFAULT '',
  quantity     numeric(12,3) NOT NULL DEFAULT 0,
  unit_price   numeric(12,2) NOT NULL DEFAULT 0,
  line_total   numeric(12,2) NOT NULL DEFAULT 0,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.returns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items  ENABLE ROW LEVEL SECURITY;

-- Same posture as the other business tables: any authenticated user.
DROP POLICY IF EXISTS returns_all ON public.returns;
CREATE POLICY returns_all ON public.returns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS return_items_all ON public.return_items;
CREATE POLICY return_items_all ON public.return_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.returns      TO authenticated;
GRANT ALL ON public.return_items TO authenticated;

-- ============================================================
-- 2. Numbering — AV-YYMM-XXXX (avoir client) / RF-YYMM-XXXX (retour fournisseur)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.return_number_seq;

CREATE OR REPLACE FUNCTION public.generate_return_number(_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE prefix text; seq_val bigint;
BEGIN
  prefix := CASE WHEN _type = 'supplier' THEN 'RF-' ELSE 'AV-' END || to_char(CURRENT_DATE, 'YYMM');
  seq_val := nextval('public.return_number_seq');
  RETURN prefix || '-' || lpad(seq_val::text, 4, '0');
END $$;

-- ============================================================
-- 3. create_return RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_return(_return jsonb, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  new_id   uuid;
  ret_num  text;
  r_type   text;
  wh       uuid;
  uid      uuid;
  total    numeric := 0;
  it       jsonb;
  pid      uuid;
  qty      numeric;
  uprice   numeric;
  pcost    numeric;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins une ligne' USING ERRCODE = '23514';
  END IF;

  r_type := COALESCE(_return->>'type','client');
  IF r_type NOT IN ('client','supplier') THEN
    RAISE EXCEPTION 'Type de retour invalide' USING ERRCODE = '23514';
  END IF;
  wh  := NULLIF(_return->>'warehouse_id','')::uuid;
  uid := auth.uid();
  ret_num := public.generate_return_number(r_type);

  INSERT INTO public.returns (
    return_number, type, customer_id, supplier_id, sale_id, return_date,
    total_ttc, reason, notes, warehouse_id, status, created_by
  ) VALUES (
    ret_num, r_type,
    NULLIF(_return->>'customer_id','')::uuid,
    NULLIF(_return->>'supplier_id','')::uuid,
    NULLIF(_return->>'sale_id','')::uuid,
    COALESCE((_return->>'return_date')::date, CURRENT_DATE),
    0, NULLIF(_return->>'reason',''), NULLIF(_return->>'notes',''),
    wh, 'active', uid
  ) RETURNING id INTO new_id;

  FOR it IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    pid    := NULLIF(it->>'product_id','')::uuid;
    qty    := COALESCE((it->>'quantity')::numeric, 0);
    uprice := COALESCE((it->>'unit_price')::numeric, 0);
    IF qty <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.return_items (
      return_id, product_id, description, quantity, unit_price, line_total, warehouse_id
    ) VALUES (
      new_id, pid, COALESCE(it->>'description',''), qty, uprice, round(qty * uprice, 2),
      COALESCE(NULLIF(it->>'warehouse_id','')::uuid, wh)
    );
    total := total + round(qty * uprice, 2);

    -- Stock movement: client return -> IN, supplier return -> OUT.
    IF pid IS NOT NULL THEN
      IF r_type = 'client' THEN
        -- Value the returned goods at cost for inventory (not sale price).
        SELECT purchase_price INTO pcost FROM public.products WHERE id = pid;
        INSERT INTO public.stock_movements
          (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost)
        VALUES
          (pid, 'customer_return', qty, 'Retour client ' || ret_num, uid,
           COALESCE(NULLIF(it->>'warehouse_id','')::uuid, wh), ret_num, COALESCE(pcost,0));
      ELSE
        -- Supplier return leaves stock at the cost being credited back.
        INSERT INTO public.stock_movements
          (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost)
        VALUES
          (pid, 'supplier_return', qty, 'Retour fournisseur ' || ret_num, uid,
           COALESCE(NULLIF(it->>'warehouse_id','')::uuid, wh), ret_num, uprice);
      END IF;
    END IF;
  END LOOP;

  UPDATE public.returns SET total_ttc = total WHERE id = new_id;

  RETURN jsonb_build_object('return_id', new_id, 'return_number', ret_num, 'total_ttc', total);
END $$;

GRANT EXECUTE ON FUNCTION public.create_return(jsonb, jsonb) TO authenticated;

-- ============================================================
-- 4. cancel_return RPC — reverse the stock, mark cancelled
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_return(_return_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  r   record;
  ri  record;
  uid uuid;
BEGIN
  SELECT * INTO r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Retour introuvable' USING ERRCODE = '23503'; END IF;
  IF r.status = 'cancelled' THEN RETURN jsonb_build_object('already', true); END IF;
  uid := auth.uid();

  FOR ri IN SELECT * FROM public.return_items WHERE return_id = _return_id AND product_id IS NOT NULL
  LOOP
    IF r.type = 'client' THEN
      -- undo the customer_return (which added stock): take it back out
      INSERT INTO public.stock_movements
        (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost)
      VALUES
        (ri.product_id, 'out', ri.quantity, 'Annulation avoir ' || r.return_number, uid,
         COALESCE(ri.warehouse_id, r.warehouse_id), r.return_number, 0);
    ELSE
      -- undo the supplier_return (which removed stock): bring it back in.
      -- 'in' at the same cost so net Achats returns to pre-return value.
      INSERT INTO public.stock_movements
        (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost)
      VALUES
        (ri.product_id, 'in', ri.quantity, 'Annulation retour fournisseur ' || r.return_number, uid,
         COALESCE(ri.warehouse_id, r.warehouse_id), r.return_number, ri.unit_price);
    END IF;
  END LOOP;

  UPDATE public.returns SET status = 'cancelled' WHERE id = _return_id;
  RETURN jsonb_build_object('already', false);
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_return(uuid) TO authenticated;
