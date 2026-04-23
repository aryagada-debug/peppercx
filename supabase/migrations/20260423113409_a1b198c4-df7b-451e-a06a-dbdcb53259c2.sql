-- 1. Add slack_channel_id to staffing_deals
ALTER TABLE public.staffing_deals
  ADD COLUMN IF NOT EXISTS slack_channel_id text NOT NULL DEFAULT '';

-- 2. Create slack_messages table
CREATE TABLE IF NOT EXISTS public.slack_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id text NOT NULL,
  channel_id text NOT NULL,
  slack_ts text NOT NULL,
  thread_ts text,
  user_id text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'slack', -- 'slack' (incoming) | 'app' (sent from app)
  sent_by_app_user uuid,                -- auth.uid() of VSD who sent it (when source='app')
  sent_by_display_name text NOT NULL DEFAULT '',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS slack_messages_channel_ts_uniq
  ON public.slack_messages (channel_id, slack_ts);

CREATE INDEX IF NOT EXISTS slack_messages_deal_idx
  ON public.slack_messages (deal_id, created_at DESC);

ALTER TABLE public.slack_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read slack_messages"
  ON public.slack_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone authenticated can insert slack_messages"
  ON public.slack_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone authenticated can update slack_messages"
  ON public.slack_messages FOR UPDATE
  TO authenticated
  USING (true);

-- 3. Realtime
ALTER TABLE public.slack_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.slack_messages;