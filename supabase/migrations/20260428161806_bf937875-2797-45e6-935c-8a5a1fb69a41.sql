
-- user_recent_views
CREATE TABLE IF NOT EXISTS public.user_recent_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  entity_name text NOT NULL DEFAULT '',
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_recent_views_user_time ON public.user_recent_views(user_id, viewed_at DESC);
ALTER TABLE public.user_recent_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own recent views select" ON public.user_recent_views FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own recent views insert" ON public.user_recent_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own recent views update" ON public.user_recent_views FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own recent views delete" ON public.user_recent_views FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_pins
CREATE TABLE IF NOT EXISTS public.user_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  entity_name text NOT NULL DEFAULT '',
  pinned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own pins select" ON public.user_pins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own pins insert" ON public.user_pins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own pins update" ON public.user_pins FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own pins delete" ON public.user_pins FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notification category
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS notification_category text NOT NULL DEFAULT 'activity';
