CREATE OR REPLACE FUNCTION public.enqueue_full_sync_backfill()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.sync_outbox (entity, entity_id, op, payload)
  SELECT 'deal', d.id, 'insert', public._sync_deal_payload(d)
    FROM public.staffing_deals d;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.sync_outbox (entity, entity_id, op, payload)
  SELECT 'assignment', sa.id, 'insert', jsonb_build_object(
    'id', sa.id,
    'deal_id', sa.staffing_deal_id,
    'person_id', sa.person_id,
    'person_name', COALESCE(sp.name, ''),
    'person_email', COALESCE(sp.email, ''),
    'role_key', public.normalize_staffing_role_key(sa.role_key),
    'allocation_pct', sa.allocation_pct,
    'start_date', sa.start_date,
    'end_date', sa.end_date
  )
  FROM public.staffing_assignments sa
  LEFT JOIN public.staffing_people sp ON sp.id = sa.person_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_full_sync_backfill() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_full_sync_backfill() TO service_role;