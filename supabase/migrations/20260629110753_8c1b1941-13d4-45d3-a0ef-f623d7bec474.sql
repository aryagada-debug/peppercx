REVOKE ALL ON TABLE public.survey_invites FROM anon;
REVOKE ALL ON TABLE public.survey_responses FROM anon;
REVOKE ALL ON TABLE public.pulse_email_templates FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_invites TO authenticated;
GRANT ALL ON TABLE public.survey_invites TO service_role;

GRANT SELECT ON TABLE public.survey_responses TO authenticated;
GRANT ALL ON TABLE public.survey_responses TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.pulse_email_templates TO authenticated;
GRANT ALL ON TABLE public.pulse_email_templates TO service_role;

CREATE OR REPLACE FUNCTION public.get_survey_invite_by_token(_token text)
RETURNS TABLE(
  invite_id uuid,
  recipient_name text,
  recipient_email text,
  account_snapshot text,
  deal_name_snapshot text,
  completed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.id,
    si.recipient_name,
    si.recipient_email,
    si.account_snapshot,
    si.deal_name_snapshot,
    si.completed_at IS NOT NULL
  FROM public.survey_invites si
  WHERE si.token = trim(coalesce(_token, ''))
    AND length(trim(coalesce(_token, ''))) BETWEEN 12 AND 256
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_survey_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_survey_invite_by_token(text) TO anon, authenticated, service_role;