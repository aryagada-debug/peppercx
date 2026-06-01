CREATE OR REPLACE FUNCTION public._is_active_staffing_status(_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(_status, ''))) IN (
    'active deal',
    'new deal in sla/po',
    'deal disputed',
    'deal in renewal process'
  )
$$;

DROP TRIGGER IF EXISTS trg_sync_bopm_fields_from_assignment ON public.staffing_assignments;
DROP TRIGGER IF EXISTS trg_sync_bopm_fields ON public.staffing_assignments;
CREATE TRIGGER trg_sync_bopm_fields_from_assignment
AFTER INSERT OR UPDATE OR DELETE ON public.staffing_assignments
FOR EACH ROW
EXECUTE FUNCTION public.sync_bopm_fields_from_assignment();

DROP TRIGGER IF EXISTS update_staffing_assignments_updated_at ON public.staffing_assignments;
CREATE TRIGGER update_staffing_assignments_updated_at
BEFORE UPDATE ON public.staffing_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_staffing_deals_updated_at ON public.staffing_deals;
CREATE TRIGGER update_staffing_deals_updated_at
BEFORE UPDATE ON public.staffing_deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reset_staffing_on_inactive_deal ON public.staffing_deals;
CREATE TRIGGER trg_reset_staffing_on_inactive_deal
AFTER UPDATE OF deal_status ON public.staffing_deals
FOR EACH ROW
EXECUTE FUNCTION public.reset_staffing_on_inactive_deal();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.staffing_deals LOOP
    PERFORM public._recompute_deal_bopm_field(r.id, 'vsd');
    PERFORM public._recompute_deal_bopm_field(r.id, 'principal_bopm');
    PERFORM public._recompute_deal_bopm_field(r.id, 'senior_bopm');
    PERFORM public._recompute_deal_bopm_field(r.id, 'bopm');
  END LOOP;
END $$;