CREATE TABLE IF NOT EXISTS public.slack_inactivity_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  channel_id text NOT NULL,
  week_start date NOT NULL,
  message_count int NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slack_inactivity_nudges_uniq UNIQUE (deal_id, week_start)
);

ALTER TABLE public.slack_inactivity_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read inactivity nudges"
  ON public.slack_inactivity_nudges FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_slack_inactivity_nudges_deal ON public.slack_inactivity_nudges(deal_id, week_start DESC);