
CREATE POLICY "handover_docs_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'handover-docs');
CREATE POLICY "handover_docs_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'handover-docs');
CREATE POLICY "handover_docs_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'handover-docs') WITH CHECK (bucket_id = 'handover-docs');
CREATE POLICY "handover_docs_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'handover-docs');
