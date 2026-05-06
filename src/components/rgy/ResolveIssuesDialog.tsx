import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ResolveMode = "optional" | "required";

interface OpenItem {
  kind: "issue" | "task";
  id: string;
  label: string;
  meta?: string;
}

interface Props {
  open: boolean;
  dealId: string;
  dealName?: string;
  mode: ResolveMode;
  /** Title override; defaults based on mode. */
  title?: string;
  /** When set, scope listed issues/tasks to this dimension label only (e.g. "Content").
   *  Used for "move dimension to Green" flows so the user only resolves the
   *  task(s) tied to that specific dimension. */
  dimensionLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Lists open RGY issues + tasks for a deal.
 *  - mode="optional" — user may tick any or none and click "Save".
 *  - mode="required" — user must tick every row before "Confirm" is enabled.
 * Resolving sets `deal_rgy_weekly.issue_status='Resolved'` and
 * `deal_tasks.stage='Done'` for the selected rows.
 */
export function ResolveIssuesDialog({ open, dealId, dealName, mode, title, dimensionLabel, onConfirm, onCancel }: Props) {
  const [items, setItems] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [issuesRes, tasksRes] = await Promise.all([
        supabase
          .from("deal_rgy_weekly")
          .select("id, issue_details, issue_status, week_start")
          .eq("deal_id", dealId)
          .in("issue_status", ["Open", "In Progress"]),
        supabase
          .from("deal_tasks")
          .select("id, title, stage")
          .eq("deal_id", dealId)
          .like("title", "[RGY Health]%")
          .neq("stage", "Done"),
      ]);
      if (cancelled) return;
      const out: OpenItem[] = [];
      (tasksRes.data || []).forEach((t: any) => {
        if (dimensionLabel && !String(t.title).includes(dimensionLabel)) return;
        out.push({ kind: "task", id: t.id, label: t.title, meta: t.stage });
      });
      // Always include open weekly issues — they block Green at the deal level.
      (issuesRes.data || []).forEach((r: any) => {
        if (!r.issue_details) return;
        out.push({
          kind: "issue",
          id: r.id,
          label: r.issue_details,
          meta: `Week of ${r.week_start}`,
        });
      });
      setItems(out);
      setPicked(new Set());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, dealId, dimensionLabel]);

  const allTicked = items.length > 0 && items.every(i => picked.has(`${i.kind}:${i.id}`));
  const canConfirm = mode === "optional" ? !saving : (items.length === 0 || allTicked) && !saving;

  const toggle = (it: OpenItem) => {
    const k = `${it.kind}:${it.id}`;
    setPicked(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };

  const tickAll = () => {
    setPicked(new Set(items.map(i => `${i.kind}:${i.id}`)));
  };

  const submit = async () => {
    setSaving(true);
    try {
      const issueIds: string[] = [];
      const taskIds: string[] = [];
      for (const it of items) {
        if (!picked.has(`${it.kind}:${it.id}`)) continue;
        if (it.kind === "issue") issueIds.push(it.id);
        else taskIds.push(it.id);
      }
      if (issueIds.length > 0) {
        await supabase
          .from("deal_rgy_weekly")
          .update({ issue_status: "Resolved" } as any)
          .in("id", issueIds);
      }
      if (taskIds.length > 0) {
        await supabase
          .from("deal_tasks")
          .update({ stage: "Done" } as any)
          .in("id", taskIds);
      }
      await onConfirm();
    } finally {
      setSaving(false);
    }
  };

  const heading = title || (mode === "required"
    ? (dimensionLabel
        ? `Close ${dimensionLabel} task(s) to set Green`
        : "Resolve open issues to set Green")
    : "Resolve open issues (optional)");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={cn("h-4 w-4", mode === "required" ? "text-emerald-600" : "text-amber-500")} />
            {heading}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {mode === "required"
            ? (dimensionLabel
                ? `Mark the open ${dimensionLabel} task(s) below as closed to set ${dimensionLabel} to Green on ${dealName || "this deal"}.`
                : `Every open issue and task on ${dealName || "this deal"} must be marked resolved before this dimension can be set to Green.`)
            : `Optionally mark issues on ${dealName || "this deal"} as resolved. You can skip and resolve them later.`}
        </p>
        {loading ? (
          <div className="py-6 flex items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">No open issues or tasks on this deal.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{picked.size} of {items.length} selected</span>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={tickAll}>Select all</Button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {items.map(it => {
                const k = `${it.kind}:${it.id}`;
                const checked = picked.has(k);
                return (
                  <label key={k} className="flex items-start gap-2 p-2 rounded-md bg-secondary/30 cursor-pointer hover:bg-secondary/50">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(it)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs", checked && "line-through text-muted-foreground")}>{it.label}</p>
                      {it.meta && <p className="text-[10px] text-muted-foreground">{it.kind === "task" ? "Task" : "Issue"} · {it.meta}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {mode === "required" ? "Cancel (revert)" : "Skip"}
          </Button>
          <Button onClick={submit} disabled={!canConfirm}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (mode === "required" ? "Confirm Green" : "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}