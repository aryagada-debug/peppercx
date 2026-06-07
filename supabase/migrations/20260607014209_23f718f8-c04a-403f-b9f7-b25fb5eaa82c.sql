
-- Leadership Intervention Needed (RGY) tables

CREATE TABLE IF NOT EXISTS public.rgy_leadership_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL REFERENCES public.staffing_deals(id) ON DELETE CASCADE,
  rgy_week date,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  urgency text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Open',
  raised_by_user_id uuid NOT NULL,
  raised_by_name text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  resolved_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rgy_leadership_interventions TO authenticated;
GRANT ALL ON public.rgy_leadership_interventions TO service_role;

ALTER TABLE public.rgy_leadership_interventions ENABLE ROW LEVEL SECURITY;

-- Helper: who is a "leadership viewer"
CREATE OR REPLACE FUNCTION public.is_leadership_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'member'::app_role, 'capability_lead'::app_role)
  )
$$;

-- Anyone authenticated can raise
CREATE POLICY "Any user can raise interventions"
  ON public.rgy_leadership_interventions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = raised_by_user_id);

-- Raiser can see their own; leadership sees all
CREATE POLICY "View own or leadership"
  ON public.rgy_leadership_interventions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = raised_by_user_id
    OR public.is_leadership_viewer(auth.uid())
  );

-- Raiser can edit while Open; leadership can always update
CREATE POLICY "Update by raiser when open or leadership"
  ON public.rgy_leadership_interventions
  FOR UPDATE TO authenticated
  USING (
    public.is_leadership_viewer(auth.uid())
    OR (auth.uid() = raised_by_user_id AND status = 'Open')
  )
  WITH CHECK (
    public.is_leadership_viewer(auth.uid())
    OR (auth.uid() = raised_by_user_id AND status = 'Open')
  );

-- Leadership or raiser can delete (raiser only if Open)
CREATE POLICY "Delete by raiser when open or leadership"
  ON public.rgy_leadership_interventions
  FOR DELETE TO authenticated
  USING (
    public.is_leadership_viewer(auth.uid())
    OR (auth.uid() = raised_by_user_id AND status = 'Open')
  );

CREATE TRIGGER update_rgy_leadership_interventions_updated_at
  BEFORE UPDATE ON public.rgy_leadership_interventions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_rli_deal ON public.rgy_leadership_interventions(deal_id);
CREATE INDEX IF NOT EXISTS idx_rli_status ON public.rgy_leadership_interventions(status);
CREATE INDEX IF NOT EXISTS idx_rli_raised_by ON public.rgy_leadership_interventions(raised_by_user_id);


-- Comments table
CREATE TABLE IF NOT EXISTS public.rgy_leadership_intervention_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.rgy_leadership_interventions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rgy_leadership_intervention_comments TO authenticated;
GRANT ALL ON public.rgy_leadership_intervention_comments TO service_role;

ALTER TABLE public.rgy_leadership_intervention_comments ENABLE ROW LEVEL SECURITY;

-- Comment visibility: anyone who can see the parent intervention can see comments
CREATE POLICY "View comments if can see intervention"
  ON public.rgy_leadership_intervention_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rgy_leadership_interventions i
      WHERE i.id = intervention_id
        AND (i.raised_by_user_id = auth.uid() OR public.is_leadership_viewer(auth.uid()))
    )
  );

-- Anyone who can see the intervention can post a comment
CREATE POLICY "Post comments if can see intervention"
  ON public.rgy_leadership_intervention_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.rgy_leadership_interventions i
      WHERE i.id = intervention_id
        AND (i.raised_by_user_id = auth.uid() OR public.is_leadership_viewer(auth.uid()))
    )
  );

-- Author can delete their own comment; leadership can delete any
CREATE POLICY "Delete own or leadership"
  ON public.rgy_leadership_intervention_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_leadership_viewer(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rli_comments_intervention ON public.rgy_leadership_intervention_comments(intervention_id);
