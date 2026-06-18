ALTER TABLE public.personal_todos ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'To Do';
UPDATE public.personal_todos SET stage = 'Done' WHERE done = true AND stage = 'To Do';