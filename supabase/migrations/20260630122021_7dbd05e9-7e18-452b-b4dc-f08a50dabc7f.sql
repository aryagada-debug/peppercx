
-- Notification rules center
CREATE TABLE IF NOT EXISTS public.notification_rules (
  event_key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  to_tokens text[] NOT NULL DEFAULT '{}',
  cc_tokens text[] NOT NULL DEFAULT '{}',
  extra_to text[] NOT NULL DEFAULT '{}',
  extra_cc text[] NOT NULL DEFAULT '{}',
  subject_template text NOT NULL DEFAULT '',
  body_template text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.notification_rules TO authenticated;
GRANT ALL ON public.notification_rules TO service_role;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_select_auth" ON public.notification_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules_admin_write" ON public.notification_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.capability_leads (
  bucket text PRIMARY KEY,
  display_name text NOT NULL,
  leads text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.capability_leads TO authenticated;
GRANT ALL ON public.capability_leads TO service_role;
ALTER TABLE public.capability_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caplead_select_auth" ON public.capability_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "caplead_admin_write" ON public.capability_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.notification_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  deal_id text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ndl_event_deal ON public.notification_dispatch_log(event_key, deal_id);
GRANT SELECT ON public.notification_dispatch_log TO authenticated;
GRANT ALL ON public.notification_dispatch_log TO service_role;
ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ndl_select_auth" ON public.notification_dispatch_log FOR SELECT TO authenticated USING (true);

-- Seed defaults
INSERT INTO public.notification_rules (event_key, display_name, description, to_tokens, cc_tokens, extra_to, subject_template, body_template) VALUES
('assignment.created',     'Person staffed on a deal',
 'When a person is staffed on a deal, the person is notified and their manager is cc''d.',
 ARRAY['{assignee}'],
 ARRAY['{assignee_manager}'],
 ARRAY[]::text[],
 'You''ve been staffed on {deal_label}',
 'Hi {assignee}, you''ve been added to {deal_label} at {allocation_pct} bandwidth.'),
('handover.received',      'New sales handover received',
 'When a new handover form is submitted, notifies Arya, Anirudh and Priyanka.',
 ARRAY[]::text[], ARRAY[]::text[],
 ARRAY['arya.gada@peppercontent.io','anirudh@peppercontent.io','priyanka.sharma@peppercontent.io'],
 'New sales handover — {company}',
 'A new sales handover has been submitted for {company}. Action: Priyanka adds Deal ID/Name, Anirudh confirms VSD.'),
('deal.created',           'New deal created',
 'When a new deal is created, Arya + the deal''s VSD + the relevant Capability Lead are notified.',
 ARRAY['{vsd}','{capability_lead}'],
 ARRAY[]::text[],
 ARRAY['arya.gada@peppercontent.io'],
 'New deal created — {deal_label}',
 'A new deal {deal_label} ({capability}) has been created in Pepper CX.'),
('mbr.missing_prev_month', 'MBR missing for previous month',
 'Weekly digest to VSD, Principal/Senior BOPM and BOPM when previous month''s MBR was not logged.',
 ARRAY['{vsd}','{principal_bopm}','{senior_bopm}','{bopm}'],
 ARRAY[]::text[], ARRAY[]::text[],
 'MBR pending — {deal_label} ({month})',
 'Previous month''s MBR for {deal_label} has not been logged. Please update in Pepper CX.'),
('deal.unstaffed_7d',      'Active deal not staffed for 7 days',
 'Daily check: any active deal with zero assignments for 7 days notifies Arya + VSD + Capability Lead.',
 ARRAY['{vsd}','{capability_lead}'],
 ARRAY[]::text[],
 ARRAY['arya.gada@peppercontent.io'],
 'Deal awaiting staffing — {deal_label}',
 '{deal_label} has been active for 7+ days without a staffing assignment. Please staff the deal.'),
('rgy.stale_7d',           'RGY not updated for 7 days',
 'Weekly check: deals where RGY hasn''t been updated for 7+ days notify VSD, Capability Lead, P/Sr BOPM.',
 ARRAY['{vsd}','{capability_lead}','{principal_bopm}','{senior_bopm}'],
 ARRAY[]::text[], ARRAY[]::text[],
 'RGY update pending — {deal_label}',
 'RGY for {deal_label} hasn''t been updated in 7+ days. Please log the latest status in Pepper CX.')
ON CONFLICT (event_key) DO NOTHING;

INSERT INTO public.capability_leads (bucket, display_name, leads) VALUES
('creative',       'Creative / Pepper Creative', ARRAY['sneha@peppercontent.io']),
('seo_india',      'SEO — India',                ARRAY['vedang@peppercontent.io','pratima@peppercontent.io']),
('seo_us',         'SEO — US',                   ARRAY['mayur@peppercontent.io','gaurab@peppercontent.io']),
('content_studio', 'Content Studio',             ARRAY['anirudh@peppercontent.io']),
('other',          'Other',                      ARRAY['anirudh@peppercontent.io'])
ON CONFLICT (bucket) DO NOTHING;

CREATE OR REPLACE TRIGGER trg_notification_rules_updated_at
BEFORE UPDATE ON public.notification_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER trg_capability_leads_updated_at
BEFORE UPDATE ON public.capability_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
