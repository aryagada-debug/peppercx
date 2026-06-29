
-- Survey invites and responses for Pepper Pulse NPS/CSAT
CREATE TABLE public.survey_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  deal_id text NOT NULL REFERENCES public.staffing_deals(id) ON DELETE CASCADE,
  stakeholder_id uuid REFERENCES public.deal_stakeholders(id) ON DELETE SET NULL,
  recipient_name text NOT NULL DEFAULT '',
  recipient_email text NOT NULL,
  cc_emails text[] NOT NULL DEFAULT '{}',
  account_snapshot text NOT NULL DEFAULT '',
  deal_name_snapshot text NOT NULL DEFAULT '',
  vsd_name text NOT NULL DEFAULT '',
  principal_bopm text NOT NULL DEFAULT '',
  senior_bopm text NOT NULL DEFAULT '',
  bopm text NOT NULL DEFAULT '',
  sent_by uuid,
  sent_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending',
  gmail_message_id text,
  error text,
  opened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_invites TO authenticated;
GRANT ALL ON public.survey_invites TO service_role;

ALTER TABLE public.survey_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage survey_invites"
  ON public.survey_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Visible deal invites readable"
  ON public.survey_invites FOR SELECT TO authenticated
  USING (deal_id IN (SELECT deal_id FROM public.visible_deal_ids_for_user(auth.uid())));

CREATE POLICY "Visible deal invites insertable"
  ON public.survey_invites FOR INSERT TO authenticated
  WITH CHECK (deal_id IN (SELECT deal_id FROM public.visible_deal_ids_for_user(auth.uid())));

CREATE INDEX idx_survey_invites_deal ON public.survey_invites(deal_id);
CREATE INDEX idx_survey_invites_token ON public.survey_invites(token);

CREATE TRIGGER trg_survey_invites_updated
  BEFORE UPDATE ON public.survey_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid REFERENCES public.survey_invites(id) ON DELETE SET NULL,
  deal_id text REFERENCES public.staffing_deals(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  nps int,
  csat_avg numeric,
  ces int,
  renew text,
  mood text,
  churn_risk text,
  respondent_name text,
  respondent_email text,
  respondent_company text,
  wants_followup text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all responses"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Visible deal responses readable"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (deal_id IN (SELECT deal_id FROM public.visible_deal_ids_for_user(auth.uid())));

CREATE INDEX idx_survey_responses_deal ON public.survey_responses(deal_id);
CREATE INDEX idx_survey_responses_invite ON public.survey_responses(invite_id);

-- Public helper for the unauthenticated survey page to hydrate prefill data.
CREATE OR REPLACE FUNCTION public.get_survey_invite_by_token(_token text)
RETURNS TABLE(
  invite_id uuid,
  recipient_name text,
  recipient_email text,
  account_snapshot text,
  deal_name_snapshot text,
  completed boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, recipient_name, recipient_email, account_snapshot, deal_name_snapshot,
         completed_at IS NOT NULL
    FROM public.survey_invites
   WHERE token = _token
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_survey_invite_by_token(text) TO anon, authenticated;
