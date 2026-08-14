-- Add unit_cost to stock_movements to preserve purchase price at time of movement
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost numeric(12,2);

-- Backfill existing rows with current product purchase_price
UPDATE stock_movements sm
SET unit_cost = p.purchase_price
FROM products p
WHERE sm.product_id = p.id
  AND sm.unit_cost IS NULL;
