import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId: string;
  dealLabel: string;
  initialRoleKey?: string;
  initialCategory?: string;
}

/**
 * Lightweight "Request staffing" dialog used in place of the old Add-Staffing-Member
 * flow. Captures a free-text request (with optional role/category prefilled into
 * the note) and inserts into `staffing_review_requests` for admins to action.
 */
export function RequestStaffingDialog({ open, onOpenChange, dealId, dealLabel, initialRoleKey, initialCategory }: Props) {
  const [note, setNote] = useState("");
  const [role, setRole] = useState(initialRoleKey || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRole(initialRoleKey || "");
      setNote("");
    }
  }, [open, initialRoleKey]);

  const submit = async () => {
    if (!note.trim()) {
      toast.error("Please describe the staffing request.");
      return;
    }
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
      const prefix = [
        initialCategory ? `Team: ${initialCategory}` : null,
        role ? `Role: ${role}` : null,
      ].filter(Boolean).join(" · ");
      const fullNote = prefix ? `${prefix}\n\n${note.trim()}` : note.trim();
      const { error } = await (supabase as any).from("staffing_review_requests").insert({
        deal_id: dealId,
        requested_by: uid,
        requested_by_name: name,
        note: fullNote,
        status: "open",
      });
      if (error) throw error;
      toast.success("Staffing request sent.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request staffing</DialogTitle>
          <DialogDescription>
            Send a request for <span className="font-medium text-foreground">{dealLabel}</span>.
            Admin / Central Cx will action it on the Staffing & Capacity page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {initialCategory && (
            <div className="text-[11px] text-muted-foreground">
              Team: <span className="text-foreground font-medium">{initialCategory}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Role (optional)</Label>
            <Input
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Senior SEO Analyst"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Request details</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What's needed? (e.g. 1 mid-level analyst at 40% from Jan; replacement for X going on leave; etc.)"
              rows={5}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !note.trim()}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}