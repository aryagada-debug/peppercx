
ALTER TABLE public.seo_kra_reviews DROP CONSTRAINT IF EXISTS seo_kra_reviews_scorecard_key_member_user_id_year_quarter_key;
ALTER TABLE public.seo_kra_reviews ALTER COLUMN member_user_id DROP NOT NULL;
ALTER TABLE public.seo_kra_reviews ADD COLUMN IF NOT EXISTS member_person_id text;
ALTER TABLE public.seo_kra_reviews ADD CONSTRAINT seo_kra_reviews_unique
  UNIQUE (scorecard_key, member_person_id, year, quarter);

DROP POLICY IF EXISTS "kra reviews self read" ON public.seo_kra_reviews;
CREATE POLICY "kra reviews self read" ON public.seo_kra_reviews
  FOR SELECT TO authenticated
  USING (
    member_user_id = auth.uid()
    OR (member_person_id IS NOT NULL AND member_person_id = (
      SELECT staffing_person_id FROM public.profiles WHERE user_id = auth.uid()
    ))
  );
