
ALTER TABLE public.personal_todos
  ADD COLUMN IF NOT EXISTS assignee_staffing_person_id text;

ALTER TABLE public.personal_todos
  ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS personal_todos_assignee_sp_idx
  ON public.personal_todos (assignee_staffing_person_id);

-- Replace RLS policies to also allow access via staffing_person_id linkage
DROP POLICY IF EXISTS "Own or assigned todos select" ON public.personal_todos;
DROP POLICY IF EXISTS "Own todos update" ON public.personal_todos;
DROP POLICY IF EXISTS "Own or assigner todos delete" ON public.personal_todos;
DROP POLICY IF EXISTS "Own or assigning todos insert" ON public.personal_todos;

CREATE POLICY "Own or assigned todos select"
ON public.personal_todos FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = assigned_by_user_id
  OR (
    assignee_staffing_person_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.staffing_person_id = personal_todos.assignee_staffing_person_id
    )
  )
);

CREATE POLICY "Own or assigning todos insert"
ON public.personal_todos FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR auth.uid() = assigned_by_user_id
);

CREATE POLICY "Own todos update"
ON public.personal_todos FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = assigned_by_user_id
  OR (
    assignee_staffing_person_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.staffing_person_id = personal_todos.assignee_staffing_person_id
    )
  )
);

CREATE POLICY "Own or assigner todos delete"
ON public.personal_todos FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = assigned_by_user_id
);
