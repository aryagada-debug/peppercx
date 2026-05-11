ALTER TABLE public.deal_tasks
  ADD COLUMN IF NOT EXISTS assignees text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '';

ALTER TABLE public.cx_tasks
  ADD COLUMN IF NOT EXISTS assignees text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '';

UPDATE public.deal_tasks
  SET assignees = ARRAY[assignee]
  WHERE assignee <> '' AND (assignees IS NULL OR array_length(assignees, 1) IS NULL);

UPDATE public.cx_tasks
  SET assignees = ARRAY[assignee]
  WHERE assignee <> '' AND (assignees IS NULL OR array_length(assignees, 1) IS NULL);

CREATE INDEX IF NOT EXISTS deal_tasks_assignees_gin ON public.deal_tasks USING GIN (assignees);
CREATE INDEX IF NOT EXISTS cx_tasks_assignees_gin ON public.cx_tasks USING GIN (assignees);