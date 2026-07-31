CREATE OR REPLACE FUNCTION public.is_seo_kra_reviewer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR lower(coalesce(auth.jwt() ->> 'email','')) = ANY (ARRAY[
        'mayur@peppercontent.io',
        'mayur.varade@peppercontent.io',
        'vedanga@peppercontent.io',
        'vedanga.bandyopadhyay@peppercontent.io'
      ])
$function$;