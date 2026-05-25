DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT deal_id FROM public.staffing_assignments LOOP
    PERFORM public._recompute_deal_bopm_field(r.deal_id, 'vsd');
    PERFORM public._recompute_deal_bopm_field(r.deal_id, 'principal_bopm');
    PERFORM public._recompute_deal_bopm_field(r.deal_id, 'senior_bopm');
    PERFORM public._recompute_deal_bopm_field(r.deal_id, 'bopm');
  END LOOP;
END $$;