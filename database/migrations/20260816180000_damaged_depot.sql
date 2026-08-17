-- Stock endommagé is now a depot, not a write-off.
--
-- * products.damaged_quantity holds the units currently in the damaged depot.
-- * A 'damaged' movement MOVES units from sellable stock into the damaged depot
--   (sellable -qty, damaged +qty) instead of destroying them.
-- * stock_movements.to_damaged routes a movement to the damaged depot instead
--   of sellable stock — used so a client avoir marked "endommagé" sends the
--   returned goods straight into the damaged depot.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS damaged_quantity numeric NOT NULL DEFAULT 0;
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS to_damaged boolean NOT NULL DEFAULT false;
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS damaged boolean NOT NULL DEFAULT false;

-- ============================================================
-- apply_stock_movement — damaged depot aware
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur numeric; curd numeric; delta numeric; nxt numeric; ndam numeric;
BEGIN
  SELECT stock_quantity, damaged_quantity INTO cur, curd
    FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF cur IS NULL THEN
    RAISE EXCEPTION 'Produit introuvable : %', NEW.product_id;
  END IF;

  -- 1. Damaged: move units from sellable stock into the damaged depot.
  IF NEW.type = 'damaged' THEN
    nxt := cur - NEW.quantity;
    IF nxt < 0 THEN
      RAISE EXCEPTION 'Stock insuffisant pour ce produit : % en stock, % demandé',
        cur, NEW.quantity USING ERRCODE = '23514';
    END IF;
    NEW.stock_before := cur;
    NEW.stock_after  := nxt;
    UPDATE public.products
       SET stock_quantity = nxt, damaged_quantity = curd + NEW.quantity
     WHERE id = NEW.product_id;
    RETURN NEW;
  END IF;

  -- 2. Movements flagged to_damaged act on the damaged depot, not sellable.
  IF COALESCE(NEW.to_damaged, false) THEN
    IF NEW.type IN ('in', 'purchase', 'customer_return', 'inventory') THEN
      delta := NEW.quantity;
    ELSIF NEW.type IN ('out', 'sale', 'supplier_return') THEN
      delta := -NEW.quantity;
    ELSE
      delta := 0;
    END IF;
    ndam := curd + delta;
    IF ndam < 0 THEN
      RAISE EXCEPTION 'Stock endommagé insuffisant : % en stock, % demandé',
        curd, NEW.quantity USING ERRCODE = '23514';
    END IF;
    NEW.stock_before := curd;
    NEW.stock_after  := ndam;
    UPDATE public.products SET damaged_quantity = ndam WHERE id = NEW.product_id;
    RETURN NEW;
  END IF;

  -- 3. Normal sellable movements.
  IF NEW.type IN ('in', 'purchase', 'customer_return', 'inventory') THEN
    delta := NEW.quantity;
  ELSIF NEW.type IN ('out', 'sale', 'supplier_return') THEN
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
-- create_return — client avoir can route to the damaged depot
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
  dmg      boolean;
  total    numeric := 0;
  it       jsonb;
  pid      uuid;
  qty      numeric;
  uprice   numeric;
  pcost    numeric;
  wline    uuid;
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
  dmg := COALESCE((_return->>'damaged')::boolean, false) AND r_type = 'client';
  ret_num := public.generate_return_number(r_type);

  INSERT INTO public.returns (
    return_number, type, customer_id, supplier_id, sale_id, return_date,
    total_ttc, reason, notes, warehouse_id, status, damaged, created_by
  ) VALUES (
    ret_num, r_type,
    NULLIF(_return->>'customer_id','')::uuid,
    NULLIF(_return->>'supplier_id','')::uuid,
    NULLIF(_return->>'sale_id','')::uuid,
    COALESCE((_return->>'return_date')::date, CURRENT_DATE),
    0, NULLIF(_return->>'reason',''), NULLIF(_return->>'notes',''),
    wh, 'active', dmg, uid
  ) RETURNING id INTO new_id;

  FOR it IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    pid    := NULLIF(it->>'product_id','')::uuid;
    qty    := COALESCE((it->>'quantity')::numeric, 0);
    uprice := COALESCE((it->>'unit_price')::numeric, 0);
    IF qty <= 0 THEN CONTINUE; END IF;
    wline  := COALESCE(NULLIF(it->>'warehouse_id','')::uuid, wh);

    INSERT INTO public.return_items (
      return_id, product_id, description, quantity, unit_price, line_total, warehouse_id
    ) VALUES (
      new_id, pid, COALESCE(it->>'description',''), qty, uprice, round(qty * uprice, 2), wline
    );
    total := total + round(qty * uprice, 2);

    IF pid IS NOT NULL THEN
      IF r_type = 'client' THEN
        SELECT purchase_price INTO pcost FROM public.products WHERE id = pid;
        -- to_damaged=true sends the returned goods to the damaged depot.
        INSERT INTO public.stock_movements
          (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost, to_damaged)
        VALUES
          (pid, 'customer_return', qty,
           CASE WHEN dmg THEN 'Retour client (endommagé) ' ELSE 'Retour client ' END || ret_num,
           uid, wline, ret_num, COALESCE(pcost,0), dmg);
      ELSE
        INSERT INTO public.stock_movements
          (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost, to_damaged)
        VALUES
          (pid, 'supplier_return', qty, 'Retour fournisseur ' || ret_num,
           uid, wline, ret_num, uprice, false);
      END IF;
    END IF;
  END LOOP;

  UPDATE public.returns SET total_ttc = total WHERE id = new_id;
  RETURN jsonb_build_object('return_id', new_id, 'return_number', ret_num, 'total_ttc', total);
END $$;

-- ============================================================
-- cancel_return — reverse via the same depot (to_damaged) it landed in
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_return(_return_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r record; ri record; uid uuid;
BEGIN
  SELECT * INTO r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Retour introuvable' USING ERRCODE = '23503'; END IF;
  IF r.status = 'cancelled' THEN RETURN jsonb_build_object('already', true); END IF;
  uid := auth.uid();

  FOR ri IN SELECT * FROM public.return_items WHERE return_id = _return_id AND product_id IS NOT NULL
  LOOP
    IF r.type = 'client' THEN
      -- reverse the customer_return; to_damaged mirrors where it landed
      INSERT INTO public.stock_movements
        (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost, to_damaged)
      VALUES
        (ri.product_id, 'out', ri.quantity, 'Annulation avoir ' || r.return_number, uid,
         COALESCE(ri.warehouse_id, r.warehouse_id), r.return_number, 0, r.damaged);
    ELSE
      INSERT INTO public.stock_movements
        (product_id, type, quantity, reason, user_id, warehouse_id, document_ref, unit_cost, to_damaged)
      VALUES
        (ri.product_id, 'in', ri.quantity, 'Annulation retour fournisseur ' || r.return_number, uid,
         COALESCE(ri.warehouse_id, r.warehouse_id), r.return_number, ri.unit_price, false);
    END IF;
  END LOOP;

  UPDATE public.returns SET status = 'cancelled' WHERE id = _return_id;
  RETURN jsonb_build_object('already', false);
END $$;
