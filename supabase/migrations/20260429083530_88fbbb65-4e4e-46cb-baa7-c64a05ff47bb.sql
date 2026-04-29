-- 1) Replace handle_new_user to also auto-link by email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person_id text;
BEGIN
  -- Find a matching staffing record by email (case-insensitive, active only).
  SELECT sp.id INTO v_person_id
  FROM public.staffing_people sp
  WHERE lower(sp.email) = lower(NEW.email)
    AND sp.leaving = false
    AND sp.tbh = false
  LIMIT 1;

  INSERT INTO public.profiles (user_id, display_name, avatar_url, staffing_person_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    v_person_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET staffing_person_id = COALESCE(EXCLUDED.staffing_person_id, public.profiles.staffing_person_id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Make sure profiles.user_id is unique so the ON CONFLICT above works.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profiles_user_id_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX profiles_user_id_unique_idx ON public.profiles(user_id);
  END IF;
END $$;

-- 2) Re-link on email change (e.g. Google merge)
CREATE OR REPLACE FUNCTION public.relink_profile_on_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person_id text;
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    SELECT sp.id INTO v_person_id
    FROM public.staffing_people sp
    WHERE lower(sp.email) = lower(NEW.email)
      AND sp.leaving = false
      AND sp.tbh = false
    LIMIT 1;

    IF v_person_id IS NOT NULL THEN
      UPDATE public.profiles
         SET staffing_person_id = v_person_id
       WHERE user_id = NEW.id
         AND (staffing_person_id IS NULL OR staffing_person_id = '' OR staffing_person_id <> v_person_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.relink_profile_on_email_change();

-- 3) Backfill: link any existing profile without a staffing_person_id when
--    its auth email matches a staffing_people email.
UPDATE public.profiles p
SET staffing_person_id = sp.id
FROM auth.users u, public.staffing_people sp
WHERE p.user_id = u.id
  AND (p.staffing_person_id IS NULL OR p.staffing_person_id = '')
  AND lower(sp.email) = lower(u.email)
  AND sp.leaving = false
  AND sp.tbh = false;

-- 4) Also ensure any auth.users row that has NO profile gets one (covers
--    accounts that pre-date the trigger fix or where the trigger silently
--    failed). Email-link them at the same time.
INSERT INTO public.profiles (user_id, display_name, avatar_url, staffing_person_id)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  COALESCE(u.raw_user_meta_data ->> 'avatar_url', ''),
  sp.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.staffing_people sp
  ON lower(sp.email) = lower(u.email)
 AND sp.leaving = false AND sp.tbh = false
WHERE p.user_id IS NULL;