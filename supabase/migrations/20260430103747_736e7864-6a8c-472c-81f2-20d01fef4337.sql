
-- 1. Columns on staffing_deals to track uploaded files (storage paths)
ALTER TABLE public.staffing_deals
  ADD COLUMN IF NOT EXISTS contract_file_path TEXT,
  ADD COLUMN IF NOT EXISTS sow_file_path TEXT;

-- 2. Private storage bucket for deal documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-documents', 'deal-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies (authenticated users can manage deal documents)
DROP POLICY IF EXISTS "Authenticated read deal-documents"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert deal-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update deal-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete deal-documents" ON storage.objects;

CREATE POLICY "Authenticated read deal-documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deal-documents');

CREATE POLICY "Authenticated insert deal-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'deal-documents');

CREATE POLICY "Authenticated update deal-documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'deal-documents');

CREATE POLICY "Authenticated delete deal-documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'deal-documents');
