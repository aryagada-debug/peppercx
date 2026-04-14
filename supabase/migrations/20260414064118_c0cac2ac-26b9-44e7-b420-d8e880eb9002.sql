ALTER TABLE public.deal_tasks
ADD COLUMN estimated_hours numeric NOT NULL DEFAULT 0,
ADD COLUMN subtasks jsonb NOT NULL DEFAULT '[]'::jsonb;