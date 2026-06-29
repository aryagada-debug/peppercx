
-- 1. Extend survey_responses
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS nps_category text,
  ADD COLUMN IF NOT EXISTS renewal_intent text,
  ADD COLUMN IF NOT EXISTS mood_v2 text,
  ADD COLUMN IF NOT EXISTS churn_risk_level text,
  ADD COLUMN IF NOT EXISTS churn_reasons text[],
  ADD COLUMN IF NOT EXISTS expansion_ready boolean,
  ADD COLUMN IF NOT EXISTS respondent_role text,
  ADD COLUMN IF NOT EXISTS capabilities text[];

-- 2. Config table
CREATE TABLE IF NOT EXISTS public.pulse_survey_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL DEFAULT 1,
  config jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.pulse_survey_config TO anon, authenticated;
GRANT INSERT, UPDATE ON public.pulse_survey_config TO authenticated;
GRANT ALL ON public.pulse_survey_config TO service_role;

ALTER TABLE public.pulse_survey_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pulse_config_read_all" ON public.pulse_survey_config;
CREATE POLICY "pulse_config_read_all" ON public.pulse_survey_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pulse_config_admin_write" ON public.pulse_survey_config;
CREATE POLICY "pulse_config_admin_write" ON public.pulse_survey_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS pulse_survey_config_updated ON public.pulse_survey_config;
CREATE TRIGGER pulse_survey_config_updated BEFORE UPDATE ON public.pulse_survey_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a single empty config row if none exists (client falls back to bundled defaults)
INSERT INTO public.pulse_survey_config (config, is_active)
SELECT '{}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.pulse_survey_config);

-- 3. Submit RPC
CREATE OR REPLACE FUNCTION public.submit_pulse_response(
  _token text,
  _payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.survey_invites%ROWTYPE;
  v_nps int;
  v_nps_cat text;
  v_csat numeric;
  v_csat_int int;
  v_role text;
  v_caps text[];
  v_renewal text;
  v_mood text;
  v_risk text;
  v_reasons text[];
  v_exp_ready boolean;
BEGIN
  IF _token IS NULL OR length(trim(_token)) < 12 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_invite FROM public.survey_invites WHERE token = trim(_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF v_invite.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  v_nps := NULLIF((_payload #>> '{nps,score}'), '')::int;
  IF v_nps IS NULL OR v_nps < 0 OR v_nps > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_nps');
  END IF;
  v_nps_cat := COALESCE(_payload #>> '{nps,category}',
                CASE WHEN v_nps <= 6 THEN 'Detractor'
                     WHEN v_nps <= 8 THEN 'Passive'
                     ELSE 'Promoter' END);

  v_csat := NULLIF((_payload #>> '{experience,avg}'), '')::numeric;
  v_csat_int := GREATEST(1, LEAST(5, ROUND(COALESCE(v_csat, 3))::int));

  v_role        := _payload #>> '{respondent,role}';
  v_renewal     := _payload #>> '{retention,renewal_intent}';
  v_mood        := _payload #>> '{sentiment,mood}';
  v_risk        := _payload #>> '{flags,churn_risk}';
  v_exp_ready   := NULLIF(_payload #>> '{flags,expansion_ready}','')::boolean;

  SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload #> '{respondent,capabilities}', '[]'::jsonb)))
    INTO v_caps;
  SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload #> '{flags,reasons}', '[]'::jsonb)))
    INTO v_reasons;

  INSERT INTO public.survey_responses (
    invite_id, deal_id, nps, csat_avg,
    respondent_name, respondent_email, respondent_company, payload,
    nps_category, renewal_intent, mood_v2, churn_risk_level, churn_reasons,
    expansion_ready, respondent_role, capabilities
  ) VALUES (
    v_invite.id, v_invite.deal_id, v_nps, v_csat_int,
    COALESCE(_payload #>> '{respondent,name}', v_invite.recipient_name),
    COALESCE(_payload #>> '{respondent,email}', v_invite.recipient_email),
    COALESCE(_payload #>> '{respondent,company}', v_invite.account_snapshot),
    _payload,
    v_nps_cat, v_renewal, v_mood, v_risk, v_reasons,
    v_exp_ready, v_role, v_caps
  );

  UPDATE public.survey_invites
     SET completed_at = now(),
         opened_at = COALESCE(opened_at, now())
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'churn_risk', v_risk);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_pulse_response(text, jsonb) TO anon, authenticated;
