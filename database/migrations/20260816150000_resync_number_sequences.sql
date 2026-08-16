-- Fix: "duplicate key value violates unique constraint quotes_quote_number_key"
-- (and the same latent bug on orders/sales/invoices/purchase orders).
--
-- The *_number_seq sequences are behind the data: existing rows were
-- seeded/imported with explicit numbers without advancing the sequence, so the
-- first real nextval() returns a value that already exists. Advance each
-- sequence past the max numeric suffix currently in its table.
--
-- substring(num from '([0-9]+)$') pulls the trailing digits regardless of the
-- prefix/date format (DEV-2608-0012 -> 0012 -> 12). Only moves forward, and
-- only when the table already has data (so fresh installs still start at 1).

DO $$
DECLARE m bigint;
BEGIN
  SELECT COALESCE(MAX(substring(quote_number from '([0-9]+)$')::bigint), 0) INTO m FROM public.quotes;
  IF m > 0 THEN PERFORM setval('public.quote_number_seq', GREATEST(m, (SELECT last_value FROM public.quote_number_seq))); END IF;

  SELECT COALESCE(MAX(substring(order_number from '([0-9]+)$')::bigint), 0) INTO m FROM public.orders;
  IF m > 0 THEN PERFORM setval('public.order_number_seq', GREATEST(m, (SELECT last_value FROM public.order_number_seq))); END IF;

  SELECT COALESCE(MAX(substring(sale_number from '([0-9]+)$')::bigint), 0) INTO m FROM public.sales;
  IF m > 0 THEN PERFORM setval('public.sale_number_seq', GREATEST(m, (SELECT last_value FROM public.sale_number_seq))); END IF;

  SELECT COALESCE(MAX(substring(invoice_number from '([0-9]+)$')::bigint), 0) INTO m FROM public.invoices;
  IF m > 0 THEN PERFORM setval('public.invoice_number_seq', GREATEST(m, (SELECT last_value FROM public.invoice_number_seq))); END IF;

  SELECT COALESCE(MAX(substring(po_number from '([0-9]+)$')::bigint), 0) INTO m FROM public.purchase_orders;
  IF m > 0 THEN PERFORM setval('public.purchase_order_number_seq', GREATEST(m, (SELECT last_value FROM public.purchase_order_number_seq))); END IF;
END $$;
