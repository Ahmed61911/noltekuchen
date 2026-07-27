-- Fix document-number generation for orders, sales, invoices, quotes and
-- purchase_orders.
--
-- Each of those tables defaults its number column to a generate_*_number()
-- function, and a column DEFAULT is evaluated as the *inserting* role. Two
-- separate gaps meant that role could not run them:
--
--   1. EXECUTE: 20260627142329 and 20260711164236 revoked
--      generate_order_number / generate_sale_number / generate_invoice_number
--      FROM PUBLIC, anon. As with user_has_permission, `authenticated` held
--      no explicit grant — only the implicit PUBLIC one — so the revoke
--      removed its access too. (quote/purchase_order were never revoked and
--      still had the PUBLIC grant.)
--
--   2. nextval: all five are SECURITY INVOKER and call
--      nextval('public.*_number_seq'), but `authenticated` has no USAGE on
--      any of those five sequences. So even the two functions that kept
--      EXECUTE still failed with "permission denied for sequence".
--
-- Net effect: creating an order, sale, invoice, quote or purchase order
-- failed for every logged-in user, admins included.
--
-- Fixed by making the functions SECURITY DEFINER so nextval runs as the
-- owner, rather than granting sequence USAGE to authenticated — that keeps
-- the function as the only way to advance these counters instead of letting
-- any logged-in user bump them directly. All five already carry
-- SET search_path = public, which is what makes SECURITY DEFINER safe here.
ALTER FUNCTION public.generate_order_number() SECURITY DEFINER;
ALTER FUNCTION public.generate_sale_number() SECURITY DEFINER;
ALTER FUNCTION public.generate_invoice_number() SECURITY DEFINER;
ALTER FUNCTION public.generate_quote_number() SECURITY DEFINER;
ALTER FUNCTION public.generate_purchase_order_number() SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_sale_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_quote_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_purchase_order_number() TO authenticated;

-- anon has no business minting document numbers.
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_sale_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_quote_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_purchase_order_number() FROM PUBLIC, anon;
