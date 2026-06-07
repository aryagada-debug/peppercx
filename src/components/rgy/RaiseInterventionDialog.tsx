import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

type DealOption = { id: string; deal_name: string; account: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId?: string;          // pre-fill, locked when present
  dealLabel?: string;       // friendly label when dealId is pre-filled
  rgyWeek?: string | null;  // YYYY-MM-DD
  onCreated?: (id: string) => void;
}

export function RaiseInterventionDialog({ open, onOpenChange, dealId, dealLabel, rgyWeek, onCreated }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"High" | "Medium" | "Low">("Medium");
  const [selectedDealId, setSelectedDealId] = useState<string>(dealId || "");
  const [search, setSearch] = useState("");
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setUrgency("Medium");
      setSelectedDealId(dealId || "");
      setSearch("");
    }
  }, [open, dealId]);

  // Load a small searchable list of deals only when no deal is pre-filled.
  useEffect(() => {
    if (!open || dealId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("staffing_deals")
        .select("id, deal_name, account")
        .order("account", { ascending: true })
        .limit(500);
      if (!cancelled) setDeals(((data || []) as any[]).map((d) => ({ id: d.id, deal_name: d.deal_name || "", account: d.account || "" })));
    })();
    return () => { cancelled = true; };
  }, [open, dealId]);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals.slice(0, 50);
    return deals.filter((d) =>
      d.deal_name.toLowerCase().includes(q) || d.account.toLowerCase().includes(q),
    ).slice(0, 50);
  }, [deals, search]);

  const canSubmit = !!selectedDealId && title.trim().length > 0 && description.trim().length > 0 && !saving;

  const submit = async () => {
    if (!user || !canSubmit) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("rgy_leadership_interventions")
        .insert({
          deal_id: selectedDealId,
          rgy_week: rgyWeek || null,
          title: title.trim(),
          description: description.trim(),
          urgency,
          status: "Open",
          raised_by_user_id: user.id,
          raised_by_name: (user.user_metadata?.full_name as string) || user.email || "",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Leadership intervention raised");
      onCreated?.(data.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to raise intervention");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Flag Leadership Intervention
          </DialogTitle>
          <DialogDescription>
            Raise a request for leadership help on this deal. Admins, VSDs and Capability Leads will see it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Deal</Label>
            {dealId ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {dealLabel || dealId}
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search deal or account…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="max-h-40 overflow-auto rounded-md border border-border divide-y divide-border">
                  {filteredDeals.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No deals match.</div>
                  )}
                  {filteredDeals.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDealId(d.id)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${selectedDealId === d.id ? "bg-accent" : ""}`}
                    >
                      <div className="truncate">{d.deal_name || "(unnamed)"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{d.account}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rli-title">Title</Label>
            <Input
              id="rli-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="One-line summary of what's needed"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rli-desc">Context</Label>
            <Textarea
              id="rli-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the situation and what kind of leadership help would unblock you?"
              rows={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Urgency</Label>
            <Select value={urgency} onValueChange={(v) => setUrgency(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Raise intervention
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}