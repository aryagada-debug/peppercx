import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ApprovalRequestRow } from "@/lib/approvals";

export function useApprovals() {
  const [items, setItems] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("approval_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as ApprovalRequestRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("approval_requests_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { items, loading, refresh };
}

export function useOpenApprovalForDeal(dealId: string | undefined) {
  const [open, setOpen] = useState<ApprovalRequestRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!dealId) { setOpen(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("approval_requests")
      .select("*")
      .eq("deal_id", dealId)
      .in("status", ["pending", "under_review"])
      .order("created_at", { ascending: false })
      .limit(1);
    setOpen((data && data[0]) || null);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    refresh();
    if (!dealId) return;
    const ch = supabase
      .channel(`approval_open_${dealId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests", filter: `deal_id=eq.${dealId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh, dealId]);

  return { openRequest: open, loading, refresh };
}
