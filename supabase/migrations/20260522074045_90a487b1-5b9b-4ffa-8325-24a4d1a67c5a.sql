-- Remove the duplicate staffing trigger so each assignment write recomputes
-- deal BOPM/VSD fields exactly once. The newer trigger
-- `trg_sync_bopm_fields_from_assignment` is kept.
DROP TRIGGER IF EXISTS trg_sync_bopm_fields ON public.staffing_assignments;