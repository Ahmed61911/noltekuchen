
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS sku text;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON public.products (sku) WHERE sku IS NOT NULL;

INSERT INTO public.warehouses (name, description, is_active)
SELECT v.name, v.description, true
FROM (VALUES
  ('Dépôt 1', 'Électroménager Bosch'),
  ('Dépôt 2', 'Jacob + Électro Pro + Caissons'),
  ('Dépôt 3', 'Machines Teka + Bosch'),
  ('Dépôt 4', 'Caissons'),
  ('Dépôt 5', 'Panneaux & Accessoires')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.name = v.name);
