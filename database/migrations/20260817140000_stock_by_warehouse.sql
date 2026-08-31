-- Le dépôt d'un produit n'est plus une propriété de sa fiche mais le résultat
-- de ses mouvements : un produit « est » dans un dépôt s'il y reste du stock.
--
-- Cette vue agrège stock_movements par produit et par dépôt. Les écrans
-- (devis, commandes, ventes, retours) n'y proposent que les dépôts où le
-- produit a réellement du stock.
--
-- Le sens de chaque type reprend apply_stock_movement. Cas particulier de
-- 'damaged' : le mouvement porte le dépôt « Stock endommagé » et y fait ENTRER
-- la marchandise (la sortie du dépôt d'origine n'est pas tracée, celui-ci
-- n'étant pas enregistré sur le mouvement).

CREATE OR REPLACE VIEW public.product_stock_by_warehouse AS
SELECT
  m.product_id,
  m.warehouse_id,
  SUM(
    CASE
      WHEN m.type IN ('in', 'purchase', 'customer_return', 'inventory', 'damaged') THEN m.quantity
      WHEN m.type IN ('out', 'sale', 'supplier_return') THEN -m.quantity
      ELSE 0
    END
  )::numeric AS quantity
FROM public.stock_movements m
WHERE m.product_id IS NOT NULL
  AND m.warehouse_id IS NOT NULL
GROUP BY m.product_id, m.warehouse_id;

GRANT SELECT ON public.product_stock_by_warehouse TO authenticated;
