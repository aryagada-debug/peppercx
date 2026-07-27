import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsFilters = {
  startDate: string | null; // ISO
  endDate: string | null;
  vsd: string;             // "All" | name | "Other" | "Unassigned"
  bopm: string;            // "All" | name
  capabilities: string[];  // normalized role_keys
  search: string;
  showClosed: boolean;
  bopmTier: "any" | "principal" | "senior" | "bopm";
  businessUnit?: string;   // "All" | name
  campaignId?: string;     // "All" | uuid | "none"
};

export type InviteRow = {
  id: string;
  deal_id: string;
  account: string | null;
  deal_name: string | null;
  vsd: string | null;
  principal_bopm: string | null;
  senior_bopm: string | null;
  bopm: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  email_status: string | null;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  error: string | null;
  deal_status: string | null;
  deal_value: number | null;
  mrr: number | null;
  deal_type: string | null;
  business_unit: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
};

export type ResponseRow = {
  id: string;
  invite_id: string;
  deal_id: string;
  submitted_at: string;
  nps: number | null;
  csat_avg: number | null;
  ces: number | null;
  renew: string | null;
  mood: string | null;
  churn_risk: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  payload: any;
  source: string | null;
};

export type CapabilityRow = {
  deal_id: string;
  role_key: string;
  person_name: string | null;
};

export function usePulseAnalyticsData(filters: AnalyticsFilters, enabled: boolean) {
  // Invites + responses fetched together (joined via invite_id).
  const invitesQ = useQuery({
    queryKey: ["pulse-analytics-invites", filters.startDate, filters.endDate, filters.showClosed],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from("survey_invites")
        .select("id, deal_id, account_snapshot, deal_name_snapshot, vsd_name, principal_bopm, senior_bopm, bopm, recipient_name, recipient_email, email_status, sent_at, opened_at, completed_at, error, campaign_id")
        .order("sent_at", { ascending: false })
        .limit(5000);
      if (filters.startDate) q = q.gte("sent_at", filters.startDate);
      if (filters.endDate) q = q.lte("sent_at", filters.endDate);
      const { data, error } = await q;
      if (error) throw error;
      const invites = (data || []) as any[];
      // Hydrate deal_status for closed-filter
      const ids = Array.from(new Set(invites.map(i => i.deal_id))).filter(Boolean);
      let statusMap = new Map<string, string>();
      let dealMap = new Map<string, { deal_value: number | null; mrr: number | null; deal_type: string | null; business_unit: string | null }>();
      if (ids.length) {
        const { data: dealsData } = await supabase
          .from("staffing_deals")
          .select("id, deal_status, total_deal_value, mrr, deal_type, business_unit")
          .in("id", ids);
        (dealsData || []).forEach((d: any) => {
          statusMap.set(d.id, d.deal_status || "");
          dealMap.set(d.id, {
            deal_value: d.total_deal_value ?? null,
            mrr: d.mrr ?? null,
            deal_type: d.deal_type ?? null,
            business_unit: d.business_unit ?? null,
          });
        });
      }
      // Hydrate campaign names
      const campaignIds = Array.from(new Set(invites.map(i => i.campaign_id).filter(Boolean)));
      const campaignMap = new Map<string, string>();
      if (campaignIds.length) {
        const { data: camps } = await supabase
          .from("pulse_campaigns")
          .select("id, name")
          .in("id", campaignIds);
        (camps || []).forEach((c: any) => campaignMap.set(c.id, c.name));
      }
      return invites.map(i => ({
        id: i.id,
        deal_id: i.deal_id,
        account: i.account_snapshot,
        deal_name: i.deal_name_snapshot,
        vsd: i.vsd_name,
        principal_bopm: i.principal_bopm,
        senior_bopm: i.senior_bopm,
        bopm: i.bopm,
        recipient_name: i.recipient_name,
        recipient_email: i.recipient_email,
        email_status: i.email_status,
        sent_at: i.sent_at,
        opened_at: i.opened_at,
        completed_at: i.completed_at,
        error: i.error ?? null,
        deal_status: statusMap.get(i.deal_id) ?? null,
        deal_value: dealMap.get(i.deal_id)?.deal_value ?? null,
        mrr: dealMap.get(i.deal_id)?.mrr ?? null,
        deal_type: dealMap.get(i.deal_id)?.deal_type ?? null,
        business_unit: dealMap.get(i.deal_id)?.business_unit ?? null,
        campaign_id: i.campaign_id ?? null,
        campaign_name: i.campaign_id ? (campaignMap.get(i.campaign_id) ?? null) : null,
      })) as InviteRow[];
    },
  });

  const responsesQ = useQuery({
    queryKey: ["pulse-analytics-responses", filters.startDate, filters.endDate],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from("survey_responses")
        .select("id, invite_id, deal_id, submitted_at, nps, csat_avg, ces, renew, mood, churn_risk, respondent_name, respondent_email, payload, source")
        .order("submitted_at", { ascending: false })
        .limit(5000);
      if (filters.startDate) q = q.gte("submitted_at", filters.startDate);
      if (filters.endDate) q = q.lte("submitted_at", filters.endDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ResponseRow[];
    },
  });

  const capabilitiesQ = useQuery({
    queryKey: ["pulse-analytics-capabilities", (invitesQ.data || []).map(i => i.deal_id).join(",")],
    enabled: enabled && !!invitesQ.data && invitesQ.data.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((invitesQ.data || []).map(i => i.deal_id))).filter(Boolean);
      if (!ids.length) return [] as CapabilityRow[];
      const { data, error } = await supabase
        .from("staffing_assignments")
        .select("staffing_deal_id, role_key, person_id, staffing_people:person_id(name)")
        .in("staffing_deal_id", ids)
        .limit(10000);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        deal_id: r.staffing_deal_id,
        role_key: normalizeRoleKey(r.role_key),
        person_name: r.staffing_people?.name ?? null,
      })) as CapabilityRow[];
    },
  });

  return {
    invites: invitesQ.data || [],
    responses: responsesQ.data || [],
    capabilities: capabilitiesQ.data || [],
    isLoading: invitesQ.isLoading || responsesQ.isLoading,
    isError: invitesQ.isError || responsesQ.isError,
  };
}

