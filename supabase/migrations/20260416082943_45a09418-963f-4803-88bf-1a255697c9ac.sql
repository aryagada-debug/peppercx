ALTER TABLE public.cx_tasks ADD COLUMN estimated_hours numeric NOT NULL DEFAULT 0;
ALTER TABLE public.cx_tasks ADD COLUMN logged_hours numeric NOT NULL DEFAULT 0;
ALTER TABLE public.cx_tasks ADD COLUMN subtasks jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.cx_tasks ADD COLUMN urgency text NOT NULL DEFAULT 'Medium';
ALTER TABLE public.cx_tasks ADD COLUMN auto_regen boolean NOT NULL DEFAULT false;