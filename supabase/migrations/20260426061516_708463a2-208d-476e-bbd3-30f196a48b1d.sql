-- Drop policies that depend on has_role(uuid, app_role) so we can recreate the type
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert route visibility" ON public.route_visibility;
DROP POLICY IF EXISTS "Admins can update route visibility" ON public.route_visibility;
DROP POLICY IF EXISTS "Admins can delete route visibility" ON public.route_visibility;

-- 1. Expand app_role enum: rename old, create new, migrate column, drop old.
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('admin', 'member', 'user', 'view_only');

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role
  USING (CASE role::text WHEN 'vsd' THEN 'user' ELSE role::text END)::public.app_role;

ALTER TABLE public.route_visibility
  ALTER COLUMN role TYPE public.app_role
  USING (CASE role::text WHEN 'vsd' THEN 'user' ELSE role::text END)::public.app_role;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role_old);
DROP TYPE public.app_role_old;

-- 2. Recreate has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Recreate dropped policies
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert route visibility"
  ON public.route_visibility FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update route visibility"
  ON public.route_visibility FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete route visibility"
  ON public.route_visibility FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Update handle_new_user trigger fn: default → 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5. Unique constraint on route_visibility(role, route_key) for safe upserts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'route_visibility_role_route_key_unique') THEN
    ALTER TABLE public.route_visibility
      ADD CONSTRAINT route_visibility_role_route_key_unique UNIQUE (role, route_key);
  END IF;
END $$;

-- 6. Seed defaults for new roles
DO $$
DECLARE
  r TEXT;
  routes TEXT[] := ARRAY[
    'dashboard','clients','staffing','revenue','targets','central-cx',
    'rgy-health','mbr-tracker','slack-health','onboarding','deal-desk',
    'seo-staffing','gm2-calculator','settings'
  ];
BEGIN
  FOREACH r IN ARRAY routes LOOP
    INSERT INTO public.route_visibility (role, route_key, visible)
      VALUES ('admin', r, true) ON CONFLICT (role, route_key) DO NOTHING;
    INSERT INTO public.route_visibility (role, route_key, visible)
      VALUES ('member', r, true) ON CONFLICT (role, route_key) DO NOTHING;
    INSERT INTO public.route_visibility (role, route_key, visible)
      SELECT 'view_only', route_key, visible FROM public.route_visibility
      WHERE role = 'user' AND route_key = r
      ON CONFLICT (role, route_key) DO NOTHING;
  END LOOP;
END $$;

-- 7. Per-user route overrides
CREATE TABLE IF NOT EXISTS public.user_route_overrides (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_key TEXT NOT NULL,
  visible BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route_key)
);

ALTER TABLE public.user_route_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or admin overrides"
  ON public.user_route_overrides FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert overrides"
  ON public.user_route_overrides FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update overrides"
  ON public.user_route_overrides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete overrides"
  ON public.user_route_overrides FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_route_overrides_updated_at
  BEFORE UPDATE ON public.user_route_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();