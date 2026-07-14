
-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft','pending','paid','cancelled');

-- Sequence for invoice numbers
CREATE SEQUENCE public.invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.invoice_number_seq');
  RETURN 'FAC-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
END; $$;

-- Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT public.generate_invoice_number(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL DEFAULT (current_date + interval '30 days'),
  status public.invoice_status NOT NULL DEFAULT 'draft',
  subtotal_ht numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  stock_applied boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Invoice items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 20,
  discount_rate numeric(5,2) NOT NULL DEFAULT 0,
  line_total_ht numeric(12,2) NOT NULL DEFAULT 0,
  line_tax numeric(12,2) NOT NULL DEFAULT 0,
  line_total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);

-- Stock application trigger
CREATE OR REPLACE FUNCTION public.apply_invoice_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item record;
  should_apply boolean;
  should_revert boolean;
  uid uuid;
BEGIN
  should_apply := (NEW.status IN ('pending','paid')) AND NOT NEW.stock_applied;
  should_revert := (NEW.status = 'cancelled') AND NEW.stock_applied;
  uid := COALESCE(NEW.created_by, auth.uid());

  IF should_apply THEN
    FOR item IN SELECT product_id, quantity FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Facture ' || NEW.invoice_number, uid);
    END LOOP;
    NEW.stock_applied := true;
  ELSIF should_revert THEN
    FOR item IN SELECT product_id, quantity FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id)
      VALUES (item.product_id, 'in', GREATEST(1, ceil(item.quantity)::int), 'Annulation facture ' || NEW.invoice_number, uid);
    END LOOP;
    NEW.stock_applied := false;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_invoice_stock
BEFORE UPDATE OF status ON public.invoices
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.apply_invoice_stock();

-- Also handle initial insert with non-draft status
CREATE OR REPLACE FUNCTION public.apply_invoice_stock_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item record; uid uuid;
BEGIN
  IF NEW.status IN ('pending','paid') AND NOT NEW.stock_applied THEN
    uid := COALESCE(NEW.created_by, auth.uid());
    FOR item IN SELECT product_id, quantity FROM public.invoice_items WHERE invoice_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id)
      VALUES (item.product_id, 'out', GREATEST(1, ceil(item.quantity)::int), 'Facture ' || NEW.invoice_number, uid);
    END LOOP;
    UPDATE public.invoices SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;
-- Note: items are inserted after invoice; we rely on status transition via UPDATE for stock application.
