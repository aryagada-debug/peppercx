CREATE OR REPLACE FUNCTION public.get_home_personal_todos()
RETURNS SETOF public.personal_todos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT
      auth.uid() AS user_id,
      auth.jwt() ->> 'email' AS email
  ), linked AS (
    SELECT
      me.user_id,
      me.email,
      p.staffing_person_id AS profile_staffing_person_id,
      sp.id AS email_staffing_person_id
    FROM me
    LEFT JOIN public.profiles p ON p.user_id = me.user_id
    LEFT JOIN public.staffing_people sp ON lower(sp.email) = lower(me.email)
  )
  SELECT t.*
  FROM public.personal_todos t
  CROSS JOIN linked
  WHERE
    t.user_id = linked.user_id
    OR t.assigned_by_user_id = linked.user_id
    OR (
      t.assignee_staffing_person_id IS NOT NULL
      AND t.assignee_staffing_person_id IN (linked.profile_staffing_person_id, linked.email_staffing_person_id)
    )
  ORDER BY t.sort_order ASC, t.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_personal_todos() TO authenticated;