CREATE TABLE public.task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read task_templates" ON public.task_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert task_templates" ON public.task_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update task_templates" ON public.task_templates FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete task_templates" ON public.task_templates FOR DELETE USING (true);