
ALTER TABLE public.personal_todos
  ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS assignee_name text NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "Own todos select" ON public.personal_todos;
DROP POLICY IF EXISTS "Own todos insert" ON public.personal_todos;
DROP POLICY IF EXISTS "Own todos update" ON public.personal_todos;
DROP POLICY IF EXISTS "Own todos delete" ON public.personal_todos;

CREATE POLICY "Own or assigned todos select"
ON public.personal_todos FOR SELECT TO authenticated
USING (auth.uid() = user_id OR auth.uid() = assigned_by_user_id);

CREATE POLICY "Own or assigning todos insert"
ON public.personal_todos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR auth.uid() = assigned_by_user_id);

CREATE POLICY "Own todos update"
ON public.personal_todos FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR auth.uid() = assigned_by_user_id);

CREATE POLICY "Own or assigner todos delete"
ON public.personal_todos FOR DELETE TO authenticated
USING (auth.uid() = user_id OR auth.uid() = assigned_by_user_id);
