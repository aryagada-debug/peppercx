
CREATE TABLE public.client_one_on_ones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id TEXT NOT NULL,
  quarter TEXT NOT NULL CHECK (quarter IN ('JFM','AMJ','JAS','OND')),
  year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Scheduled','Done')),
  fathom_url TEXT,
  insights_pdf_path TEXT,
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, quarter, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_one_on_ones TO authenticated;
GRANT ALL ON public.client_one_on_ones TO service_role;

ALTER TABLE public.client_one_on_ones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client 1-1s"
  ON public.client_one_on_ones
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_client_one_on_ones_updated_at
  BEFORE UPDATE ON public.client_one_on_ones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_client_one_on_ones_year ON public.client_one_on_ones(year);
CREATE INDEX idx_client_one_on_ones_deal ON public.client_one_on_ones(deal_id);

-- Storage policies for client-one-on-ones bucket (admin-only)
CREATE POLICY "Admins read client 1-1 pdfs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-one-on-ones' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins upload client 1-1 pdfs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-one-on-ones' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update client 1-1 pdfs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'client-one-on-ones' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'client-one-on-ones' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete client 1-1 pdfs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-one-on-ones' AND public.has_role(auth.uid(), 'admin'::app_role));
