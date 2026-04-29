
-- 1. Add new enum values (must be committed before use in defaults / seeds)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'capability_lead';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'capability_member';

-- 2. Capability groups (SEO / Creative / Editorial)
CREATE TABLE IF NOT EXISTS public.capability_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  role_categories text[] NOT NULL DEFAULT '{}',
  lead_person_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.capability_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read capability_groups"
  ON public.capability_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert capability_groups"
  ON public.capability_groups FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update capability_groups"
  ON public.capability_groups FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete capability_groups"
  ON public.capability_groups FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_capability_groups_updated
  BEFORE UPDATE ON public.capability_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed three capability groups mapped to staffing_people.role_category values
INSERT INTO public.capability_groups (name, role_categories) VALUES
  ('SEO',       ARRAY['SEO']),
  ('Creative',  ARRAY['Creative Art','Creative Copy','Video']),
  ('Editorial', ARRAY['Content','Content Strategy'])
ON CONFLICT (name) DO NOTHING;

-- 3. Capability memberships
CREATE TABLE IF NOT EXISTS public.capability_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id text NOT NULL,
  capability_id uuid NOT NULL REFERENCES public.capability_groups(id) ON DELETE CASCADE,
  is_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_capability_memberships_person ON public.capability_memberships(person_id);
CREATE INDEX IF NOT EXISTS idx_capability_memberships_capability ON public.capability_memberships(capability_id);

ALTER TABLE public.capability_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read capability_memberships"
  ON public.capability_memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert capability_memberships"
  ON public.capability_memberships FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update capability_memberships"
  ON public.capability_memberships FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete capability_memberships"
  ON public.capability_memberships FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-seed memberships from staffing_people.role_category
INSERT INTO public.capability_memberships (person_id, capability_id, is_lead)
SELECT sp.id, cg.id, false
FROM public.staffing_people sp
JOIN public.capability_groups cg ON sp.role_category = ANY(cg.role_categories)
WHERE sp.leaving = false AND sp.tbh = false
ON CONFLICT (person_id, capability_id) DO NOTHING;
