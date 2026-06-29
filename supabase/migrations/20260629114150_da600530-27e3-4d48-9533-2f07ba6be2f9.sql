
CREATE OR REPLACE FUNCTION public.submit_survey_response(
  _token text,
  _nps int,
  _csat int,
  _comment text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.survey_invites%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(trim(_token)) < 12 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF _nps IS NULL OR _nps < 0 OR _nps > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_nps');
  END IF;
  IF _csat IS NULL OR _csat < 1 OR _csat > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_csat');
  END IF;

  SELECT * INTO v_invite FROM public.survey_invites WHERE token = trim(_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF v_invite.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  INSERT INTO public.survey_responses (
    invite_id, deal_id, nps, csat_avg,
    respondent_name, respondent_email, respondent_company, payload
  ) VALUES (
    v_invite.id, v_invite.deal_id, _nps, _csat,
    v_invite.recipient_name, v_invite.recipient_email, v_invite.account_snapshot,
    COALESCE(_payload, '{}'::jsonb) || jsonb_build_object('comment', _comment)
  );

  UPDATE public.survey_invites
     SET completed_at = now(),
         opened_at = COALESCE(opened_at, now())
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_survey_response(text, int, int, text, jsonb) TO anon, authenticated;

-- Revoke the direct anon insert path; the RPC is now the only entry.
REVOKE INSERT ON public.survey_responses FROM anon;
DROP POLICY IF EXISTS "Anon can submit survey response with valid invite" ON public.survey_responses;
