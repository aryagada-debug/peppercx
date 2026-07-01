
CREATE TABLE IF NOT EXISTS public.slack_channel_audits (
  deal_id text PRIMARY KEY REFERENCES public.staffing_deals(id) ON DELETE CASCADE,
  rating text NOT NULL DEFAULT 'R',
  health_sentiment text NOT NULL DEFAULT '',
  scope_of_work text NOT NULL DEFAULT '',
  customer_cares text NOT NULL DEFAULT '',
  engagement text NOT NULL DEFAULT '',
  performance_results text NOT NULL DEFAULT '',
  churn_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_is_working jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_action text NOT NULL DEFAULT '',
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  window_weeks int NOT NULL DEFAULT 12,
  model text NOT NULL DEFAULT '',
  computed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.slack_channel_audits TO authenticated;
GRANT ALL ON public.slack_channel_audits TO service_role;

ALTER TABLE public.slack_channel_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership can read slack audits"
ON public.slack_channel_audits
FOR SELECT TO authenticated
USING (public.is_leadership_viewer(auth.uid()));
