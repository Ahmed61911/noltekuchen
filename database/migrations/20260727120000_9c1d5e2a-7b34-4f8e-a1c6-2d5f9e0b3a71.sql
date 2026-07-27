-- Create the storage buckets the app uploads into.
--
-- Migrations 20260603185423 / 20260611232746 / 20260711164236 create RLS
-- policies on storage.objects scoped to bucket_id 'product-images' and
-- 'documents', but nothing ever creates the buckets themselves — on Lovable
-- they were created by hand in the dashboard, which self-hosting never
-- reproduces. Storage-api rejects an upload to a non-existent bucket before
-- RLS is ever consulted, so every file feature (product images, document
-- upload, project attachments) fails with "Bucket not found".
--
-- Both are private: the app reads them back via createSignedUrl(), which
-- only works on private buckets — a public bucket would also expose every
-- uploaded document to anyone who guesses the URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('product-images', 'product-images', false, 52428800),
  ('documents',      'documents',      false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- storage-api resolves the bucket by impersonating the caller's role, so the
-- bucket row has to be readable under RLS or the upload still 404s even
-- though the row now exists. The storage.objects policies above already
-- constrain what can actually be written.
DROP POLICY IF EXISTS "buckets_read_authenticated" ON storage.buckets;
CREATE POLICY "buckets_read_authenticated" ON storage.buckets
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON storage.buckets TO authenticated;
