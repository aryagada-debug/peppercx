import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

export interface RGYCombinedIssuePayload {
  issueDate: string;
  issueDetails: string;
  actionPlan: string;
  issueStatus: string;
  assignees: string[];
  dueDate: string;
  subtasks: { title: string }[];
}

export interface RGYCombinedIssuesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealLabel: string;
  nonGreenDims: { key: string; label: string; value: string }[];
  /** Team members to choose assignees from (deduped, names only) */
  assigneeNames: string[];
  /** Pre-fill from existing weekly issue (when editing) */
  initial?: Partial<RGYCombinedIssuePayload>;
  onSave: (data: RGYCombinedIssuePayload) => Promise<void>;
}

/**
 * Single combined Issues card for ALL non-green RGY dimensions on a deal.
 * Replaces the per-dimension pop-ups that used to appear on every R/Y click.
 */
export function RGYCombinedIssuesDialog({
  open,
  onOpenChange,
  dealLabel,
  nonGreenDims,
  assigneeNames,
  initial,
  onSave,
}: RGYCombinedIssuesDialogProps) {
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [issueDetails, setIssueDetails] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [issueStatus, setIssueStatus] = useState("Open");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<{ title: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset / pre-fill on open
  useEffect(() => {
    if (!open) return;
    setIssueDate(initial?.issueDate ? new Date(initial.issueDate) : new Date());
    setIssueDetails(initial?.issueDetails || "");
    setActionPlan(initial?.actionPlan || "");
    setDueDate(initial?.dueDate ? new Date(initial.dueDate) : undefined);
    setIssueStatus(initial?.issueStatus || "Open");
    setTaskAssignees(initial?.assignees || []);
    setSubtasks(initial?.subtasks || []);
  }, [open, initial]);

  const reds = nonGreenDims.filter(d => d.value === "R");
  const yellows = nonGreenDims.filter(d => d.value === "Y");

  const submit = async () => {
    if (!issueDetails.trim()) { toast.error("Please fill in issue details"); return; }
    if (!actionPlan.trim()) { toast.error("Please fill in the action plan"); return; }
    setSaving(true);
    try {
      await onSave({
        issueDate: issueDate.toISOString().split("T")[0],
        issueDetails: issueDetails.trim(),
        actionPlan: actionPlan.trim(),
        issueStatus,
        assignees: taskAssignees,
        dueDate: dueDate?.toISOString().split("T")[0] || "",
        subtasks: subtasks.filter(s => s.title.trim()),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Combined Issues — {dealLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Affected dimensions chip strip */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Affects {nonGreenDims.length} dimension{nonGreenDims.length === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {reds.map(d => (
                <Badge key={d.key} variant="outline" className="text-xs bg-[hsl(0_80%_95%)] text-[hsl(0_60%_30%)] border-[hsl(0_65%_76%)]">
                  {d.label} · Red
                </Badge>
              ))}
              {yellows.map(d => (
                <Badge key={d.key} variant="outline" className="text-xs bg-[hsl(35_90%_92%)] text-[hsl(28_90%_22%)] border-[hsl(35_87%_55%)]">
                  {d.label} · Yellow
                </Badge>
              ))}
              {nonGreenDims.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No non-green dimensions to document.</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              One combined issue + action plan applies to all of the above. A single task will be created tagged with each dimension.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Issue Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left text-sm font-normal h-9">
                    <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    {format(issueDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={issueDate} onSelect={d => d && setIssueDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={issueStatus} onValueChange={setIssueStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Issue Details</label>
            <Textarea value={issueDetails} onChange={e => setIssueDetails(e.target.value)} placeholder="Describe what's going wrong across the affected dimensions…" className="text-sm min-h-[80px]" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Action Plan</label>
            <Textarea value={actionPlan} onChange={e => setActionPlan(e.target.value)} placeholder="One combined plan to address all of the above…" className="text-sm min-h-[80px]" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Assignees</label>
            <div className="flex flex-wrap gap-1.5">
              {assigneeNames.map(name => {
                const selected = taskAssignees.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setTaskAssignees(prev => selected ? prev.filter(a => a !== name) : [...prev, name])}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[11px] border transition-colors",
                      selected
                        ? "bg-primary/15 border-primary/40 text-primary font-medium"
                        : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
              {assigneeNames.length === 0 && (
                <span className="text-[11px] text-muted-foreground italic">No team members available</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left text-sm font-normal h-9", !dueDate && "text-muted-foreground")}>
                  <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  {dueDate ? format(dueDate, "dd MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={dueDate} onSelect={setDueDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Subtasks</label>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setSubtasks(prev => [...prev, { title: "" }])}>
                <Plus className="h-3 w-3" /> Add Subtask
              </Button>
            </div>
            <div className="space-y-2">
              {subtasks.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={s.title}
                    onChange={e => setSubtasks(prev => prev.map((x, i) => i === idx ? { title: e.target.value } : x))}
                    placeholder="Subtask title…"
                    className="h-8 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setSubtasks(prev => prev.filter((_, i) => i !== idx))}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {subtasks.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">No subtasks yet.</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save combined issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}