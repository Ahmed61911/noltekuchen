-- Stock quantities: integer -> numeric(12,2).
--
-- Line items on every document (order_items, sale_items, invoice_items,
-- quote_items, purchase_order_items) are numeric(12,2), but stock_movements
-- and products stored whole units, so every stock trigger bridged the two
-- with GREATEST(1, ceil(quantity)::int). For a kitchen business selling
-- worktops by the linear metre that is silent, systematic corruption:
-- selling 2.5 m deducted 3, and a zero-quantity line still deducted 1.
--
-- Widening integer -> numeric is lossless, so existing rows carry over
-- unchanged. The triggers themselves are rewritten in the next migration;
-- this one only makes the columns capable of holding the right answer.
ALTER TABLE public.products
  ALTER COLUMN stock_quantity TYPE numeric(12,2),
  ALTER COLUMN min_stock      TYPE numeric(12,2);

ALTER TABLE public.stock_movements
  ALTER COLUMN quantity     TYPE numeric(12,2),
  ALTER COLUMN stock_before TYPE numeric(12,2),
  ALTER COLUMN stock_after  TYPE numeric(12,2);

-- A movement of zero units is meaningless and was previously coerced to 1 by
-- the GREATEST(). Reject it outright instead. (The original table already had
-- CHECK (quantity > 0); it is restated here because the type change rewrites
-- the constraint, and to make the intent explicit alongside the new columns.)
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_quantity_check;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_quantity_check CHECK (quantity > 0);
