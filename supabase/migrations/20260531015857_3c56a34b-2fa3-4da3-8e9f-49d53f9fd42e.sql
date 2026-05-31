ALTER TABLE public.staffing_assignments
  DROP CONSTRAINT staffing_assignments_deal_id_fkey,
  ADD CONSTRAINT staffing_assignments_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.staffing_deals(id)
    ON UPDATE CASCADE ON DELETE CASCADE;