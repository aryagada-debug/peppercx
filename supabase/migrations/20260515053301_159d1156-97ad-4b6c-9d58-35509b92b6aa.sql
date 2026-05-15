-- 1. Add client_name to deal_stakeholders + index
ALTER TABLE public.deal_stakeholders
  ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_deal_stakeholders_client_name
  ON public.deal_stakeholders (client_name);

-- 2. Backfill client_name from staffing_deals.account (join on deal_id)
UPDATE public.deal_stakeholders s
   SET client_name = d.account
  FROM public.staffing_deals d
 WHERE d.deal_id = s.deal_id
   AND (s.client_name IS NULL OR s.client_name = '')
   AND d.account IS NOT NULL
   AND d.account <> '';

-- 3. Normalise legacy capitalised role_key values in staffing_assignments
UPDATE public.staffing_assignments SET role_key = 'vsd'             WHERE role_key = 'VSD';
UPDATE public.staffing_assignments SET role_key = 'principal_bopm'  WHERE role_key = 'Principal BOPM';
UPDATE public.staffing_assignments SET role_key = 'senior_bopm'     WHERE role_key = 'Senior BOPM';
UPDATE public.staffing_assignments SET role_key = 'bopm'            WHERE role_key = 'BOPM';
UPDATE public.staffing_assignments SET role_key = 'managing_editor' WHERE role_key = 'Managing Editor';
UPDATE public.staffing_assignments SET role_key = 'content_lead'    WHERE role_key = 'Content Lead';
UPDATE public.staffing_assignments SET role_key = 'senior_editor'   WHERE role_key = 'Senior Editor';
UPDATE public.staffing_assignments SET role_key = 'seo_leader'      WHERE role_key = 'SEO Leader';
UPDATE public.staffing_assignments SET role_key = 'seo_group_head'  WHERE role_key = 'Group Head';
UPDATE public.staffing_assignments SET role_key = 'sr_seo_manager'  WHERE role_key = 'Sr. SEO Manager';
UPDATE public.staffing_assignments SET role_key = 'seo_manager'     WHERE role_key = 'SEO Manager';
UPDATE public.staffing_assignments SET role_key = 'sr_seo_analyst'  WHERE role_key = 'Sr. SEO Analyst';
UPDATE public.staffing_assignments SET role_key = 'seo_analyst'     WHERE role_key = 'SEO Analyst';
UPDATE public.staffing_assignments SET role_key = 'strategy_cd'     WHERE role_key = 'Strategy CD';
UPDATE public.staffing_assignments SET role_key = 'strategy_acd'    WHERE role_key = 'Strategy ACD';
UPDATE public.staffing_assignments SET role_key = 'strategy_sr'     WHERE role_key = 'Sr. Strategist';
UPDATE public.staffing_assignments SET role_key = 'cd_copy'         WHERE role_key = 'CD - Copy';
UPDATE public.staffing_assignments SET role_key = 'acd_copy'        WHERE role_key = 'ACD - Copy';
UPDATE public.staffing_assignments SET role_key = 'sr_copywriter'   WHERE role_key = 'Sr. Copywriter';
UPDATE public.staffing_assignments SET role_key = 'jr_copywriter'   WHERE role_key = 'Jr. Copywriter';
UPDATE public.staffing_assignments SET role_key = 'sr_cd_art'       WHERE role_key = 'Sr. CD - Art';
UPDATE public.staffing_assignments SET role_key = 'acd_art'         WHERE role_key = 'ACD - Art';
UPDATE public.staffing_assignments SET role_key = 'art_director'    WHERE role_key = 'Art Director';
UPDATE public.staffing_assignments SET role_key = 'sr_designer'     WHERE role_key = 'Sr. Designer';
UPDATE public.staffing_assignments SET role_key = 'jr_designer'     WHERE role_key = 'Jr. Designer';
UPDATE public.staffing_assignments SET role_key = 'production_head' WHERE role_key = 'Production Head';
UPDATE public.staffing_assignments SET role_key = 'ad_video_pm'     WHERE role_key = 'AD - Video PM';
UPDATE public.staffing_assignments SET role_key = 'video_pm'        WHERE role_key = 'Video PM/ACP';
UPDATE public.staffing_assignments SET role_key = 'video_editor_1'  WHERE role_key = 'Video Editor 1';
UPDATE public.staffing_assignments SET role_key = 'video_editor_2'  WHERE role_key = 'Video Editor 2';
UPDATE public.staffing_assignments SET role_key = 'influencer'      WHERE role_key = 'Influencer Team';
UPDATE public.staffing_assignments SET role_key = 'perf_growth'     WHERE role_key = 'Performance & Growth';