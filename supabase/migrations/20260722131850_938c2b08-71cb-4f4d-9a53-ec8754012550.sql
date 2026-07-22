
CREATE TABLE public.seo_kra_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_key text NOT NULL DEFAULT 'growth_lead',
  member_user_id uuid NOT NULL,
  member_name text NOT NULL DEFAULT '',
  year int NOT NULL,
  quarter text NOT NULL CHECK (quarter IN ('Q1','Q2','Q3','Q4')),
  reviewer_user_id uuid,
  reviewer_name text NOT NULL DEFAULT '',
  total numeric,
  area_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scorecard_key, member_user_id, year, quarter)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_kra_reviews TO authenticated;
GRANT ALL ON public.seo_kra_reviews TO service_role;
ALTER TABLE public.seo_kra_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kra reviews admin all" ON public.seo_kra_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "kra reviews self read" ON public.seo_kra_reviews
  FOR SELECT TO authenticated
  USING (member_user_id = auth.uid());

CREATE TRIGGER seo_kra_reviews_updated
  BEFORE UPDATE ON public.seo_kra_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.seo_kra_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.seo_kra_reviews(id) ON DELETE CASCADE,
  kpi_id text NOT NULL,
  score int CHECK (score IS NULL OR (score BETWEEN 1 AND 10)),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, kpi_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_kra_scores TO authenticated;
GRANT ALL ON public.seo_kra_scores TO service_role;
ALTER TABLE public.seo_kra_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kra scores admin all" ON public.seo_kra_scores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "kra scores self read" ON public.seo_kra_scores
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.seo_kra_reviews r
    WHERE r.id = seo_kra_scores.review_id
      AND r.member_user_id = auth.uid()
  ));

CREATE TRIGGER seo_kra_scores_updated
  BEFORE UPDATE ON public.seo_kra_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX seo_kra_reviews_lookup ON public.seo_kra_reviews (scorecard_key, year, quarter);
CREATE INDEX seo_kra_scores_review ON public.seo_kra_scores (review_id);
