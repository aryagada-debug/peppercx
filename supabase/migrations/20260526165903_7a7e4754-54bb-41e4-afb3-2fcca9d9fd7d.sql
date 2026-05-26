
-- 1) Taxonomy tables
CREATE TABLE IF NOT EXISTS public.staffing_departments (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staffing_departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staffing_departments TO authenticated;
GRANT ALL ON public.staffing_departments TO service_role;
ALTER TABLE public.staffing_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read staffing_departments" ON public.staffing_departments FOR SELECT USING (true);
CREATE POLICY "Admins manage staffing_departments insert" ON public.staffing_departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage staffing_departments update" ON public.staffing_departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage staffing_departments delete" ON public.staffing_departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.staffing_role_types (
  id text PRIMARY KEY,
  department_id text NOT NULL REFERENCES public.staffing_departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staffing_role_types_dept ON public.staffing_role_types(department_id);
GRANT SELECT ON public.staffing_role_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staffing_role_types TO authenticated;
GRANT ALL ON public.staffing_role_types TO service_role;
ALTER TABLE public.staffing_role_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read staffing_role_types" ON public.staffing_role_types FOR SELECT USING (true);
CREATE POLICY "Admins manage staffing_role_types insert" ON public.staffing_role_types FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage staffing_role_types update" ON public.staffing_role_types FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage staffing_role_types delete" ON public.staffing_role_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

-- 2) Deal applicability
CREATE TABLE IF NOT EXISTS public.deal_applicability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  department_id text NOT NULL REFERENCES public.staffing_departments(id) ON DELETE CASCADE,
  role_type_id text NULL REFERENCES public.staffing_role_types(id) ON DELETE CASCADE,
  is_applicable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, department_id, role_type_id)
);
CREATE INDEX IF NOT EXISTS idx_deal_applicability_deal ON public.deal_applicability(deal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_applicability TO authenticated;
GRANT ALL ON public.deal_applicability TO service_role;
ALTER TABLE public.deal_applicability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read deal_applicability" ON public.deal_applicability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert deal_applicability" ON public.deal_applicability FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update deal_applicability" ON public.deal_applicability FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete deal_applicability" ON public.deal_applicability FOR DELETE TO authenticated USING (true);

-- 3) Add columns to existing tables
ALTER TABLE public.staffing_people
  ADD COLUMN IF NOT EXISTS department_id text REFERENCES public.staffing_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_type_id text REFERENCES public.staffing_role_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_staffing_people_role_type ON public.staffing_people(role_type_id);
CREATE INDEX IF NOT EXISTS idx_staffing_people_dept ON public.staffing_people(department_id);

ALTER TABLE public.staffing_assignments
  ADD COLUMN IF NOT EXISTS role_type_id text REFERENCES public.staffing_role_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_staffing_assignments_role_type ON public.staffing_assignments(role_type_id);

ALTER TABLE public.staffing_bw_rules
  ADD COLUMN IF NOT EXISTS role_type_id text REFERENCES public.staffing_role_types(id) ON DELETE SET NULL;

-- 4) Wipe existing assignments + people (per user decision: start fresh)
DELETE FROM public.staffing_assignments;
DELETE FROM public.staffing_people;

-- Clear cached VSD/BOPM display strings on deals
UPDATE public.staffing_deals
   SET vsd = '', principal_bopm = '', senior_bopm = '', bopm = '', updated_at = now();

-- 5) Seed departments
INSERT INTO public.staffing_departments (id, name, sort_order) VALUES
('dept_delivery_ops_and_cs', 'Delivery Ops and CS', 0),
('dept_content_capability', 'Content Capability', 10),
('dept_seo_capability', 'SEO Capability', 20),
('dept_capability_creative_strategy_team', 'Capability - Creative Strategy Team', 30),
('dept_creative_capability_copy', 'Creative Capability - Copy', 40),
('dept_creative_capability_video', 'Creative Capability - Video', 50),
('dept_creative_capability_design', 'Creative Capability - Design', 60),
('dept_creative_capability_influencer', 'Creative Capability - Influencer', 70),
('dept_leadership', 'Leadership', 80),
('dept_performance_marketing', 'Performance Marketing', 90);

-- 6) Seed role types
INSERT INTO public.staffing_role_types (id, department_id, name, sort_order) VALUES
('rt_vsd', 'dept_delivery_ops_and_cs', 'VSD', 0),
('rt_group_bopm', 'dept_delivery_ops_and_cs', 'Group BOPM', 10),
('rt_senior_bopm', 'dept_delivery_ops_and_cs', 'Senior BOPM', 20),
('rt_bopm', 'dept_delivery_ops_and_cs', 'BOPM', 30),
('rt_content_capability_leader', 'dept_content_capability', 'Content Capability Leader', 40),
('rt_content_lead', 'dept_content_capability', 'Content Lead', 50),
('rt_content_editor', 'dept_content_capability', 'Content Editor', 60),
('rt_seo_capability_leader', 'dept_seo_capability', 'SEO Capability Leader', 70),
('rt_seo_growth_lead', 'dept_seo_capability', 'SEO Growth Lead', 80),
('rt_seo_operations', 'dept_seo_capability', 'SEO Operations', 90),
('rt_cd_scd_strategy', 'dept_capability_creative_strategy_team', 'CD/SCD - Strategy', 100),
('rt_acd_agh_strategy', 'dept_capability_creative_strategy_team', 'ACD/AGH - Strategy', 110),
('rt_creative_strategist', 'dept_capability_creative_strategy_team', 'Creative Strategist', 120),
('rt_cd_scd_copy', 'dept_creative_capability_copy', 'CD/SCD - Copy', 130),
('rt_acd_agh_copy', 'dept_creative_capability_copy', 'ACD/AGH - Copy', 140),
('rt_copywriter', 'dept_creative_capability_copy', 'Copywriter', 150),
('rt_video_capability_leader', 'dept_creative_capability_video', 'Video Capability Leader', 160),
('rt_ad_creative_producer', 'dept_creative_capability_video', 'AD - Creative Producer', 170),
('rt_creative_producer', 'dept_creative_capability_video', 'Creative Producer', 180),
('rt_video_editor', 'dept_creative_capability_video', 'Video Editor', 190),
('rt_cd_scd_design', 'dept_creative_capability_design', 'CD/SCD - Design', 200),
('rt_graphic_designer', 'dept_creative_capability_design', 'Graphic Designer', 210),
('rt_acd_agh_design', 'dept_creative_capability_design', 'ACD/AGH - Design', 220);
