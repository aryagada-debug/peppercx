DROP POLICY IF EXISTS "Admins read staffing exports" ON storage.objects;
CREATE POLICY "Admins read staffing exports" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'staffing-exports' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins write staffing exports" ON storage.objects;
CREATE POLICY "Admins write staffing exports" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staffing-exports' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update staffing exports" ON storage.objects;
CREATE POLICY "Admins update staffing exports" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'staffing-exports' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete staffing exports" ON storage.objects;
CREATE POLICY "Admins delete staffing exports" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'staffing-exports' AND public.has_role(auth.uid(), 'admin'::app_role));