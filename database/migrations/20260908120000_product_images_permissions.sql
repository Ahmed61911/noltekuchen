-- Product images: allow anyone with products.update to manage them.
--
-- Problem: migration 20260711164236 narrowed the product-images bucket's
-- write policies to has_role(auth.uid(),'admin'). The catalogue is actually
-- maintained by a `manager` account, so uploads/replacements/deletions were
-- silently rejected by RLS while the UI showed a working uploader. Reads were
-- never restricted, so existing images still displayed — which is why this
-- looked like a broken upload rather than a permissions problem.
--
-- Fix: drive the write policies off the existing permission matrix, exactly
-- as public.stock_movements_insert already does, instead of a second
-- hardcoded role list. Image rights now follow the Roles/Permissions screen.
--
-- Verified on production 2026-09-08 before writing this migration:
--   * user_has_permission(uuid,text,text) is SECURITY DEFINER and EXECUTE is
--     granted to `authenticated`, so it is callable from inside RLS.
--   * permissions already contains the ('products','update') row.
--   * all three existing users evaluate products.update = true, so this
--     restores image management to the manager without granting any user a
--     capability they did not already have on the products table itself.
--
-- SELECT policy (product_images_select) is deliberately left untouched.

begin;

drop policy if exists product_images_insert_admin on storage.objects;
drop policy if exists product_images_update_admin on storage.objects;
drop policy if exists product_images_delete_admin on storage.objects;

create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.user_has_permission(auth.uid(), 'products', 'update')
  );

-- UPDATE keeps both USING (which rows may be updated) and WITH CHECK (what the
-- row may become), mirroring the admin policy this replaces.
create policy product_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and public.user_has_permission(auth.uid(), 'products', 'update')
  )
  with check (
    bucket_id = 'product-images'
    and public.user_has_permission(auth.uid(), 'products', 'update')
  );

create policy product_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and public.user_has_permission(auth.uid(), 'products', 'update')
  );

commit;
