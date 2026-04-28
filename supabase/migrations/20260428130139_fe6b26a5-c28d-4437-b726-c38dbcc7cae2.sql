CREATE TABLE IF NOT EXISTS public.route_access_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  route_key text NOT NULL,
  view_summary text NOT NULL DEFAULT '',
  edit_summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, route_key)
);

ALTER TABLE public.route_access_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read route_access_summaries"
  ON public.route_access_summaries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert route_access_summaries"
  ON public.route_access_summaries FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update route_access_summaries"
  ON public.route_access_summaries FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete route_access_summaries"
  ON public.route_access_summaries FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER route_access_summaries_set_updated_at
BEFORE UPDATE ON public.route_access_summaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();