ALTER TABLE public.mbr_entries
  ADD COLUMN sentiment text,
  ADD COLUMN fathom_link text,
  ADD COLUMN transcript text,
  ADD COLUMN ai_summary text,
  ADD COLUMN action_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN scheduled_date date,
  ADD COLUMN anirudh_added boolean DEFAULT false,
  ADD COLUMN anirudh_joining boolean DEFAULT false,
  ADD COLUMN input_recorded_at timestamptz;