
CREATE TABLE public.trash_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_label text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_by uuid,
  deleted_by_name text NOT NULL DEFAULT '',
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  restored_at timestamptz
);

CREATE INDEX idx_trash_items_expires ON public.trash_items(entity_type, expires_at);
CREATE INDEX idx_trash_items_deleted_by ON public.trash_items(deleted_by);

ALTER TABLE public.trash_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own trash or admin" ON public.trash_items
  FOR SELECT TO authenticated
  USING (deleted_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated insert trash" ON public.trash_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = deleted_by);

CREATE POLICY "Owner or admin update trash" ON public.trash_items
  FOR UPDATE TO authenticated
  USING (deleted_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete trash" ON public.trash_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
