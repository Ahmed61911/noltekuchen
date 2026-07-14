
-- company_settings (singleton)
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  -- Company info
  company_name text NOT NULL DEFAULT 'Nolte Küchen',
  logo_url text,
  address text,
  phone text,
  email text,
  website text,
  ice text,
  if_number text,
  rc text,
  patente text,
  currency text NOT NULL DEFAULT 'MAD',
  default_vat numeric NOT NULL DEFAULT 20,
  default_language text NOT NULL DEFAULT 'fr',
  -- Personalization
  theme text NOT NULL DEFAULT 'light',
  primary_color text NOT NULL DEFAULT '#0f172a',
  date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  time_format text NOT NULL DEFAULT 'HH:mm',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton_true CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_read_authenticated" ON public.company_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.company_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.company_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

-- brands
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_read_auth" ON public.brands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "brands_admin_write" ON public.brands
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER brands_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- units
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  symbol text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_read_auth" ON public.units
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_admin_write" ON public.units
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER units_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed common units
INSERT INTO public.units (name, symbol) VALUES
  ('Pièce', 'pc'),
  ('Mètre', 'm'),
  ('Mètre carré', 'm²'),
  ('Mètre linéaire', 'ml'),
  ('Kilogramme', 'kg'),
  ('Litre', 'L'),
  ('Boîte', 'bte'),
  ('Paquet', 'pqt')
ON CONFLICT (name) DO NOTHING;

-- Also expose categories to admin management (categories table already exists with RLS - ensure admins can write)
-- We assume existing policies allow authenticated management; skip changes.

-- Backfill brands from existing products.brand text
INSERT INTO public.brands (name)
SELECT DISTINCT trim(brand)
FROM public.products
WHERE brand IS NOT NULL AND trim(brand) <> ''
ON CONFLICT (name) DO NOTHING;

-- Add brand_id FK to products (keep brand text for now for backward compat)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

UPDATE public.products p
SET brand_id = b.id
FROM public.brands b
WHERE p.brand_id IS NULL AND p.brand IS NOT NULL AND trim(p.brand) = b.name;
