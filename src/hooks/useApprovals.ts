import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ApprovalRequestRow } from "@/lib/approvals";
import { qk } from "@/lib/queryKeys";

async function fetchAllApprovals(): Promise<ApprovalRequestRow[]> {
  const { data } = await (supabase as any)
    .from("approval_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as ApprovalRequestRow[]) || [];
}

async function fetchOpenApprovalForDeal(dealId: string): Promise<ApprovalRequestRow | null> {
  const { data } = await (supabase as any)
    .from("approval_requests")
    .select("*")
    .eq("deal_id", dealId)
    .in("status", ["pending", "under_review"])
    .order("created_at", { ascending: false })
    .limit(1);
  return (data && data[0]) || null;
}

export function useApprovals() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.approvals(), queryFn: fetchAllApprovals });

  useEffect(() => {
    const ch = supabase
      .channel("approval_requests_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests" }, () => {
        qc.invalidateQueries({ queryKey: qk.approvals() });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return {
    items: q.data || [],
    loading: q.isLoading,
    refresh: () => qc.invalidateQueries({ queryKey: qk.approvals() }),
  };
}

export function useOpenApprovalForDeal(dealId: string | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qk.openApprovalForDeal(dealId || "__none__"),
    queryFn: () => fetchOpenApprovalForDeal(dealId!),
    enabled: !!dealId,
  });

  useEffect(() => {
    if (!dealId) return;
    const ch = supabase
      .channel(`approval_open_${dealId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_requests", filter: `deal_id=eq.${dealId}` },
        () => qc.invalidateQueries({ queryKey: qk.openApprovalForDeal(dealId) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dealId, qc]);

  return {
    openRequest: dealId ? (q.data ?? null) : null,
    loading: !!dealId && q.isLoading,
    refresh: () => dealId && qc.invalidateQueries({ queryKey: qk.openApprovalForDeal(dealId) }),
  };
}
