
-- Restrict staffing_assignments writes to admins and VSDs only
DROP POLICY IF EXISTS "Authenticated insert staffing_assignments" ON public.staffing_assignments;
DROP POLICY IF EXISTS "Authenticated update staffing_assignments" ON public.staffing_assignments;
DROP POLICY IF EXISTS "Authenticated delete staffing_assignments" ON public.staffing_assignments;

CREATE POLICY "Admin or VSD insert staffing_assignments"
ON public.staffing_assignments
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'member'::app_role)
);

CREATE POLICY "Admin or VSD update staffing_assignments"
ON public.staffing_assignments
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'member'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'member'::app_role)
);

CREATE POLICY "Admin or VSD delete staffing_assignments"
ON public.staffing_assignments
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'member'::app_role)
);
