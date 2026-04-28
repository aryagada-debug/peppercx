import { useEffect, useState } from "react";
import { MessageSquareWarning, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";

interface Props {
  dealId: string;
  dealLabel: string;
}

interface OpenReq {
  id: string;
  created_at: string;
  requested_by_name: string;
  note: string;
}

export function RequestStaffingReviewButton({ dealId, dealLabel }: Props) {
  const [openDialog, setOpenDialog] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<OpenReq | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("staffing_review_requests")
      .select("id, created_at, requested_by_name, note")
      .eq("deal_id", dealId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1);
    setExisting(data?.[0] || null);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dealId]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", uid)
        .maybeSingle();
      const name = profile?.display_name || userRes?.user?.email || "Unknown user";
      const { error } = await (supabase as any).from("staffing_review_requests").insert({
        deal_id: dealId,
        requested_by: uid,
        requested_by_name: name,
        note,
        status: "open",
      });
      if (error) throw error;
      toast.success("Review requested — Admin & Central Cx have been notified.");
      setOpenDialog(false);
      setNote("");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not submit review request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <button disabled className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-caption text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading…
      </button>
    );
  }

  if (existing) {
    return (
      <span
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-warning/10 border border-warning/30 text-warning text-caption font-medium"
        title={existing.note ? `"${existing.note}" — ${existing.requested_by_name}` : `Requested by ${existing.requested_by_name}`}
      >
        <CheckCircle2 className="h-3 w-3" />
        Review pending • {formatDistanceToNow(new Date(existing.created_at), { addSuffix: true })}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenDialog(true)}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-caption font-medium hover:bg-primary/90 transition-colors"
      >
        <MessageSquareWarning className="h-3 w-3" />
        Request staffing review
      </button>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request staffing review</DialogTitle>
            <DialogDescription>
              Flag this deal — <span className="font-medium text-foreground">{dealLabel}</span> — to Admin / Central Cx.
              They'll see your request on the Staffing & Capacity page.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional: what should they look at? (e.g. need a senior copywriter, allocations look low)"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDialog(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}