CREATE TABLE public.user_page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  route_key text NOT NULL,
  path text NOT NULL DEFAULT '',
  visited_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_page_views TO authenticated;
GRANT ALL ON public.user_page_views TO service_role;

ALTER TABLE public.user_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own page views"
  ON public.user_page_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all page views"
  ON public.user_page_views FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_user_page_views_visited_at ON public.user_page_views (visited_at DESC);
CREATE INDEX idx_user_page_views_user_visited ON public.user_page_views (user_id, visited_at DESC);
CREATE INDEX idx_user_page_views_route ON public.user_page_views (route_key, visited_at DESC);