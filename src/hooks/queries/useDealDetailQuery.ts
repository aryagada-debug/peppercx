/**
 * Per-tab lazy query factories for the DealDetail page. Phase 5 will
 * wire these into `DealDetail.tsx`; this file is the stub agreed in the
 * Phase 2 plan so the cutover is a pure import swap.
 *
 * Each hook follows the same shape:
 *   - `enabled` controls lazy fetching (don't query a tab the user
 *     hasn't opened yet)
 *   - select() lists are tightened in Phase 5 once each tab's exact
 *     column set is verified
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

function tab(dealId: string, slice: string) {
  return qk.dealDetail(dealId, slice);
}

export function useDealCore(dealId: string, enabled = true) {
  return useQuery({
    queryKey: tab(dealId, "core"),
    enabled: enabled && !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staffing_deals")
        .select("*")
        .eq("id", dealId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useDealSow(dealId: string, enabled = false) {
  return useQuery({
    queryKey: tab(dealId, "sow"),
    enabled: enabled && !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_sow_items")
        .select("*")
        .eq("deal_id", dealId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDealTeam(dealId: string, enabled = false) {
  return useQuery({
    queryKey: tab(dealId, "team"),
    enabled: enabled && !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staffing_assignments")
        .select("*")
        .eq("deal_id", dealId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDealRgy(dealId: string, enabled = false) {
  return useQuery({
    queryKey: tab(dealId, "rgy"),
    enabled: enabled && !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_rgy_weekly")
        .select("*")
        .eq("deal_id", dealId)
        .order("week_start", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDealTasks(dealId: string, enabled = false) {
  return useQuery({
    queryKey: tab(dealId, "tasks"),
    enabled: enabled && !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_tasks")
        .select("*")
        .eq("deal_id", dealId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDealApprovals(dealId: string, enabled = false) {
  return useQuery({
    queryKey: tab(dealId, "approvals"),
    enabled: enabled && !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}