-- 1) DM threads table
CREATE TABLE IF NOT EXISTS public.slack_dm_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_user_id uuid NOT NULL,
  slack_user_id text NOT NULL,
  slack_user_name text NOT NULL DEFAULT '',
  slack_user_email text NOT NULL DEFAULT '',
  im_channel_id text NOT NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_user_id, slack_user_id)
);

ALTER TABLE public.slack_dm_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own DM threads select"
  ON public.slack_dm_threads FOR SELECT TO authenticated
  USING (auth.uid() = app_user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Own DM threads insert"
  ON public.slack_dm_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = app_user_id);

CREATE POLICY "Own DM threads update"
  ON public.slack_dm_threads FOR UPDATE TO authenticated
  USING (auth.uid() = app_user_id);

CREATE POLICY "Own DM threads delete"
  ON public.slack_dm_threads FOR DELETE TO authenticated
  USING (auth.uid() = app_user_id);

CREATE TRIGGER trg_slack_dm_threads_updated_at
  BEFORE UPDATE ON public.slack_dm_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_slack_dm_threads_user ON public.slack_dm_threads(app_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_slack_dm_threads_im_channel ON public.slack_dm_threads(im_channel_id);

-- 2) Add dm_thread_id to slack_messages
ALTER TABLE public.slack_messages
  ADD COLUMN IF NOT EXISTS dm_thread_id uuid;

CREATE INDEX IF NOT EXISTS idx_slack_messages_dm_thread ON public.slack_messages(dm_thread_id, created_at);

-- 3) Make deal_id nullable on slack_messages so DM messages (no deal) can be inserted
ALTER TABLE public.slack_messages
  ALTER COLUMN deal_id DROP NOT NULL;

-- 4) Realtime: ensure slack_messages and slack_dm_threads are published
ALTER PUBLICATION supabase_realtime ADD TABLE public.slack_dm_threads;
