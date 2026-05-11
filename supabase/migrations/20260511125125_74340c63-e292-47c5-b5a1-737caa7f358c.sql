CREATE OR REPLACE FUNCTION public.resolve_assignee_user_id(_staffing_person_id text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT resolved.user_id, resolved.display_name
  FROM (
    SELECT
      p.user_id,
      COALESCE(NULLIF(p.display_name, ''), sp.name, '') AS display_name,
      1 AS priority
    FROM public.profiles p
    LEFT JOIN public.staffing_people sp ON sp.id = p.staffing_person_id
    WHERE p.staffing_person_id = _staffing_person_id

    UNION ALL

    SELECT
      u.id AS user_id,
      COALESCE(NULLIF(p.display_name, ''), sp.name, u.email, '') AS display_name,
      2 AS priority
    FROM public.staffing_people sp
    JOIN auth.users u ON lower(u.email) = lower(sp.email)
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE sp.id = _staffing_person_id
  ) resolved
  ORDER BY resolved.priority
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_assignee_user_id(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_home_personal_todos()
RETURNS SETOF public.personal_todos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT
      u.id AS user_id,
      u.email AS email,
      p.staffing_person_id AS staffing_person_id
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE u.id = auth.uid()
    LIMIT 1
  )
  SELECT t.*
  FROM public.personal_todos t
  CROSS JOIN me
  WHERE
    t.user_id = me.user_id
    OR t.assigned_by_user_id = me.user_id
    OR (
      t.assignee_staffing_person_id IS NOT NULL
      AND t.assignee_staffing_person_id = me.staffing_person_id
    )
    OR (
      t.assignee_staffing_person_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.staffing_people sp
        WHERE sp.id = t.assignee_staffing_person_id
          AND lower(sp.email) = lower(me.email)
      )
    )
  ORDER BY t.sort_order ASC, t.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_personal_todos() TO authenticated;