// Mirrors SQL normalize_staffing_role_key.
export function normalizeRoleKey(k: string | null | undefined): string {
  const v = (k || "").trim().toLowerCase();
  const map: Record<string, string> = {
    "vsd": "vsd", "rt_vsd": "vsd",
    "principal bopm": "principal_bopm", "principal_bopm": "principal_bopm",
    "rt_group_bopm": "principal_bopm", "group bopm": "principal_bopm",
    "senior bopm": "senior_bopm", "sr bopm": "senior_bopm",
    "senior_bopm": "senior_bopm", "rt_senior_bopm": "senior_bopm",
    "bopm": "bopm", "rt_bopm": "bopm",
    "managing editor": "managing_editor", "managing_editor": "managing_editor",
    "content lead": "content_lead", "content_lead": "content_lead",
    "senior editor": "senior_editor", "senior_editor": "senior_editor",
    "seo leader": "seo_leader", "seo_leader": "seo_leader",
    "group head": "seo_group_head", "seo group head": "seo_group_head", "seo_group_head": "seo_group_head",
    "sr. seo manager": "sr_seo_manager", "senior seo manager": "sr_seo_manager", "sr_seo_manager": "sr_seo_manager",
    "seo manager": "seo_manager", "seo_manager": "seo_manager",
    "sr. seo analyst": "sr_seo_analyst", "senior seo analyst": "sr_seo_analyst", "sr_seo_analyst": "sr_seo_analyst",
    "seo analyst": "seo_analyst", "seo_analyst": "seo_analyst",
  };
  return map[v] || v.replace(/\s+/g, "_");
}

export const CAPABILITY_LABELS: Record<string, string> = {
  vsd: "VSD",
  principal_bopm: "Principal BOPM",
  senior_bopm: "Senior BOPM",
  bopm: "BOPM",
  managing_editor: "Managing Editor",
  content_lead: "Content Lead",
  senior_editor: "Senior Editor",
  seo_leader: "SEO Leader",
  seo_group_head: "SEO Group Head",
  sr_seo_manager: "Sr. SEO Manager",
  seo_manager: "SEO Manager",
  sr_seo_analyst: "Sr. SEO Analyst",
  seo_analyst: "SEO Analyst",
};

export function capabilityLabel(key: string): string {
  return CAPABILITY_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function splitNames(s: string | null | undefined): string[] {
  return (s || "").split(/[,/]/).map(x => x.trim()).filter(Boolean);
}

export function normName(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}