
-- ENUMS
DO $$ BEGIN CREATE TYPE quote_status AS ENUM ('draft','sent','accepted','refused','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE project_status AS ENUM ('active','on_hold','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE project_stage_key AS ENUM ('design','client_validation','supplier_order','goods_reception','preparation','delivery','installation','quality_check','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE purchase_order_status AS ENUM ('draft','sent','confirmed','preparing','shipped','received','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'sale';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'purchase';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'customer_return';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'supplier_return';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'inventory';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'transfer';

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS stock_before integer;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS stock_after integer;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS document_ref text;

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cur int;
BEGIN
  SELECT stock_quantity INTO cur FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  NEW.stock_before := COALESCE(cur, 0);
  IF NEW.type IN ('in','purchase','customer_return','inventory') THEN
    UPDATE public.products SET stock_quantity = COALESCE(stock_quantity,0) + NEW.quantity WHERE id = NEW.product_id;
    NEW.stock_after := COALESCE(cur,0) + NEW.quantity;
  ELSIF NEW.type IN ('out','sale','supplier_return') THEN
    UPDATE public.products SET stock_quantity = COALESCE(stock_quantity,0) - NEW.quantity WHERE id = NEW.product_id;
    NEW.stock_after := COALESCE(cur,0) - NEW.quantity;
  ELSE
    NEW.stock_after := COALESCE(cur,0);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_apply_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_apply_stock_movement BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- QUOTES
CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq;
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS text LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n bigint;
BEGIN n := nextval('public.quote_number_seq'); RETURN 'DEV-'||to_char(now(),'YYYY')||'-'||lpad(n::text,4,'0'); END $$;

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE DEFAULT public.generate_quote_number(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  commercial_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  subtotal_ht numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  status quote_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_auth_all" ON public.quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER quotes_set_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 20,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_items_auth_all" ON public.quote_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  commercial_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date,
  expected_end_date date,
  budget numeric(12,2) DEFAULT 0,
  install_address text,
  status project_status NOT NULL DEFAULT 'active',
  progress integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_auth_all" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER projects_set_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.project_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key project_stage_key NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  planned_date date,
  actual_date date,
  responsible_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  comment text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, stage_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stages TO authenticated;
GRANT ALL ON public.project_stages TO service_role;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_stages_auth_all" ON public.project_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER project_stages_set_updated BEFORE UPDATE ON public.project_stages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key project_stage_key,
  file_url text NOT NULL,
  file_name text,
  kind text NOT NULL DEFAULT 'document',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_attachments TO authenticated;
GRANT ALL ON public.project_attachments TO service_role;
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_attachments_auth_all" ON public.project_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_activity TO authenticated;
GRANT ALL ON public.project_activity TO service_role;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_activity_auth_all" ON public.project_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.seed_project_stages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE keys project_stage_key[] := ARRAY['design','client_validation','supplier_order','goods_reception','preparation','delivery','installation','quality_check','completed']::project_stage_key[];
  i int;
BEGIN
  FOR i IN 1..array_length(keys,1) LOOP
    INSERT INTO public.project_stages(project_id, stage_key, order_index) VALUES (NEW.id, keys[i], i)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seed_project_stages ON public.projects;
CREATE TRIGGER trg_seed_project_stages AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.seed_project_stages();

CREATE OR REPLACE FUNCTION public.recompute_project_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE done int; total int; pid uuid;
BEGIN
  pid := COALESCE(NEW.project_id, OLD.project_id);
  SELECT COUNT(*) FILTER (WHERE completed), COUNT(*) INTO done, total FROM public.project_stages WHERE project_id = pid;
  UPDATE public.projects SET progress = CASE WHEN total>0 THEN (done*100/total) ELSE 0 END WHERE id = pid;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_recompute_project_progress ON public.project_stages;
CREATE TRIGGER trg_recompute_project_progress AFTER INSERT OR UPDATE OR DELETE ON public.project_stages
  FOR EACH ROW EXECUTE FUNCTION public.recompute_project_progress();

-- PURCHASE ORDERS
CREATE SEQUENCE IF NOT EXISTS public.purchase_order_number_seq;
CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
RETURNS text LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n bigint;
BEGIN n := nextval('public.purchase_order_number_seq'); RETURN 'ACH-'||to_char(now(),'YYYY')||'-'||lpad(n::text,4,'0'); END $$;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE DEFAULT public.generate_purchase_order_number(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  received_date date,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status purchase_order_status NOT NULL DEFAULT 'draft',
  stock_applied boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders_auth_all" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER purchase_orders_set_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_order_items_auth_all" ON public.purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.apply_purchase_order_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item record; uid uuid;
BEGIN
  uid := COALESCE(NEW.created_by, auth.uid());
  IF NEW.status = 'received' AND NOT NEW.stock_applied THEN
    FOR item IN SELECT product_id, quantity FROM public.purchase_order_items WHERE purchase_order_id = NEW.id AND product_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(product_id, type, quantity, reason, user_id, document_ref)
      VALUES (item.product_id, 'purchase', GREATEST(1, ceil(item.quantity)::int), 'Achat '||NEW.po_number, uid, NEW.po_number);
    END LOOP;
    NEW.stock_applied := true;
    NEW.received_date := COALESCE(NEW.received_date, CURRENT_DATE);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_apply_purchase_order_stock ON public.purchase_orders;
CREATE TRIGGER trg_apply_purchase_order_stock BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_order_stock();

-- PERMISSIONS SEED (with label)
INSERT INTO public.permissions(module, action, label) VALUES
  ('quotes','view','Voir les devis'),
  ('quotes','create','Créer un devis'),
  ('quotes','update','Modifier un devis'),
  ('quotes','delete','Supprimer un devis'),
  ('quotes','export','Exporter les devis'),
  ('quotes','print','Imprimer un devis'),
  ('projects','view','Voir les projets'),
  ('projects','create','Créer un projet'),
  ('projects','update','Modifier un projet'),
  ('projects','delete','Supprimer un projet'),
  ('projects','export','Exporter les projets'),
  ('projects','print','Imprimer un projet'),
  ('purchase_orders','view','Voir les commandes fournisseurs'),
  ('purchase_orders','create','Créer une commande fournisseur'),
  ('purchase_orders','update','Modifier une commande fournisseur'),
  ('purchase_orders','delete','Supprimer une commande fournisseur'),
  ('purchase_orders','export','Exporter les commandes fournisseurs'),
  ('purchase_orders','print','Imprimer une commande fournisseur')
ON CONFLICT (module, action) DO NOTHING;
