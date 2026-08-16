-- Fix: "permission denied for sequence quote_number_seq" when creating a devis.
--
-- 20260727120200 made the *_number generators SECURITY DEFINER because the
-- `authenticated` role has no USAGE on the public.*_number_seq sequences, so
-- nextval() has to run as the function owner.
--
-- 20260814160000 then re-created generate_quote_number() with CREATE OR REPLACE
-- but omitted SECURITY DEFINER — and CREATE OR REPLACE resets the security
-- attribute to the default (INVOKER), silently reintroducing the bug.
--
-- Re-apply SECURITY DEFINER to generate_quote_number (with a locked
-- search_path), and defensively re-assert it on the other four generators in
-- case any is ever clobbered the same way.

CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text;
  seq_val bigint;
BEGIN
  prefix := 'DEV-' || to_char(CURRENT_DATE, 'YYMM');
  seq_val := nextval('public.quote_number_seq');
  RETURN prefix || '-' || lpad(seq_val::text, 4, '0');
END $$;

ALTER FUNCTION public.generate_order_number()          SECURITY DEFINER;
ALTER FUNCTION public.generate_sale_number()           SECURITY DEFINER;
ALTER FUNCTION public.generate_invoice_number()        SECURITY DEFINER;
ALTER FUNCTION public.generate_purchase_order_number() SECURITY DEFINER;
