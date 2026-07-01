export const STAGE_OPTIONS = [
  "Pre-Proposal",
  "Proposal",
  "Negotiation",
  "(Free) Pilot before SLA",
  "(Paid) Pilot before SLA",
  "SLA back-and-forth",
  "SLA signed; awaiting contraction",
  "SLA signed & contraction is on the platform",
  "SLA signed & contraction is on the platform AND escalated",
] as const;

export const BU_OPTIONS = [
  "Pepper SEO/GEO + Content",
  "Pepper Content",
  "Pepper Creative",
  "Integrated",
  "Content Studios",
  "Others",
  "Not Applicable",
] as const;

export const CAPABILITY_OPTIONS = [
  "Integrated Retainers - Content + SEO + Social or Content Hubs",
  "Content Studio - Talent Onsite/Virtual",
  "Pepper SEO - SEO + Content Retainer",
  "Pepper Content - B2B Full Funnel",
  "Pepper Content - Website/SEO Content",
  "Campaign Assets - Statics, Adapts, Asset Creation",
  "Light Video Production - Reels/YouTube/Podcast",
  "Creative/Social Media Retainer",
  "CRM/CLM Content - Lifecycle Marketing",
  "Campaigns - Influencer Marketing/Social",
  "Heavy Video Production - Films/DVCs/TVCs",
  "Translation/Localisation",
  "Other",
] as const;

export const VSD_OPTIONS = [
  "Aamir Khan",
  "Aditya Shaw",
  "Sneha Iyer",
  "Neema Jayadas",
  "Sumit Shekhawat",
] as const;

export const INDUSTRY_OPTIONS = [
  "FMCG",
  "BFSI",
  "US B2B",
  "India B2B",
  "Others",
] as const;

export const SALES_REGION_OPTIONS = ["India", "Global"] as const;

export const COMPANY_LOCATION_OPTIONS = [
  "Bengaluru",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Singapore",
  "Dubai",
  "London",
  "New York",
  "San Francisco",
  "Other",
] as const;

export type CompanyAISummary = {
  industry?: string;
  what_they_do?: string;
  products?: string[];
  website?: string;
};

export type Contact = { name: string; role: string; email: string; phone: string };

export type HandoverForm = {
  sp_name: string;
  sp_email: string;
  sp_team: string;
  handover_date: string;
  existing_client_id: string;
  company_name: string;
  industry: string;
  industry_other: string;
  company_location: string;
  company_location_other: string;
  company_ai_summary: CompanyAISummary | null;
  website: string;
  contacts: Contact[];
  sow_url: string;
  strategy_deck_url: string;
  keywords_url: string;
  geo_audit_url: string;
  fireflies_url: string;
  docs_notes: string;
  stage: string;
  bu: string;
  capability: string;
  deal_type: "" | "Retainer" | "Non-retainer";
  mrr: number | null;
  total_amount: number | null;
  duration_months: string;
  start_date: string;
  vsd_suggested: string;
  deal_notes: string;
};

export const today = () => new Date().toISOString().slice(0, 10);

export const emptyContact = (): Contact => ({ name: "", role: "", email: "", phone: "" });

export const emptyHandover = (): HandoverForm => ({
  sp_name: "",
  sp_email: "",
  sp_team: "",
  handover_date: today(),
  existing_client_id: "",
  company_name: "",
  industry: "",
  industry_other: "",
  company_location: "",
  company_location_other: "",
  company_ai_summary: null,
  website: "",
  contacts: [emptyContact()],
  sow_url: "",
  strategy_deck_url: "",
  keywords_url: "",
  geo_audit_url: "",
  fireflies_url: "",
  docs_notes: "",
  stage: "",
  bu: "",
  capability: "",
  deal_type: "",
  mrr: null,
  total_amount: null,
  duration_months: "",
  start_date: today(),
  vsd_suggested: "",
  deal_notes: "",
});

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const generateReference = () => {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const arr = new Uint32Array(5);
  (globalThis.crypto || (globalThis as any).msCrypto).getRandomValues(arr);
  for (let i = 0; i < 5; i++) s += chars[arr[i] % chars.length];
  return `HND-${year}-${s}`;
};

export const formatINR = (v: number | null) => {
  if (v == null || isNaN(v)) return "";
  return new Intl.NumberFormat("en-IN").format(Math.round(v));
};

export const currencyHelper = (v: number | null) => {
  if (!v) return "";
  if (v >= 10000000) return `= ₹${(v / 10000000).toFixed(2)} Cr`;
  return `= ₹${(v / 100000).toFixed(2)} L`;
};
