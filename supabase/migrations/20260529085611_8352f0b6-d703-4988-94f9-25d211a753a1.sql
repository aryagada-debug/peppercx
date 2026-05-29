DO $$
DECLARE
  d record;
  r text;
BEGIN
  FOR d IN SELECT id FROM public.staffing_deals LOOP
    FOREACH r IN ARRAY ARRAY['vsd','principal_bopm','senior_bopm','bopm'] LOOP
      PERFORM public._recompute_deal_bopm_field(d.id, r);
    END LOOP;
  END LOOP;
END $$;