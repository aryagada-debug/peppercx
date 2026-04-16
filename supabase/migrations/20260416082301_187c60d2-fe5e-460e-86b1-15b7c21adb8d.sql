
-- Spaces
CREATE TABLE public.cx_spaces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cx_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cx_spaces" ON public.cx_spaces FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cx_spaces" ON public.cx_spaces FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cx_spaces" ON public.cx_spaces FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete cx_spaces" ON public.cx_spaces FOR DELETE USING (true);

CREATE TRIGGER update_cx_spaces_updated_at BEFORE UPDATE ON public.cx_spaces
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Statuses (customizable kanban columns per space)
CREATE TABLE public.cx_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES public.cx_spaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cx_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cx_statuses" ON public.cx_statuses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cx_statuses" ON public.cx_statuses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cx_statuses" ON public.cx_statuses FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete cx_statuses" ON public.cx_statuses FOR DELETE USING (true);

-- Space members
CREATE TABLE public.cx_space_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES public.cx_spaces(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cx_space_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cx_space_members" ON public.cx_space_members FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cx_space_members" ON public.cx_space_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cx_space_members" ON public.cx_space_members FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete cx_space_members" ON public.cx_space_members FOR DELETE USING (true);

-- Tasks
CREATE TABLE public.cx_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES public.cx_spaces(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Open',
  assignee text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'None',
  tags text[] DEFAULT '{}',
  start_date date,
  end_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cx_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cx_tasks" ON public.cx_tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cx_tasks" ON public.cx_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cx_tasks" ON public.cx_tasks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete cx_tasks" ON public.cx_tasks FOR DELETE USING (true);

CREATE TRIGGER update_cx_tasks_updated_at BEFORE UPDATE ON public.cx_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
