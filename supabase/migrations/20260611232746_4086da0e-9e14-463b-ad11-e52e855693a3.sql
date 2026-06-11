
-- Enum for document categories
DO $$ BEGIN
  CREATE TYPE public.document_category AS ENUM ('factures','devis','contrats','projets_cuisines','sav','photos','autres');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category public.document_category NOT NULL DEFAULT 'autres',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint NOT NULL DEFAULT 0,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update documents" ON public.documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete documents" ON public.documents FOR DELETE TO authenticated USING (true);

CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_customer ON public.documents(customer_id);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);

-- History
CREATE TABLE public.document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.document_history TO authenticated;
GRANT ALL ON public.document_history TO service_role;
ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read history" ON public.document_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert history" ON public.document_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_doc_history_doc ON public.document_history(document_id, created_at DESC);

-- Storage policies for the 'documents' bucket
CREATE POLICY "Auth read documents bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Auth upload documents bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Auth update documents bucket" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Auth delete documents bucket" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');
