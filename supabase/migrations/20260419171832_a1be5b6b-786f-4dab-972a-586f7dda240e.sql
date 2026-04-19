-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'vsd');

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. route_visibility table
CREATE TABLE public.route_visibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  route_key TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, route_key)
);

ALTER TABLE public.route_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read route visibility"
ON public.route_visibility FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert route visibility"
ON public.route_visibility FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update route visibility"
ON public.route_visibility FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete route visibility"
ON public.route_visibility FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_route_visibility_updated_at
BEFORE UPDATE ON public.route_visibility
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Seed route visibility (all known routes)
-- Admin: everything visible
INSERT INTO public.route_visibility (role, route_key, visible) VALUES
  ('admin', 'dashboard', true),
  ('admin', 'clients', true),
  ('admin', 'staffing', true),
  ('admin', 'revenue', true),
  ('admin', 'targets', true),
  ('admin', 'central-cx', true),
  ('admin', 'rgy-health', true),
  ('admin', 'mbr-tracker', true),
  ('admin', 'slack-health', true),
  ('admin', 'onboarding', true),
  ('admin', 'deal-desk', true),
  ('admin', 'seo-staffing', true),
  ('admin', 'gm2-calculator', true),
  ('admin', 'settings', true),
  -- VSD: only 3 visible by default
  ('vsd', 'dashboard', false),
  ('vsd', 'clients', true),
  ('vsd', 'staffing', false),
  ('vsd', 'revenue', false),
  ('vsd', 'targets', false),
  ('vsd', 'central-cx', false),
  ('vsd', 'rgy-health', true),
  ('vsd', 'mbr-tracker', true),
  ('vsd', 'slack-health', false),
  ('vsd', 'onboarding', false),
  ('vsd', 'deal-desk', false),
  ('vsd', 'seo-staffing', false),
  ('vsd', 'gm2-calculator', false),
  ('vsd', 'settings', false);

-- 7. Update handle_new_user trigger to also assign default vsd role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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

  -- Assign default vsd role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'vsd')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();