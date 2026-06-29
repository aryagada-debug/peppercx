
ALTER TABLE public.deal_handovers
  ADD COLUMN IF NOT EXISTS reference text;

CREATE UNIQUE INDEX IF NOT EXISTS deal_handovers_reference_key
  ON public.deal_handovers(reference)
  WHERE reference IS NOT NULL;

-- Drop existing matching constraints if present (idempotent)
ALTER TABLE public.deal_handovers DROP CONSTRAINT IF EXISTS deal_handovers_stage_check;
ALTER TABLE public.deal_handovers DROP CONSTRAINT IF EXISTS deal_handovers_bu_check;
ALTER TABLE public.deal_handovers DROP CONSTRAINT IF EXISTS deal_handovers_capability_check;
ALTER TABLE public.deal_handovers DROP CONSTRAINT IF EXISTS deal_handovers_deal_type_check;
ALTER TABLE public.deal_handovers DROP CONSTRAINT IF EXISTS deal_handovers_vsd_suggested_check;
ALTER TABLE public.deal_handovers DROP CONSTRAINT IF EXISTS deal_handovers_mrr_required_check;

ALTER TABLE public.deal_handovers
  ADD CONSTRAINT deal_handovers_stage_check CHECK (stage IN (
    '',
    'Pre-Proposal',
    'Proposal',
    'Negotiation',
    '(Free) Pilot before SLA',
    '(Paid) Pilot before SLA',
    'SLA back-and-forth',
    'SLA signed; awaiting contraction',
    'SLA signed & contraction is on the platform',
    'SLA signed & contraction is on the platform AND escalated'
  )),
  ADD CONSTRAINT deal_handovers_bu_check CHECK (bu IN (
    '',
    'Pepper SEO/GEO + Content',
    'Pepper Content',
    'Pepper Creative',
    'Integrated',
    'Content Studios',
    'Others',
    'Not Applicable'
  )),
  ADD CONSTRAINT deal_handovers_capability_check CHECK (capability IN (
    '',
    'Integrated Retainers - Content + SEO + Social or Content Hubs',
    'Content Studio - Talent Onsite/Virtual',
    'Pepper SEO - SEO + Content Retainer',
    'Pepper Content - B2B Full Funnel',
    'Pepper Content - Website/SEO Content',
    'Campaign Assets - Statics, Adapts, Asset Creation',
    'Light Video Production - Reels/YouTube/Podcast',
    'Creative/Social Media Retainer',
    'CRM/CLM Content - Lifecycle Marketing',
    'Campaigns - Influencer Marketing/Social',
    'Heavy Video Production - Films/DVCs/TVCs',
    'Translation/Localisation',
    'Other'
  )),
  ADD CONSTRAINT deal_handovers_deal_type_check CHECK (deal_type IN (
    '',
    'Retainer',
    'Non-retainer'
  )),
  ADD CONSTRAINT deal_handovers_vsd_suggested_check CHECK (vsd_suggested IN (
    '',
    'Aamir Khan',
    'Aditya Shaw',
    'Sneha Iyer',
    'Neema Jayadas',
    'Sumit Shekhawat'
  )),
  ADD CONSTRAINT deal_handovers_mrr_required_check CHECK (
    deal_type <> 'Retainer' OR mrr IS NOT NULL
  );
