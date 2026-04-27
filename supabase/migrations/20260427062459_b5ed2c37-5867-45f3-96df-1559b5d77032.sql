CREATE TABLE public.mbr_calendar_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mbr_entry_id uuid NOT NULL,
  google_event_id text NOT NULL,
  google_calendar_id text NOT NULL DEFAULT 'primary',
  user_id uuid NOT NULL,
  html_link text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mbr_entry_id, user_id)
);

ALTER TABLE public.mbr_calendar_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own calendar links select"
  ON public.mbr_calendar_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Own calendar links insert"
  ON public.mbr_calendar_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own calendar links update"
  ON public.mbr_calendar_links FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Own calendar links delete"
  ON public.mbr_calendar_links FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_mbr_calendar_links_mbr ON public.mbr_calendar_links (mbr_entry_id);
CREATE INDEX idx_mbr_calendar_links_user ON public.mbr_calendar_links (user_id);