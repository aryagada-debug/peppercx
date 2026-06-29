
-- Allow anon role to insert survey responses linked to a still-open invite.
GRANT INSERT ON public.survey_responses TO anon;

DROP POLICY IF EXISTS "Anon can submit survey response with valid invite" ON public.survey_responses;
CREATE POLICY "Anon can submit survey response with valid invite"
ON public.survey_responses
FOR INSERT
TO anon
WITH CHECK (
  invite_id IN (
    SELECT id FROM public.survey_invites WHERE completed_at IS NULL
  )
);

-- Anon needs to read invite metadata via the existing definer RPC.
GRANT EXECUTE ON FUNCTION public.get_survey_invite_by_token(text) TO anon;

-- Token-scoped status update (opened / completed) usable by anon.
CREATE OR REPLACE FUNCTION public.mark_survey_invite(_token text, _state text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _token IS NULL OR length(trim(_token)) < 12 THEN
    RETURN;
  END IF;
  IF _state = 'opened' THEN
    UPDATE public.survey_invites
       SET opened_at = COALESCE(opened_at, now())
     WHERE token = trim(_token);
  ELSIF _state = 'completed' THEN
    UPDATE public.survey_invites
       SET completed_at = COALESCE(completed_at, now()),
           opened_at = COALESCE(opened_at, now())
     WHERE token = trim(_token);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_survey_invite(text, text) TO anon, authenticated;
