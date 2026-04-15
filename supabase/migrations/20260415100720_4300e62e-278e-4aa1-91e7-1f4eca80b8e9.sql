ALTER TABLE public.deal_tasks ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT '';
ALTER TABLE public.deal_tasks ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';