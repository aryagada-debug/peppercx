
ALTER TABLE public.staffing_deals
  ADD COLUMN IF NOT EXISTS staffing_locked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS staffing_locked_by uuid NULL,
  ADD COLUMN IF NOT EXISTS staffing_locked_by_name text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.toggle_staffing_lock(_deal_id text, _lock boolean)
RETURNS public.staffing_deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := '';
  v_row public.staffing_deals;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'permission denied: admin role required to lock staffing' USING ERRCODE = '42501';
  END IF;

  IF _lock THEN
    SELECT COALESCE(NULLIF(display_name, ''), '') INTO v_name
      FROM public.profiles WHERE user_id = v_uid;

    UPDATE public.staffing_deals
       SET staffing_locked_at = now(),
           staffing_locked_by = v_uid,
           staffing_locked_by_name = COALESCE(v_name, ''),
           updated_at = now()
     WHERE id = _deal_id
     RETURNING * INTO v_row;
  ELSE
    UPDATE public.staffing_deals
       SET staffing_locked_at = NULL,
           staffing_locked_by = NULL,
           staffing_locked_by_name = '',
           updated_at = now()
     WHERE id = _deal_id
     RETURNING * INTO v_row;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'deal not found: %', _deal_id USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_staffing_lock(text, boolean) TO authenticated;
