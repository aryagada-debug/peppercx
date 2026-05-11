CREATE OR REPLACE FUNCTION public.resolve_assignee_user_id(_staffing_person_id text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, COALESCE(p.display_name, '') AS display_name
  FROM public.profiles p
  WHERE p.staffing_person_id = _staffing_person_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_assignee_user_id(text) TO authenticated;