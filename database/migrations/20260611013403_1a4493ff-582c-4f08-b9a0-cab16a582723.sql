
-- ===== ENUMS =====
CREATE TYPE public.order_status AS ENUM ('pending','validated','delivered','cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid','partial','paid');
CREATE TYPE public.payment_method AS ENUM ('cash','card','transfer','check','credit');

-- ===== SEQUENCES =====
CREATE SEQUENCE public.order_number_seq START 1;
CREATE SEQUENCE public.sale_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.order_number_seq');
  RETURN 'CMD-' || to_char(now(), 'YYYY') || '-' || lpad(n::text,4,'0');
END $$;

CREATE OR REPLACE FUNCTION public.generate_sale_number() RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.sale_number_seq');
  RETURN 'VTE-' || to_char(now(), 'YYYY') || '-' || lpad(n::text,4,'0');
END $$;

-- ===== ORDERS =====
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT public.generate_order_number(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  subtotal_ht numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  stock_applied boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 20,
  discount_rate numeric(5,2) NOT NULL DEFAULT 0,
  line_total_ht numeric(12,2) NOT NULL DEFAULT 0,
  line_tax numeric(12,2) NOT NULL DEFAULT 0,
  line_total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all order_items" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'cash',
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments TO authenticated;
GRANT ALL ON public.order_payments TO service_role;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all order_payments" ON public.order_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== SALES =====
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL UNIQUE DEFAULT public.generate_sale_number(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_due_date date,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  payment_status public.payment_status NOT NULL DEFAULT 'paid',
  subtotal_ht numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  stock_applied boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 20,
  discount_rate numeric(5,2) NOT NULL DEFAULT 0,
  line_total_ht numeric(12,2) NOT NULL DEFAULT 0,
  line_tax numeric(12,2) NOT NULL DEFAULT 0,
  line_total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sale_items" ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'cash',
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT ALL ON public.sale_payments TO service_role;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sale_payments" ON public.sale_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== TRIGGERS =====
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Order: stock applied at delivery
CREATE OR REPLACE FUNCTION public.apply_order_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item record; uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
  IF NEW.status = 'delivered' AND NOT NEW.stock_applied THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Commande ' || NEW.order_number, uid);
    END LOOP;
    NEW.stock_applied := true;
  ELSIF NEW.status = 'cancelled' AND NEW.stock_applied THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id)
      VALUES (item.product_id, 'in', GREATEST(1, ceil(item.quantity)::int), 'Annulation commande ' || NEW.order_number, uid);
    END LOOP;
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_orders_stock BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.apply_order_stock();

-- Sale: stock applied immediately
CREATE OR REPLACE FUNCTION public.apply_sale_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item record; uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
  IF NOT NEW.stock_applied THEN
    FOR item IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Vente ' || NEW.sale_number, uid);
    END LOOP;
    UPDATE public.sales SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- Payment status sync
CREATE OR REPLACE FUNCTION public.sync_order_payment_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE total_paid numeric; total_due numeric; oid uuid;
BEGIN
  oid := COALESCE(NEW.order_id, OLD.order_id);
  SELECT COALESCE(SUM(amount),0) INTO total_paid FROM public.order_payments WHERE order_id = oid;
  SELECT total_ttc INTO total_due FROM public.orders WHERE id = oid;
  UPDATE public.orders SET
    paid_amount = total_paid,
    payment_status = CASE
      WHEN total_paid <= 0 THEN 'unpaid'::payment_status
      WHEN total_paid >= total_due THEN 'paid'::payment_status
      ELSE 'partial'::payment_status END
  WHERE id = oid;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_order_payments_sync AFTER INSERT OR UPDATE OR DELETE ON public.order_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_order_payment_status();

CREATE OR REPLACE FUNCTION public.sync_sale_payment_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE total_paid numeric; total_due numeric; sid uuid;
BEGIN
  sid := COALESCE(NEW.sale_id, OLD.sale_id);
  SELECT COALESCE(SUM(amount),0) INTO total_paid FROM public.sale_payments WHERE sale_id = sid;
  SELECT total_ttc INTO total_due FROM public.sales WHERE id = sid;
  UPDATE public.sales SET
    paid_amount = total_paid,
    payment_status = CASE
      WHEN total_paid <= 0 THEN 'unpaid'::payment_status
      WHEN total_paid >= total_due THEN 'paid'::payment_status
      ELSE 'partial'::payment_status END
  WHERE id = sid;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_sale_payments_sync AFTER INSERT OR UPDATE OR DELETE ON public.sale_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_payment_status();

-- Sale stock trigger AFTER INSERT (items are inserted after sale row)
CREATE OR REPLACE FUNCTION public.apply_sale_stock_deferred() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; item record; uid uuid;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = NEW.sale_id;
  IF s.stock_applied THEN RETURN NEW; END IF;
  -- mark applied after first item ensures we only run once when batch done; simplest: run per-item insert
  IF NEW.product_id IS NOT NULL THEN
    uid := COALESCE(s.created_by, auth.uid());
    INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id)
    VALUES (NEW.product_id, 'out', GREATEST(1, ceil(NEW.quantity)::int), 'Vente ' || s.sale_number, uid);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sale_items_stock AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.apply_sale_stock_deferred();
