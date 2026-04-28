import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

interface ReviewReq {
  id: string;
  deal_id: string;
  requested_by_name: string;
  note: string;
  status: string;
  created_at: string;
}

export function StaffingReviewRequestsButton() {
  const { role } = useUserRole();
  const isAdminLike = role === "admin" || role === "moderator";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReviewReq[]>([]);
  const [dealNames, setDealNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("staffing_review_requests")
      .select("id, deal_id, requested_by_name, note, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    const list: ReviewReq[] = data || [];
    setItems(list);
    if (list.length > 0) {
      const ids = Array.from(new Set(list.map(r => r.deal_id)));
      const { data: deals } = await supabase
        .from("staffing_deals")
        .select("id, account, deal_name")
        .in("id", ids);
      const map: Record<string, string> = {};
      (deals || []).forEach((d: any) => {
        map[d.id] = d.account || d.deal_name || d.id;
      });
      setDealNames(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("staffing_review_requests_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "staffing_review_requests" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const resolve = async (id: string) => {
    if (!isAdminLike) {
      toast.error("Only admins can resolve review requests.");
      return;
    }
    setResolving(id);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      const { data: profile } = await supabase
        .from("profiles").select("display_name").eq("user_id", uid!).maybeSingle();
      const name = profile?.display_name || userRes?.user?.email || "";
      const { error } = await (supabase as any)
        .from("staffing_review_requests")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: uid, resolved_by_name: name })
        .eq("id", id);
      if (error) throw error;
      toast.success("Request marked resolved");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not resolve");
    } finally {
      setResolving(null);
    }
  };

  const count = items.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-ui font-medium text-foreground hover:bg-secondary transition-colors relative"
        title="BOPM staffing review requests"
      >
        <Bell className="h-3.5 w-3.5" />
        Review requests
        {count > 0 && (
          <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-full bg-warning text-warning-foreground text-caption font-bold">
            {count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Staffing review requests</SheetTitle>
            <SheetDescription>
              Open requests raised by BOPMs on their deals.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-ui">
                No open requests.
              </div>
            )}
            {items.map(r => (
              <div key={r.id} className="border border-border rounded-md p-3 bg-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-foreground text-ui truncate">
                    {dealNames[r.deal_id] || r.deal_id}
                  </div>
                  <span className="text-caption text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-caption text-muted-foreground mt-0.5">
                  by {r.requested_by_name || "Unknown"}
                </div>
                {r.note && (
                  <div className="mt-2 text-ui text-foreground bg-secondary rounded px-2 py-1.5">
                    "{r.note}"
                  </div>
                )}
                {isAdminLike && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => resolve(r.id)}
                      disabled={resolving === r.id}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-caption font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      {resolving === r.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <CheckCircle2 className="h-3 w-3" />}
                      Mark resolved
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}