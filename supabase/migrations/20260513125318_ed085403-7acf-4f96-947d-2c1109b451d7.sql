DROP POLICY IF EXISTS "No direct calendar connection reads" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "No direct calendar connection creates" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "No direct calendar connection changes" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "No direct calendar connection deletes" ON public.google_calendar_connections;

CREATE POLICY "No direct calendar connection reads"
ON public.google_calendar_connections
FOR SELECT TO authenticated
USING (false);

CREATE POLICY "No direct calendar connection creates"
ON public.google_calendar_connections
FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct calendar connection changes"
ON public.google_calendar_connections
FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct calendar connection deletes"
ON public.google_calendar_connections
FOR DELETE TO authenticated
USING (false);