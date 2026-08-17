-- A visible "Stock endommagé" depot, so the stock-movement form can show and
-- auto-target it for damaged movements.
INSERT INTO public.warehouses (name, description, is_active)
SELECT 'Stock endommagé', 'Produits endommagés (hors stock vendable)', true
WHERE NOT EXISTS (SELECT 1 FROM public.warehouses WHERE name = 'Stock endommagé');
