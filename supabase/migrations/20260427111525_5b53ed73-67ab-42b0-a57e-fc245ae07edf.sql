
-- 1. user_quotas
CREATE TABLE public.user_quotas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('month','quarter','year')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_type, period_start)
);
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own quotas select" ON public.user_quotas FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Own quotas insert" ON public.user_quotas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Own quotas update" ON public.user_quotas FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Own quotas delete" ON public.user_quotas FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE TRIGGER update_user_quotas_updated_at BEFORE UPDATE ON public.user_quotas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. user_notifications
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  actor_name TEXT NOT NULL DEFAULT '',
  actor_avatar_url TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  source_entity_type TEXT NOT NULL DEFAULT '',
  source_entity_id TEXT NOT NULL DEFAULT '',
  source_entity_name TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_href TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_notifications_user_created ON public.user_notifications (user_id, created_at DESC);
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications select" ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own notifications insert" ON public.user_notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own notifications update" ON public.user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own notifications delete" ON public.user_notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

-- 3. smart_nudges
CREATE TABLE public.smart_nudges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  target_entity_type TEXT NOT NULL DEFAULT '',
  target_entity_id TEXT NOT NULL DEFAULT '',
  target_entity_name TEXT NOT NULL DEFAULT '',
  primary_action_label TEXT NOT NULL DEFAULT '',
  primary_action_href TEXT NOT NULL DEFAULT '',
  primary_action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  snoozed_until TIMESTAMPTZ
);
CREATE INDEX idx_smart_nudges_user ON public.smart_nudges (user_id, generated_at DESC);
ALTER TABLE public.smart_nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own nudges select" ON public.smart_nudges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own nudges insert" ON public.smart_nudges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own nudges update" ON public.smart_nudges FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own nudges delete" ON public.smart_nudges FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.smart_nudges;
ALTER TABLE public.smart_nudges REPLICA IDENTITY FULL;

-- 4. user_recent_views
CREATE TABLE public.user_recent_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL DEFAULT '',
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
CREATE INDEX idx_recent_views_user ON public.user_recent_views (user_id, viewed_at DESC);
ALTER TABLE public.user_recent_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own recents all" ON public.user_recent_views FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. user_pins
CREATE TABLE public.user_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL DEFAULT '',
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own pins all" ON public.user_pins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. user_nudge_settings
CREATE TABLE public.user_nudge_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nudge_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nudge_type)
);
ALTER TABLE public.user_nudge_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own nudge settings all" ON public.user_nudge_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
