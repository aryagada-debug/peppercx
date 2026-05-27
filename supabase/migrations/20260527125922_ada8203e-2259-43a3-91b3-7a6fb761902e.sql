
-- 1) One-time backfill: relink profiles whose staffing_person_id is missing
--    or no longer exists in staffing_people, using email match.
UPDATE public.profiles p
   SET staffing_person_id = sp.id,
       updated_at = now()
  FROM auth.users u
  JOIN public.staffing_people sp
    ON lower(sp.email) = lower(u.email)
   AND sp.leaving = false
   AND sp.tbh = false
 WHERE p.user_id = u.id
   AND (
        p.staffing_person_id IS NULL
        OR p.staffing_person_id = ''
        OR NOT EXISTS (
            SELECT 1 FROM public.staffing_people sp2
            WHERE sp2.id = p.staffing_person_id
        )
   );

-- 2) Self-healing trigger: when a staffing_people row is inserted or its
--    email/id changes, relink any profiles whose current link is missing
--    or stale and whose auth email matches the new row.
CREATE OR REPLACE FUNCTION public.relink_profiles_on_staffing_person_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.leaving, false) = true OR COALESCE(NEW.tbh, false) = true THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles p
     SET staffing_person_id = NEW.id,
         updated_at = now()
    FROM auth.users u
   WHERE p.user_id = u.id
     AND lower(u.email) = lower(NEW.email)
     AND (
          p.staffing_person_id IS NULL
          OR p.staffing_person_id = ''
          OR p.staffing_person_id <> NEW.id
          OR NOT EXISTS (
              SELECT 1 FROM public.staffing_people sp2
              WHERE sp2.id = p.staffing_person_id
          )
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staffing_people_relink_profiles ON public.staffing_people;
CREATE TRIGGER staffing_people_relink_profiles
AFTER INSERT OR UPDATE OF id, email, leaving, tbh ON public.staffing_people
FOR EACH ROW
EXECUTE FUNCTION public.relink_profiles_on_staffing_person_change();
