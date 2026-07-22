
ALTER TABLE public.seo_kra_reviews
  ADD COLUMN IF NOT EXISTS reviewer_email text,
  ADD COLUMN IF NOT EXISTS reviewer_name text;

CREATE OR REPLACE FUNCTION public.is_seo_kra_reviewer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR lower(coalesce(auth.jwt() ->> 'email','')) = ANY (ARRAY[
        'mayur@peppercontent.io',
        'vedanga@peppercontent.io'
      ])
$$;

DROP POLICY IF EXISTS "kra reviews reviewer all" ON public.seo_kra_reviews;
CREATE POLICY "kra reviews reviewer all" ON public.seo_kra_reviews
  FOR ALL TO authenticated
  USING (public.is_seo_kra_reviewer())
  WITH CHECK (public.is_seo_kra_reviewer());

DROP POLICY IF EXISTS "kra scores reviewer all" ON public.seo_kra_scores;
CREATE POLICY "kra scores reviewer all" ON public.seo_kra_scores
  FOR ALL TO authenticated
  USING (public.is_seo_kra_reviewer())
  WITH CHECK (public.is_seo_kra_reviewer());
