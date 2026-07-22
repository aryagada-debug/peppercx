import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MemberBandwidthRow {
  deal_id: string;
  deal_name: string;
  account: string;
  deal_status: string | null;
  role_key: string | null;
  allocation_pct: number;
  mrr: number | null;
  attributed_mrr: number;
}

export interface MemberBandwidthSummary {
  rows: MemberBandwidthRow[];
  totalAllocation: number;
  totalMrr: number;
  attributedMrr: number;
  activeDeals: number;
}

const ACTIVE = new Set([
  "active deal",
  "new deal in sla/po",
  "deal disputed",
  "deal in renewal process",
]);

export function useMemberBandwidth(personId: string | null) {
  return useQuery({
    queryKey: ["seo-kra-bandwidth", personId],
    enabled: !!personId,
    queryFn: async (): Promise<MemberBandwidthSummary> => {
      if (!personId) return { rows: [], totalAllocation: 0, totalMrr: 0, attributedMrr: 0, activeDeals: 0 };
      const { data: assigns } = await supabase
        .from("staffing_assignments")
        .select("staffing_deal_id, role_key, allocation_pct")
        .eq("person_id", personId);
      const list = (assigns || []) as any[];
      const dealIds = Array.from(new Set(list.map(a => a.staffing_deal_id).filter(Boolean)));
      const { data: deals } = dealIds.length
        ? await supabase.from("staffing_deals").select("id, account, deal_name, deal_status, mrr").in("id", dealIds)
        : { data: [] as any[] };
      const dealMap = new Map<string, any>((deals || []).map((d: any) => [d.id, d]));
      const rows: MemberBandwidthRow[] = list
        .map(a => {
          const d = dealMap.get(a.staffing_deal_id);
          if (!d) return null;
          const alloc = Number(a.allocation_pct) || 0;
          const mrr = d.mrr == null ? null : Number(d.mrr);
          return {
            deal_id: d.id,
            deal_name: d.deal_name || d.account || d.id,
            account: d.account || "",
            deal_status: d.deal_status || null,
            role_key: a.role_key || null,
            allocation_pct: alloc,
            mrr,
            attributed_mrr: mrr != null ? (mrr * alloc) / 100 : 0,
          } as MemberBandwidthRow;
        })
        .filter((r): r is MemberBandwidthRow => !!r)
        .filter(r => ACTIVE.has((r.deal_status || "").trim().toLowerCase()))
        .sort((a, b) => b.allocation_pct - a.allocation_pct);
      const totalAllocation = rows.reduce((s, r) => s + r.allocation_pct, 0);
      const totalMrr = rows.reduce((s, r) => s + (r.mrr || 0), 0);
      const attributedMrr = rows.reduce((s, r) => s + r.attributed_mrr, 0);
      return { rows, totalAllocation, totalMrr, attributedMrr, activeDeals: rows.length };
    },
    staleTime: 60 * 1000,
  });
}