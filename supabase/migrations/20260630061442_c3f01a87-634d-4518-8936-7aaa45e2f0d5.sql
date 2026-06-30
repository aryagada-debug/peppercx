CREATE TABLE IF NOT EXISTS public.staffing_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staffing_deal_id text NOT NULL,
  role_key text NOT NULL,
  person_id text,
  person_name text NOT NULL DEFAULT '',
  allocation_pct integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'handover',
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staffing_suggestions_deal_idx
  ON public.staffing_suggestions(staffing_deal_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS staffing_suggestions_unique_idx
  ON public.staffing_suggestions(staffing_deal_id, role_key, COALESCE(person_name,''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staffing_suggestions TO authenticated;
GRANT ALL ON public.staffing_suggestions TO service_role;

ALTER TABLE public.staffing_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read suggestions"
  ON public.staffing_suggestions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth insert suggestions"
  ON public.staffing_suggestions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "auth update suggestions"
  ON public.staffing_suggestions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth delete suggestions"
  ON public.staffing_suggestions FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_staffing_suggestions_updated_at
  BEFORE UPDATE ON public.staffing_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();