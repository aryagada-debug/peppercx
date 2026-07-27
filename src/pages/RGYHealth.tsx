import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { DealDetailDialog } from "@/components/rgy/DealDetailDialog";
import { RGYInsightsTab } from "@/components/rgy/RGYInsightsTab";
import { RGYHistoryPopover } from "@/components/rgy/RGYHistoryPopover";
import { ResolveIssuesDialog } from "@/components/rgy/ResolveIssuesDialog";
import { logRGYChange } from "@/lib/rgyHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, AlertCircle, CheckCircle2, Activity, Plus, Trash2, Check, X, Calendar, Loader2, Settings2, Info, Circle, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollToStartButton } from "@/components/ui/ScrollToStartButton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { RGYStatus } from "@/types/dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ColHeader } from "@/components/table/ColHeader";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { isRetainerDeal } from "@/hooks/useMBRData";
import { useAppUsers, useVsdUsers, useVsdHierarchy, nameKey } from "@/hooks/queries/legacy";
import { useUserRole } from "@/hooks/useUserRole";
import { ReadOnlyBanner } from "@/components/access/ReadOnlyBanner";
import { useDealAccess } from "@/hooks/useDealAccess";
import { BopmEmptyState } from "@/components/access/BopmEmptyState";
import { useAuth } from "@/components/auth/AuthProvider";
import { getOverallCustomerRGY as computeOverallCustomerRGY, computeOverallCustomerScore } from "@/lib/overallCustomerRGY";
import { WeeklyComplianceTab } from "@/components/rgy/WeeklyComplianceTab";
import { RaiseInterventionDialog } from "@/components/rgy/RaiseInterventionDialog";
import { MarkRGYDialog, type MarkRGYDimension } from "@/components/rgy/MarkRGYDialog";
import { sendAppEmail } from "@/lib/appEmail";
import { RGYCombinedIssuesDialog } from "@/components/rgy/RGYCombinedIssuesDialog";
import { useCanEditRgy } from "@/hooks/useCanEditRgy";

type VsdFilterKey = string;
const UNASSIGNED_VSD_VALUES = new Set(["", "Not Assigned", "Unassigned", "Not Applicable", "To Be Assigned", "Yet to be assigned"]);

const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);

const DIMENSIONS = [
  { key: "customer", label: "Overall Customer" },
  { key: "internal", label: "Internal" },
  { key: "content", label: "Content" },
  { key: "seo", label: "SEO" },
  { key: "supply", label: "Supply" },
  { key: "copy", label: "Copy" },
  { key: "design", label: "Design" },
  { key: "video", label: "Video" },
];

type RGYCellValue = RGYStatus | "PENDING";
const RGY_OPTIONS: { value: RGYCellValue; label: string }[] = [
  { value: "G", label: "Green" },
  { value: "Y", label: "Yellow" },
  { value: "R", label: "Red" },
  { value: "NA", label: "N/A" },
  { value: "PENDING", label: "Pending" },
];

const cellColors: Record<RGYCellValue, string> = {
  R: "rgy-red",
  G: "rgy-green",
  Y: "rgy-yellow",
  NA: "rgy-na",
  PENDING: "rgy-pending",
};

const cellLabels: Record<RGYCellValue, string> = {
  R: "R", G: "G", Y: "Y", NA: "NA", PENDING: "Pending",
};

const statusLabels: Record<RGYCellValue, string> = {
  R: "Red", G: "Green", Y: "Yellow", NA: "N/A", PENDING: "Pending",
};

// Map between user-facing filter labels and stored RGY codes
const RGY_FILTER_LABEL_TO_CODE: Record<string, RGYStatus | "Pending"> = {
  Green: "G", Yellow: "Y", Red: "R", NA: "NA", Pending: "Pending",
};

const statusBadgeStyles: Record<string, string> = {
  "Active Deal": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "Deal Disputed": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "New Deal in SLA/PO": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Deal Completed Successfully": "bg-muted text-muted-foreground border-border",
  "Deal Churned / Lost": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const statusShortLabels: Record<string, string> = {
  "Active Deal": "Active",
  "Deal Disputed": "Disputed",
  "New Deal in SLA/PO": "New/SLA",
  "Deal Completed Successfully": "Completed",
  "Deal Churned / Lost": "Churned",
};

const worstDotColor: Record<string, string> = {
  R: "bg-red-500",
  Y: "bg-amber-500",
  G: "bg-emerald-500",
};

interface DealWithRGY {
  id: string;
  deal_id: string;
  deal_name: string;
  account: string;
  bopm: string;
  deal_status: string;
  pod: string;
  vsd: string;
  pc_code: string;
  mrr: number | null;
  total_deal_value: number | null;
  principal_bopm: string;
  senior_bopm: string;
  start_date: string | null;
  end_date: string | null;
  payment_terms: string;
  deal_type?: string | null;
  customer_type?: string | null;
  rgy_row_id?: string;
  rgy_week_start?: string;
  rgy_action_plan?: string;
  rgy_discussed_action_plan?: string;
  rgy_issue_details?: string;
  rgy_issue_date?: string | null;
  rgy_created_at?: string | null;
  rgy_updated_at?: string | null;
  rgy_updated_by_name?: string | null;
  deal_created_at?: string | null;
  customer: string;
  internal: string;
  content: string;
  seo: string;
  supply: string;
  copy: string;
  design: string;
  video: string;
}

function getPodForDeal(vsd: string, pod: string): string {
  if (pod && pod !== "" && pod !== "Not Assigned" && pod !== "Unassigned" && pod !== "Not Applicable") return pod;
  const vsdMap: Record<string, string> = {
    "Sneha Iyer": "FMCG",
    "Aamir Khan": "Integrated",
    "Neema Jayadas": "US B2B",
    "Sumit Shekhawat": "India B2B",
    "Aditya Shaw": "BFSI",
  };
  return vsdMap[vsd] || "Unassigned";
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function getWorstRGY(deal: DealWithRGY): "R" | "Y" | "G" | null {
  // Weighted Overall Customer RGY — see src/lib/overallCustomerRGY.ts.
  // Name kept as `getWorstRGY` to minimize churn at call sites.
  const dims: Record<string, string> = {};
  for (const d of DIMENSIONS) dims[d.key] = (deal[d.key as keyof DealWithRGY] as string) || "";
  return computeOverallCustomerRGY(dims);
}

// ── Read-only RGY Cell — editing happens via the per-row Mark RGY dialog ──
function RGYCell({
  value,
  label,
  issueDetails,
  actionPlan,
  issueDate,
  updatedByName,
}: {
  value: RGYCellValue;
  label: string;
  issueDetails?: string;
  actionPlan?: string;
  issueDate?: string | null;
  updatedByName?: string | null;
}) {
  const showContext = (value === "R" || value === "Y");
  const hasContext = showContext && !!((issueDetails && issueDetails.trim()) || (actionPlan && actionPlan.trim()));
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-md text-caption font-semibold",
            value === "PENDING" ? "px-2 h-7 text-[10px]" : "w-7 h-7",
            cellColors[value]
          )}
          aria-label={`${label}: ${statusLabels[value]}`}
        >
          {cellLabels[value]}
        </span>
      </TooltipTrigger>
      <TooltipContent className={cn(showContext && hasContext && "max-w-xs")}>
        <p className="font-medium">{label} · {statusLabels[value]}</p>
        {showContext && hasContext ? (
          <div className="mt-1.5 space-y-1.5">
            {issueDetails && issueDetails.trim() && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Issue</p>
                <p className="text-[11px] whitespace-pre-wrap leading-snug">{issueDetails}</p>
              </div>
            )}
            {actionPlan && actionPlan.trim() && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Action plan</p>
                <p className="text-[11px] whitespace-pre-wrap leading-snug">{actionPlan}</p>
              </div>
            )}
            {(issueDate || updatedByName) && (
              <p className="text-[10px] text-muted-foreground pt-0.5 border-t border-border/40">
                {issueDate ? `Logged ${issueDate}` : ""}
                {issueDate && updatedByName ? " · " : ""}
                {updatedByName || ""}
              </p>
            )}
          </div>
        ) : showContext ? (
          <p className="text-[10px] text-muted-foreground mt-0.5 italic">No issue logged yet — use “Mark RGY” to add details</p>
        ) : (
          <p className="text-[10px] text-muted-foreground mt-0.5">Use “Mark RGY” to change</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Green-Gate Confirmation Dialog ──
function GreenGateDialog({
  pendingTasks,
  onConfirm,
  onCancel,
  onMarkDone,
}: {
  pendingTasks: { id: string; title: string; stage: string }[];
  onConfirm: () => void;
  onCancel: () => void;
  onMarkDone: (taskId: string) => Promise<void>;
}) {
  const [markingDone, setMarkingDone] = useState<Set<string>>(new Set());
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());

  const handleMarkDone = async (taskId: string) => {
    setMarkingDone(prev => new Set(prev).add(taskId));
    await onMarkDone(taskId);
    setDoneTasks(prev => new Set(prev).add(taskId));
    setMarkingDone(prev => { const n = new Set(prev); n.delete(taskId); return n; });
  };

  const allDone = pendingTasks.every(t => doneTasks.has(t.id));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Pending Tasks Must Be Closed
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The following [RGY Health] tasks must be marked as Done before setting this dimension to Green:
        </p>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {pendingTasks.map(task => (
            <div key={task.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-md">
              <span className={cn("text-xs flex-1", doneTasks.has(task.id) && "line-through text-muted-foreground")}>{task.title}</span>
              {doneTasks.has(task.id) ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={markingDone.has(task.id)}
                  onClick={() => handleMarkDone(task.id)}
                >
                  {markingDone.has(task.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Done"}
                </Button>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} disabled={!allDone}>
            {allDone ? "Set to Green" : "Close all tasks first"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Plan of Action Issue Form ──
interface RGYIssueTask {
  dimension: string;
  issueSummary: string;
  urgency: string;
  assignees: string[];
}

const RGYIssueFormDialog = React.memo(function RGYIssueFormDialog({
  deal,
  nonGreenDims,
  onSave,
  onCancel,
}: {
  deal: DealWithRGY;
  nonGreenDims: { key: string; label: string; value: string }[];
  onSave: (data: {
    issueDate: string;
    issueDetails: string;
    actionPlan: string;
    issueStatus: string;
    assignees: string[];
    dueDate: string;
    subtasks: { title: string }[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [issueDetails, setIssueDetails] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [issueStatus, setIssueStatus] = useState("Open");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<{ title: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const allAssigneeNames = [...new Set(
    [deal.vsd, deal.principal_bopm, deal.senior_bopm, deal.bopm].filter(Boolean)
  )];

  const handleSubmit = async () => {
    if (!issueDetails.trim()) {
      toast.error("Please fill in issue details");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        issueDate: issueDate.toISOString().split("T")[0],
        issueDetails,
        actionPlan,
        issueStatus,
        assignees: taskAssignees,
        dueDate: dueDate?.toISOString().split("T")[0] || "",
        subtasks: subtasks.filter(s => s.title.trim()),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Issue Tracker — {deal.deal_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {nonGreenDims.map(d => (
              <Badge key={d.key} variant="outline" className={cn(
                "text-xs",
                d.value === "R" ? "bg-red-500/15 text-red-700 border-red-500/30" : "bg-amber-500/15 text-amber-700 border-amber-500/30"
              )}>
                {d.label}: {d.value === "R" ? "Red" : "Yellow"}
              </Badge>
            ))}
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
                  <SelectItem value="Resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Issue Details</label>
            <Textarea value={issueDetails} onChange={e => setIssueDetails(e.target.value)} placeholder="Describe the issue..." className="text-sm min-h-[60px]" />
          </div>


          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Action Plan</label>
            <Textarea value={actionPlan} onChange={e => setActionPlan(e.target.value)} placeholder="Final action plan..." className="text-sm min-h-[60px]" />
          </div>

          {/* Assignees */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Assignees</label>
            <div className="flex flex-wrap gap-1.5">
              {allAssigneeNames.map(name => {
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
              {allAssigneeNames.length === 0 && (
                <span className="text-[11px] text-muted-foreground italic">No team members available</span>
              )}
            </div>
          </div>

          {/* Due Date */}
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

          {/* Subtasks */}
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
                    placeholder="Subtask title..."
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

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Issue & Create Tasks
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}, (prev, next) => {
  // Only re-render when the dialog's identity actually changes.
  // Parent re-renders (realtime, filters) would otherwise cascade into
  // this heavy form and make typing feel laggy.
  if (prev.deal.id !== next.deal.id) return false;
  if (prev.deal.deal_name !== next.deal.deal_name) return false;
  if (prev.nonGreenDims.length !== next.nonGreenDims.length) return false;
  for (let i = 0; i < prev.nonGreenDims.length; i++) {
    if (prev.nonGreenDims[i].key !== next.nonGreenDims[i].key) return false;
    if (prev.nonGreenDims[i].value !== next.nonGreenDims[i].value) return false;
  }
  return true;
});

// ── Main Component ──
export default function RGYHealth() {
  const { users: appUsers, isRegisteredName } = useAppUsers();
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const { vsdUsers, isVsdName, canonVsd } = useVsdUsers();
  const { vsdForDeal, bopmsForVsd, allBopms } = useVsdHierarchy();
  const { role } = useUserRole();
  const { canEdit: canEditRgy } = useCanEditRgy();
  const [assignmentAssigneeNames, setAssignmentAssigneeNames] = useState<string[]>([]);
  const { visibleDealIds, loading: accessLoading, isAdmin: hasAllDealAccess } = useDealAccess();
  const isBopmPersona = role === "user" || role === "capability_member";
  const isVsdPersona = role === "member";
  const isAdminPersona = role === "admin";
  // Resolve the logged-in person's VSD name (only when they ARE a VSD).
  const { user: authUser } = useAuth();
  const [myVsdName, setMyVsdName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authUser || !isVsdPersona) { setMyVsdName(null); return; }
      const { data: profile } = await supabase
        .from("profiles").select("staffing_person_id").eq("user_id", authUser.id).maybeSingle();
      const personId = (profile as any)?.staffing_person_id;
      if (!personId) { if (!cancelled) setMyVsdName(null); return; }
      const { data: person } = await supabase
        .from("staffing_people").select("name, role_title, designation").eq("id", personId).maybeSingle();
      const p: any = person;
      if (!p) { if (!cancelled) setMyVsdName(null); return; }
      const looksLikeVsd = /\bvsd\b|vertical service delivery|service delivery (leader|director)/i
        .test(`${p.role_title || ""} ${p.designation || ""}`);
      const canon = canonVsd(p.name);
      if (!cancelled) setMyVsdName(looksLikeVsd && canon ? canon : canon);
    })();
    return () => { cancelled = true; };
  }, [authUser, isVsdPersona, canonVsd]);
  // Built dynamically from registered users + which VSDs actually appear on deals.
  const VSD_FILTERS = useMemo(() => {
    const items: { key: string; label: string }[] = [{ key: "All", label: "All" }];
    vsdUsers.forEach((u) => items.push({ key: u.displayName, label: u.displayName }));
    items.push({ key: "Unassigned", label: "Unassigned" });
    return items;
  }, [vsdUsers]);
  const isOtherVsd = useCallback(
    (vsdRaw: string | null | undefined) => {
      const v = (vsdRaw || "").trim();
      if (!v) return false;
      if (UNASSIGNED_VSD_VALUES.has(v)) return false;
      return !isVsdName(v);
    },
    [isVsdName],
  );
  const [deals, setDeals] = useState<DealWithRGY[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [activeVsd, setActiveVsd] = useState<VsdFilterKey>("All");
  const [raiseInterventionOpen, setRaiseInterventionOpen] = useState(false);
  const [activeBopm, setActiveBopm] = useState<string>("All");
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState("");
  const [rgyFilter, setRgyFilter] = useState<"All" | "Red" | "Yellow" | "Green" | "Pending">("All");
  const [segmentFilter, setSegmentFilter] = useState<string>("All");
  const [dealTypeFilter, setDealTypeFilter] = useState<"All" | "Retainer" | "Non-Retainer">("All");

  // Metadata column ordering (drag-to-reorder for left-side columns only)
  const DEFAULT_META_ORDER = ["account", "deal_name", "deal_id", "deal_status"] as const;
  const [metaOrder, setMetaOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("rgy-meta-order");
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        const valid = parsed.filter(k => (DEFAULT_META_ORDER as readonly string[]).includes(k));
        if (valid.length === DEFAULT_META_ORDER.length) return valid;
      }
    } catch {}
    return [...DEFAULT_META_ORDER];
  });
  useEffect(() => {
    try { localStorage.setItem("rgy-meta-order", JSON.stringify(metaOrder)); } catch {}
  }, [metaOrder]);
  const metaDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleMetaDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setMetaOrder(prev => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  }, []);
  const [activeTab, setActiveTab] = useState<"health" | "table" | "insights">("table");
  useEffect(() => {
    if (isVsdPersona && myVsdName && activeVsd !== myVsdName) setActiveVsd(myVsdName);
  }, [isVsdPersona, myVsdName, activeVsd]);
  // Reset BOPM whenever VSD changes
  useEffect(() => { setActiveBopm("All"); }, [activeVsd]);
  const bopmOptions = useMemo(() => {
    if (activeVsd === "All" || activeVsd === "Unassigned") return allBopms;
    return bopmsForVsd(activeVsd);
  }, [activeVsd, bopmsForVsd, allBopms]);
  const nameMatchesBopm = (a: string | null | undefined, b: string) => {
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
    return norm(a || "") === norm(b);
  };
  // Drill-down for RGY Summary numeric cells
  type RGYDrillMetric = "total" | "red" | "yellow" | "green" | "pending" | "pendingActive";
  const [rgyDrill, setRgyDrill] = useState<{ rowLabel: string; metric: RGYDrillMetric } | null>(null);
  // KPI strip drill (Red / Yellow / Green / Score)
  const [kpiDrill, setKpiDrill] = useState<null | "score" | "marked">(null);
  // Column filter/sort state
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const setFilter = (k: string, v: string) => setColFilters(p => ({ ...p, [k]: v }));
  const clearFilter = (k: string) => setColFilters(p => { const n = { ...p }; delete n[k]; return n; });
  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  // Column widths (resizable)
  const DEFAULT_WIDTHS: Record<string, number> = {
    account: 160, deal_name: 200, deal_id: 110, deal_status: 110, overall_rgy: 120,
    customer: 100, internal: 100, content: 100, seo: 90, supply: 100, copy: 90, design: 100, video: 100,
    updated_at: 140, updated_by: 140,
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem("rgy-col-widths");
      if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_WIDTHS;
  });
  useEffect(() => {
    try { localStorage.setItem("rgy-col-widths", JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);

  // Column visibility (Client + Deal Name + Status + Overall Customer + Internal are defaults / required)
  const ALL_COLS = useMemo(() => ([
    { key: "account", label: "Client", required: true },
    { key: "deal_name", label: "Deal Name", required: true },
    { key: "deal_id", label: "Deal ID" },
    { key: "deal_status", label: "Status", required: true },
    { key: "overall_rgy", label: "Overall RGY", required: true },
    { key: "customer", label: "Overall Customer", required: true },
    { key: "internal", label: "Internal", required: true },
    { key: "content", label: "Content" },
    { key: "seo", label: "SEO" },
    { key: "supply", label: "Supply" },
    { key: "copy", label: "Copy" },
    { key: "design", label: "Design" },
    { key: "video", label: "Video" },
    ...(isAdminPersona ? [
      { key: "updated_at", label: "Last Updated At" },
      { key: "updated_by", label: "Last Updated By" },
    ] : []),
  ]), [isAdminPersona]);
  // Show every column by default. Admin personas additionally see audit columns.
  const DEFAULT_VISIBLE = isAdminPersona
    ? ["account","deal_name","deal_id","deal_status","overall_rgy","customer","internal","content","seo","supply","copy","design","video","updated_at","updated_by"]
    : ["account","deal_name","deal_id","deal_status","overall_rgy","customer","internal","content","seo","supply","copy","design","video"];
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("rgy-visible-cols-v2");
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_VISIBLE;
  });
  useEffect(() => {
    try { localStorage.setItem("rgy-visible-cols-v2", JSON.stringify(visibleCols)); } catch {}
  }, [visibleCols]);
  const REQUIRED_COL_KEYS = useMemo(() => ALL_COLS.filter(c => c.required).map(c => c.key), [ALL_COLS]);
  const isColVisible = (k: string) => visibleCols.includes(k) || REQUIRED_COL_KEYS.includes(k);
  const toggleCol = (k: string, required?: boolean) => {
    if (required) return;
    setVisibleCols(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k]);
  };
  const resizingRef = useRef<{ key: string; startX: number; startW: number; latest: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  // Smooth column resize: throttle setState via requestAnimationFrame so we
  // re-render at most once per frame instead of per mousemove event.
  const startResize = useCallback((key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = colWidths[key] || 120;
    resizingRef.current = { key, startX: e.clientX, startW, latest: startW };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      r.latest = Math.max(60, Math.min(500, r.startW + (ev.clientX - r.startX)));
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const cur = resizingRef.current;
          if (!cur) return;
          setColWidths(prev => (prev[cur.key] === cur.latest ? prev : { ...prev, [cur.key]: cur.latest }));
        });
      }
    };
    const onUp = () => {
      resizingRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]);

  // Issue form state
  const [issueFormDeal, setIssueFormDeal] = useState<DealWithRGY | null>(null);
  const [issueFormNonGreen, setIssueFormNonGreen] = useState<{ key: string; label: string; value: string }[]>([]);
  const [prevRGYSnapshot, setPrevRGYSnapshot] = useState<{ dealId: string; values: Record<string, string> } | null>(null);

  // Mark RGY (per-row, replaces inline cell editing)
  const [markRGYDeal, setMarkRGYDeal] = useState<DealWithRGY | null>(null);
  const [markRGYSaving, setMarkRGYSaving] = useState(false);
  // After Mark RGY save: if any dim is Red, open the combined-issues dialog
  const [combinedIssuesDeal, setCombinedIssuesDeal] = useState<DealWithRGY | null>(null);
  // Expanded issue rows in the Table tab
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const toggleIssueExpanded = (id: string) => setExpandedIssues(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Load every person staffed on the deal so they all appear as assignees
  useEffect(() => {
    if (!combinedIssuesDeal) { setAssignmentAssigneeNames([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("staffing_assignments")
        .select("staffing_people(name)")
        .eq("staffing_deal_id", combinedIssuesDeal.id);
      if (cancelled) return;
      const names = Array.from(new Set(((data || []) as any[])
        .map(r => r.staffing_people?.name)
        .filter(Boolean) as string[]));
      setAssignmentAssigneeNames(names);
    })();
    return () => { cancelled = true; };
  }, [combinedIssuesDeal]);

  // Green-gate state
  const [greenGate, setGreenGate] = useState<{
    dealId: string;
    dimKey: string;
    tasks: { id: string; title: string; stage: string }[];
  } | null>(null);

  // Pending Green commit waiting on the Resolve Issues dialog (R/Y → G).
  const [pendingGreen, setPendingGreen] = useState<{ dealId: string; dimKey: string; dimLabel: string; oldValue: RGYCellValue } | null>(null);
  // R → Y: an optional resolve dialog opened after the change persisted.
  const [resolveAfterDowngrade, setResolveAfterDowngrade] = useState<{ dealId: string } | null>(null);

  // Issues for insights — derived lazily, only after Insights tab is opened.
  const [insightsOpened, setInsightsOpened] = useState(false);
  useEffect(() => {
    if (activeTab === "insights") setInsightsOpened(true);
  }, [activeTab]);

  const rgyIssues = useMemo(() => {
    if (!insightsOpened) return [] as any[];
    const out: any[] = [];
    for (const d of deals) {
      const status = (d as any).rgy_issue_details ? "Open" : null;
      if (!d.rgy_issue_details) continue;
      const dimVals = DIMENSIONS.map(dim => (d as any)[dim.key] as string);
      const worst: "R" | "Y" | "G" | null = dimVals.includes("R") ? "R" : dimVals.includes("Y") ? "Y" : "G";
      const redDims = DIMENSIONS.filter(dim => (d as any)[dim.key] === "R").map(dim => dim.label);
      out.push({
        deal_id: d.id,
        deal_id_code: d.deal_id || "",
        deal_name: d.deal_name || "Unknown",
        pc_code: d.pc_code || "",
        account: d.account || "",
        pod: getPodForDeal(d.vsd || "", d.pod || ""),
        vsd: vsdForDeal(d as any) || "",
        deal_status: d.deal_status || "",
        issue_details: d.rgy_issue_details,
        issue_status: "Open",
        action_plan: d.rgy_action_plan || "",
        discussed_action_plan: d.rgy_discussed_action_plan || "",
        red_dimensions: redDims,
        worst,
        issue_date: (d as any).rgy_issue_date || null,
        created_at: (d as any).rgy_created_at || null,
      });
    }
    return out;
  }, [insightsOpened, deals, vsdForDeal]);

  const fetchData = useCallback(async () => {
    // Look back ~8 weeks for "current" RGY snapshot — small slice instead of full history.
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 56);
    const lookbackIso = lookback.toISOString().split("T")[0];

    // Fire deals + recent RGY in parallel.
    const dealsPromise = supabase
      .from("staffing_deals")
      .select("id, new_deal_id_formulated, deal_name, account, bopm, deal_status, pod, mrr, total_deal_value, vsd, principal_bopm, senior_bopm, start_date, end_date, payment_terms, pc_code, deal_type, customer_type, created_at")
      .order("deal_name");

    const rgyPromise = supabase
      .from("deal_rgy_weekly")
      .select("id, deal_id, customer, internal, content, seo, supply, copy, design, video, week_start, issue_details, issue_status, action_plan, discussed_action_plan, issue_date, created_at, updated_at, updated_by_name")
      .gte("week_start", lookbackIso)
      .order("week_start", { ascending: false });

    const { data: dealRows } = await dealsPromise;
    if (!dealRows) { setLoading(false); return; }

    // Render deals immediately so the page paints fast; RGY values fill in next.
    const baseRows: DealWithRGY[] = dealRows.map(d => ({
      ...d,
      deal_id: (d as any).new_deal_id_formulated || "",
      pc_code: d.pc_code || "",
      deal_created_at: (d as any).created_at || null,
      customer: "", internal: "", content: "", seo: "",
      supply: "", copy: "", design: "", video: "",
    }));
    setDeals(baseRows);
    setLoading(false);

    const { data: rgyRows } = await rgyPromise;
    const rgyMap = new Map<string, any>();
    if (rgyRows) {
      for (const r of rgyRows) {
        if (!rgyMap.has(r.deal_id)) rgyMap.set(r.deal_id, r);
      }
    }

    setDeals(prev => prev.map(d => {
      const rgy = rgyMap.get(d.id);
      if (!rgy) return d;
      return {
        ...d,
        rgy_row_id: rgy.id,
        rgy_week_start: rgy.week_start,
        rgy_action_plan: rgy.action_plan || "",
        rgy_discussed_action_plan: rgy.discussed_action_plan || "",
        rgy_issue_details: rgy.issue_details || "",
        rgy_issue_date: rgy.issue_date || null,
        rgy_created_at: rgy.created_at || null,
        rgy_updated_at: rgy.updated_at || null,
        rgy_updated_by_name: rgy.updated_by_name || "",
        customer: rgy.customer ?? "",
        internal: rgy.internal ?? "",
        content: rgy.content ?? "",
        seo: rgy.seo ?? "",
        supply: rgy.supply ?? "",
        copy: rgy.copy ?? "",
        design: rgy.design ?? "",
        video: rgy.video ?? "",
      };
    }));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRGYUpdate = useCallback(async (dealId: string, dimKey: string, newValue: RGYCellValue) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const oldValue = (deal[dimKey as keyof DealWithRGY] as string) || "NA";

    // Validation: Overall Customer R/Y requires Internal = R.
    // Hard-block the save when changing customer or internal would violate this.
    if (dimKey === "customer" || dimKey === "internal") {
      const customerVal = dimKey === "customer" ? newValue : (deal.customer || "");
      const internalVal = dimKey === "internal" ? newValue : (deal.internal || "");
      const customerBad = customerVal === "R" || customerVal === "Y";
      const internalBad = internalVal === "G" || internalVal === "Y";
      if (customerBad && internalBad) {
        toast.error("Internal must be R when Overall Customer is R or Y. Update Internal first.");
        return;
      }
    }

    // R/Y → G: always prompt the user to resolve open work tied to this
    // dimension before persisting Green. We look at:
    //   • [RGY Health] tasks whose title contains this dimension label
    //   • any open weekly RGY issue on this deal
    // If neither exists, we proceed silently to Green.
    if (newValue === "G" && (oldValue === "R" || oldValue === "Y")) {
      const dimLabel = DIMENSIONS.find(d => d.key === dimKey)?.label || dimKey;
      const [{ data: openTasks }, { data: openIssues }] = await Promise.all([
        supabase
          .from("deal_tasks")
          .select("id, title, stage")
          .eq("deal_id", dealId)
          .like("title", "[RGY Health]%")
          .neq("stage", "Done"),
        supabase
          .from("deal_rgy_weekly")
          .select("id")
          .eq("deal_id", dealId)
          .in("issue_status", ["Open", "In Progress"])
          .limit(1),
      ]);
      const hasDimTask = (openTasks || []).some((t: any) => String(t.title || "").includes(dimLabel));
      const hasOpenIssue = (openIssues || []).length > 0;
      if (hasDimTask || hasOpenIssue) {
        setPendingGreen({ dealId, dimKey, dimLabel, oldValue: oldValue as RGYCellValue });
        return;
      }
      // No open dimension tasks or issues — proceed to persist Green.
    }

    await applyRGYUpdate(dealId, dimKey, newValue, deal);

    // R → Y: persist done above, then open optional resolve dialog.
    if (oldValue === "R" && newValue === "Y") {
      setResolveAfterDowngrade({ dealId });
    }
  }, [deals]);

  const applyRGYUpdate = useCallback(async (dealId: string, dimKey: string, newValue: RGYCellValue, deal: DealWithRGY) => {
    // "PENDING" is stored as empty string in the DB
    const persistValue = newValue === "PENDING" ? "" : newValue;
    // Save snapshot before change for potential revert
    const oldValues: Record<string, string> = {};
    DIMENSIONS.forEach(dim => {
      oldValues[dim.key] = deal[dim.key as keyof DealWithRGY] as string || "NA";
    });

    // Optimistically update local state
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, [dimKey]: persistValue } : d));

    const weekStart = getCurrentWeekStart();

    const updatedDeal = { ...deal, [dimKey]: persistValue };
    const rgyPayload: Record<string, string> = {};
    DIMENSIONS.forEach(dim => {
      rgyPayload[dim.key] = (updatedDeal[dim.key as keyof DealWithRGY] as string) ?? "";
    });

    // Resolve current user for audit fields
    let updatedById: string | null = null;
    let updatedByName = "";
    try {
      const { data: u } = await supabase.auth.getUser();
      updatedById = u?.user?.id || null;
      if (updatedById) {
        const { data: prof } = await supabase
          .from("profiles").select("display_name").eq("user_id", updatedById).maybeSingle();
        updatedByName = (prof as any)?.display_name || u?.user?.email || "";
      }
    } catch {}
    const nowIso = new Date().toISOString();

    if (deal.rgy_row_id && deal.rgy_week_start === weekStart) {
      await supabase.from("deal_rgy_weekly").update({
        [dimKey]: persistValue,
        updated_at: nowIso,
        updated_by: updatedById,
        updated_by_name: updatedByName,
      } as any).eq("id", deal.rgy_row_id);
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, rgy_updated_at: nowIso, rgy_updated_by_name: updatedByName } : d));
    } else {
      const { data: inserted } = await supabase.from("deal_rgy_weekly").insert({
        deal_id: dealId,
        week_start: weekStart,
        ...rgyPayload,
        account_health: rgyPayload.customer || "",
        finance_billing: "",
        capability_seo: rgyPayload.seo || "",
        capability_creative: "",
        updated_by: updatedById,
        updated_by_name: updatedByName,
      } as any).select("id").single();

      if (inserted) {
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, rgy_row_id: inserted.id, rgy_week_start: weekStart, rgy_updated_at: nowIso, rgy_updated_by_name: updatedByName } : d));
      }
    }

    // Audit log: who changed which dimension and from what to what
    const oldValueForDim = oldValues[dimKey] || "";
    if (oldValueForDim !== persistValue) {
      logRGYChange({
        dealId,
        dimension: dimKey,
        fromValue: oldValueForDim,
        toValue: persistValue,
        weekStart,
      });
    }

    // If new value is R or Y, show issue form
    if (newValue === "R" || newValue === "Y") {
      // New flow: do NOT auto-open the issue form on every cell change.
      // The user logs one combined issue from the deal's RGY tab via the
      // status bar there. This keeps the table click as a pure auto-save.
    }
  }, []);

  // R/Y → G: confirm path from Resolve Issues dialog.
  const handleGreenConfirm = useCallback(async () => {
    if (!pendingGreen) return;
    const deal = deals.find(d => d.id === pendingGreen.dealId);
    if (deal) {
      await applyRGYUpdate(pendingGreen.dealId, pendingGreen.dimKey, "G", deal);
    }
    setPendingGreen(null);
  }, [pendingGreen, deals]);

  // R/Y → G: cancel path — revert nothing because we never persisted.
  // The cell renders from `deals` state; no change required.
  const handleGreenCancel = useCallback(() => {
    setPendingGreen(null);
    toast.info("Green change reverted — open issues remain");
  }, []);

  const handleIssueCancel = useCallback(() => {
    if (prevRGYSnapshot) {
      setDeals(prev => prev.map(d => {
        if (d.id === prevRGYSnapshot.dealId) return { ...d, ...prevRGYSnapshot.values };
        return d;
      }));
      const deal = deals.find(d => d.id === prevRGYSnapshot.dealId);
      if (deal?.rgy_row_id) {
        supabase.from("deal_rgy_weekly").update(prevRGYSnapshot.values as any).eq("id", deal.rgy_row_id);
      }
      toast.info("RGY changes reverted");
    }
    setIssueFormDeal(null);
    setIssueFormNonGreen([]);
    setPrevRGYSnapshot(null);
  }, [prevRGYSnapshot, deals]);

  const handleIssueSave = useCallback(async (issueData: {
    issueDate: string;
    issueDetails: string;
    actionPlan: string;
    issueStatus: string;
    assignees: string[];
    dueDate: string;
    subtasks: { title: string }[];
  }) => {
    if (!issueFormDeal) return;

    const deal = deals.find(d => d.id === issueFormDeal.id);
    if (deal?.rgy_row_id) {
      await supabase.from("deal_rgy_weekly").update({
        issue_date: issueData.issueDate,
        issue_details: issueData.issueDetails,
        action_plan: issueData.actionPlan,
        resolution_due_date: issueData.dueDate || null,
        issue_status: issueData.issueStatus,
      }).eq("id", deal.rgy_row_id);
    }

    if (issueData.assignees.length > 0 || issueData.actionPlan.trim() || issueData.subtasks.length > 0) {
      await (supabase.from("deal_tasks") as any).insert({
        deal_id: issueFormDeal.id,
        title: `[RGY Health] ${(issueData.actionPlan || issueData.issueDetails).trim().slice(0, 120)}`,
        description: `Issue Details: ${issueData.issueDetails}\nAction Plan: ${issueData.actionPlan}`,
        stage: "To Do",
        assignee: issueData.assignees[0] || "",
        assignees: issueData.assignees,
        urgency: "Medium",
        logged_hours: 0,
        sort_order: 0,
        start_date: issueData.issueDate,
        end_date: issueData.dueDate || null,
        subtasks: issueData.subtasks.map((s, i) => ({
          id: `${Date.now()}-${i}`,
          title: s.title,
          completed: false,
        })),
      });
    }

    setIssueFormDeal(null);
    setIssueFormNonGreen([]);
    setPrevRGYSnapshot(null);
    toast.success("Issue saved & task created");
  }, [issueFormDeal, deals]);

  // ── Mark RGY (per-row): single upsert for the current week, then prompt
  // for a combined issue if any dimension ended up Red.
  const handleMarkRGYSave = useCallback(async (next: MarkRGYDimension[]) => {
    if (!markRGYDeal) return;
    setMarkRGYSaving(true);
    try {
      const deal = markRGYDeal;
      const weekStart = getCurrentWeekStart();

      const payload: Record<string, string> = {};
      next.forEach(d => { payload[d.key] = d.value || ""; });

      // Snapshot the previous dim values so we can revert if the user
      // cancels the mandatory issue dialog for any new R/Y.
      const prevValues: Record<string, string> = {};
      next.forEach(d => { prevValues[d.key] = (deal[d.key as keyof DealWithRGY] as string) || ""; });

      // Resolve current user for audit fields
      let updatedById: string | null = null;
      let updatedByName = "";
      try {
        const { data: u } = await supabase.auth.getUser();
        updatedById = u?.user?.id || null;
        if (updatedById) {
          const { data: prof } = await supabase
            .from("profiles").select("display_name").eq("user_id", updatedById).maybeSingle();
          updatedByName = (prof as any)?.display_name || u?.user?.email || "";
        }
      } catch {}
      const nowIso = new Date().toISOString();

      let rowId = deal.rgy_row_id;
      if (rowId && deal.rgy_week_start === weekStart) {
        await supabase.from("deal_rgy_weekly").update({
          ...payload,
          updated_at: nowIso,
          updated_by: updatedById,
          updated_by_name: updatedByName,
        } as any).eq("id", rowId);
      } else {
        const { data: inserted } = await supabase.from("deal_rgy_weekly").insert({
          deal_id: deal.id,
          week_start: weekStart,
          ...payload,
          account_health: payload.customer || "",
          finance_billing: "",
          capability_seo: payload.seo || "",
          capability_creative: "",
          updated_by: updatedById,
          updated_by_name: updatedByName,
        } as any).select("id").single();
        rowId = inserted?.id;
      }

      // Audit log changed dims
      for (const dim of next) {
        const prev = (deal[dim.key as keyof DealWithRGY] as string) || "";
        if (prev !== (dim.value || "")) {
          logRGYChange({
            dealId: deal.id,
            dimension: dim.key,
            fromValue: prev,
            toValue: dim.value || "",
            weekStart,
          });
        }
      }

      // Update local state with new values + row metadata
      const patch: Partial<DealWithRGY> = {
        rgy_row_id: rowId,
        rgy_week_start: weekStart,
        rgy_updated_at: nowIso,
        rgy_updated_by_name: updatedByName,
      };
      for (const dim of next) (patch as any)[dim.key] = dim.value || "";
      setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, ...patch } as DealWithRGY : d));

      const updatedDeal: DealWithRGY = { ...deal, ...patch } as DealWithRGY;
      // Only require an issue when a dim NEWLY moved into R/Y this save.
      const newRedOrYellow = next.some(d =>
        (d.value === "R" || d.value === "Y") && prevValues[d.key] !== d.value
      );
      setMarkRGYDeal(null);
      // Email leadership when any dimension newly degrades to Red or Yellow.
      // Per-change RGY alert emails removed — the weekly BOPM RGY digest handles this.
      if (newRedOrYellow) {
        toast.success("RGY saved — log the issue & action plan");
        setPrevRGYSnapshot({ dealId: deal.id, values: prevValues });
        setCombinedIssuesDeal(updatedDeal);
      } else {
        toast.success("RGY saved");
      }
    } finally {
      setMarkRGYSaving(false);
    }
  }, [markRGYDeal]);

  // Filtering
  const filteredDeals = useMemo(() => {
    let d = deals;
    // Non-admin personas: scope to the current user's permitted deals before any other filter applies.
    if (!hasAllDealAccess && !accessLoading) {
      d = d.filter(deal => visibleDealIds.has(deal.id));
    }
    if (!showClosed) d = d.filter(deal => ACTIVE_STATUSES.has(deal.deal_status));
    if (activeVsd === "Unassigned") {
      d = d.filter(deal => vsdForDeal(deal as any) === null);
    } else if (activeVsd !== "All") {
      d = d.filter(deal => vsdForDeal(deal as any) === activeVsd);
    }
    if (activeBopm !== "All") {
      d = d.filter(deal => {
        const candidates = [(deal as any).principal_bopm, (deal as any).senior_bopm, (deal as any).principalBopm, (deal as any).seniorBopm];
        return candidates.some(c => c && nameMatchesBopm(c, activeBopm));
      });
    }
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(deal => deal.account.toLowerCase().includes(s) || deal.deal_name.toLowerCase().includes(s) || deal.deal_id.toLowerCase().includes(s));
    }
    // RGY status filter
    if (rgyFilter !== "All" || segmentFilter !== "All") {
      const code: "" | "R" | "Y" | "G" | null =
        rgyFilter === "Red" ? "R" :
        rgyFilter === "Yellow" ? "Y" :
        rgyFilter === "Green" ? "G" :
        rgyFilter === "Pending" ? "" :
        null; // "All"
      d = d.filter(deal => {
        if (segmentFilter !== "All") {
          const raw = ((deal as any)[segmentFilter] as string) || "";
          if (code === null) return raw !== ""; // any non-pending for that segment
          if (code === "") return raw === ""; // Pending for that segment
          return raw === code;
        }
        const w = getWorstRGY(deal);
        if (rgyFilter === "Red") return w === "R";
        if (rgyFilter === "Yellow") return w === "Y";
        if (rgyFilter === "Green") return w === "G";
        if (rgyFilter === "Pending") return w === null;
        return true;
      });
    }
    if (dealTypeFilter !== "All") {
      d = d.filter(deal => {
        const isRet = isRetainerDeal({ dealType: deal.deal_type || "", customerType: deal.customer_type || "" });
        return dealTypeFilter === "Retainer" ? isRet : !isRet;
      });
    }
    return d;
  }, [deals, activeVsd, activeBopm, search, showClosed, rgyFilter, segmentFilter, dealTypeFilter, vsdForDeal, hasAllDealAccess, accessLoading, visibleDealIds]);

  const aiSummaryDeals = useMemo(() => {
    if (hasAllDealAccess && !isVsdPersona && !isBopmPersona) return deals;
    if (isVsdPersona && myVsdName) return deals.filter((deal) => vsdForDeal(deal as any) === myVsdName);
    if (!accessLoading) return deals.filter((deal) => visibleDealIds.has(deal.id));
    return [];
  }, [deals, hasAllDealAccess, isVsdPersona, isBopmPersona, myVsdName, vsdForDeal, accessLoading, visibleDealIds]);

  // For BOPM persona, default landing is Insights (scoped to her deals);
  // Health Board remains admin-only.
  useEffect(() => {
    if (isBopmPersona && activeTab === "health") {
      setActiveTab("insights");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBopmPersona]);

  // Apply per-column filters + sort to produce flat row list
  const tableRows = useMemo(() => {
    const matches = (val: any, q: string) => String(val ?? "").toLowerCase().includes(q.toLowerCase());
    let rows = filteredDeals.filter(d => {
      if (colFilters.account && !matches(d.account, colFilters.account)) return false;
      if (colFilters.deal_name && !matches(d.deal_name, colFilters.deal_name)) return false;
      if (colFilters.deal_id && !matches(d.deal_id, colFilters.deal_id)) return false;
      if (colFilters.deal_status && (d.deal_status || "") !== colFilters.deal_status) return false;
      if (colFilters.updated_by && !matches(d.rgy_updated_by_name, colFilters.updated_by)) return false;
      if (colFilters.updated_at) {
        const formatted = d.rgy_updated_at ? format(new Date(d.rgy_updated_at), "dd MMM yyyy, HH:mm") : "";
        if (!matches(formatted, colFilters.updated_at)) return false;
      }
      if (colFilters.overall_rgy) {
        const f = colFilters.overall_rgy;
        const code = RGY_FILTER_LABEL_TO_CODE[f] ?? f;
        const band = getWorstRGY(d);
        if (code === "Pending") {
          if (band !== null) return false;
        } else if (band !== code) {
          return false;
        }
      }
      for (const dim of DIMENSIONS) {
        const f = colFilters[dim.key];
        if (f) {
          const code = RGY_FILTER_LABEL_TO_CODE[f] ?? f;
          const raw = ((d as any)[dim.key] as string) || "";
          if (code === "Pending") {
            if (raw !== "") return false;
          } else {
            if (raw !== code) return false;
          }
        }
      }
      return true;
    });
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      const dimKeys = new Set(DIMENSIONS.map(d => d.key));
      // R=0, Y=1, G=2, NA=3, Pending/blank=4 → asc puts worst first
      const rgyRank = (v: string | null | undefined) => {
        const s = (v ?? "").toString();
        if (s === "R") return 0;
        if (s === "Y") return 1;
        if (s === "G") return 2;
        if (s === "NA") return 3;
        return 4;
      };
      rows = [...rows].sort((a: any, b: any) => {
        if (sortKey === "overall_rgy") {
          const dims: Record<string, string | null | undefined> = {};
          const dimsB: Record<string, string | null | undefined> = {};
          for (const d of DIMENSIONS) { dims[d.key] = a[d.key]; dimsB[d.key] = b[d.key]; }
          const sa = computeOverallCustomerScore(dims);
          const sb = computeOverallCustomerScore(dimsB);
          const na = sa ?? Number.POSITIVE_INFINITY;
          const nb = sb ?? Number.POSITIVE_INFINITY;
          return (na - nb) * dir;
        }
        if (dimKeys.has(sortKey)) {
          return (rgyRank(a[sortKey]) - rgyRank(b[sortKey])) * dir;
        }
        const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
        if (typeof av === "number" || typeof bv === "number") return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    } else {
      rows = [...rows].sort((a, b) => a.account.localeCompare(b.account) || a.deal_name.localeCompare(b.deal_name));
    }
    return rows;
  }, [filteredDeals, colFilters, sortKey, sortDir]);

  // KPIs
  const kpis = useMemo(() => {
    // Count DEALS by their worst RGY (matches table row tinting & summary buckets)
    let red = 0, yellow = 0, green = 0, pending = 0;
    for (const d of filteredDeals) {
      const w = getWorstRGY(d);
      if (w === "R") red++;
      else if (w === "Y") yellow++;
      else if (w === "G") green++;
      else pending++;
    }
    const scored = red + yellow + green;
    const score = scored > 0 ? ((green * 100 + yellow * 50) / scored).toFixed(1) : "—";
    return { red, yellow, green, pending, score, totalDeals: filteredDeals.length };
  }, [filteredDeals]);

  // ── RGY Summary Insights ──
  // "All" → group by VSD. Specific VSD → group by Sr/Principal BOPM in that pod (with Pod Overall row).
  type RGYSummaryRow = { name: string; total: number; red: number; yellow: number; green: number; pending: number; pendingActive: number };
  const showBopmRgyInsights = activeVsd !== "All" && activeVsd !== "Unassigned";

  const rgySummary = useMemo<RGYSummaryRow[]>(() => {
    const tally = (row: RGYSummaryRow, deal: DealWithRGY) => {
      row.total++;
      const w = getWorstRGY(deal);
      if (w === "R") row.red++;
      else if (w === "Y") row.yellow++;
      else if (w === "G") row.green++;
      else row.pending++;
      if (w === null && (deal.deal_status || "").trim() === "Active Deal") row.pendingActive++;
    };

    if (showBopmRgyInsights) {
      const map = new Map<string, RGYSummaryRow>();
      const overall: RGYSummaryRow = { name: "Pod Overall", total: 0, red: 0, yellow: 0, green: 0, pending: 0, pendingActive: 0 };
      for (const deal of filteredDeals) {
        const raw = (deal.principal_bopm || deal.senior_bopm || "").trim();
        const lower = raw.toLowerCase();
        const isPlaceholder =
          !raw ||
          lower === "to be assigned" ||
          lower === "tbd" ||
          lower === "tba" ||
          lower === "unassigned" ||
          lower === "not assigned";
        const bucket = isPlaceholder ? "Unassigned" : raw;
        if (!map.has(bucket)) map.set(bucket, { name: bucket, total: 0, red: 0, yellow: 0, green: 0, pending: 0, pendingActive: 0 });
        tally(map.get(bucket)!, deal);
        tally(overall, deal);
      }
      const rows = Array.from(map.values()).filter(r => r.total > 0).sort((a, b) => b.red - a.red || b.total - a.total);
      return overall.total > 0 ? [overall, ...rows] : rows;
    }

    // VSD grouping
    const map = new Map<string, RGYSummaryRow>();
    for (const deal of filteredDeals) {
      const v = vsdForDeal(deal as any);
      const bucket = v || "Unassigned";
      if (!map.has(bucket)) map.set(bucket, { name: bucket, total: 0, red: 0, yellow: 0, green: 0, pending: 0, pendingActive: 0 });
      tally(map.get(bucket)!, deal);
    }
    return Array.from(map.values()).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  }, [filteredDeals, showBopmRgyInsights, vsdForDeal]);

  const selectedDeal = useMemo(
    () => deals.find(d => d.id === selectedDealId) ?? null,
    [deals, selectedDealId]
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="p-5 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <ReadOnlyBanner routeKey="rgy-health" label="RGY Health" />
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">RGY Health Tracker</h1>
            <p className="text-ui text-muted-foreground mt-0.5">
              {kpis.totalDeals} deals • {kpis.red + kpis.yellow + kpis.green} marked • {kpis.pending} pending • Click any RGY cell to update
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRaiseInterventionOpen(true)}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1 text-warning" />
            Flag Leadership Intervention
          </Button>
        </div>

        {/* KPI Strip — clicking a tile filters the table below */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
          {([
            { f: "All", label: "All", value: kpis.totalDeals, tone: "primary" as const, icon: Activity, ring: "ring-primary" },
            { f: "Red", label: "Red", value: kpis.red, tone: "destructive" as const, icon: AlertTriangle, ring: "ring-destructive" },
            { f: "Yellow", label: "Yellow", value: kpis.yellow, tone: "warning" as const, icon: AlertCircle, ring: "ring-warning" },
            { f: "Green", label: "Green", value: kpis.green, tone: "positive" as const, icon: CheckCircle2, ring: "ring-positive" },
            { f: "Pending", label: "Pending", value: kpis.pending, tone: "muted" as const, icon: Circle, ring: "ring-muted-foreground" },
          ] as const).map(t => (
            <KpiTile
              key={t.f}
              label={t.label}
              value={String(t.value)}
              tone={t.tone}
              icon={t.icon}
              className={cn(rgyFilter === t.f && `ring-2 ${t.ring}`)}
              onClick={() => {
                setRgyFilter(t.f);
                setActiveTab("table");
              }}
            />
          ))}
          <KpiTile label="Score" value={String(kpis.score)} suffix="/ 100" tone="primary" icon={Activity} onClick={() => setKpiDrill("score")} />
        </div>

        {/* Tabs: Health Board / Table / Insights */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <TabsList>
              {!isBopmPersona && <TabsTrigger value="health">Health Board</TabsTrigger>}
              {isBopmPersona && <TabsTrigger value="insights">Insights</TabsTrigger>}
              <TabsTrigger value="table">Table</TabsTrigger>
              {!isBopmPersona && <TabsTrigger value="insights">Insights</TabsTrigger>}
            </TabsList>
            {activeTab === "table" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" /> Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-1">Show columns</p>
                  <div className="space-y-0.5 max-h-80 overflow-y-auto">
                    {ALL_COLS.map(c => (
                      <label
                        key={c.key}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded text-xs",
                          c.required ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-secondary"
                        )}
                      >
                        <Checkbox
                          checked={isColVisible(c.key) || !!c.required}
                          disabled={c.required}
                          onCheckedChange={() => toggleCol(c.key, c.required)}
                        />
                        <span className="flex-1">{c.label}</span>
                        {c.required && <span className="text-[9px] text-muted-foreground">locked</span>}
                      </label>
                    ))}
                  </div>
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={() => setVisibleCols(DEFAULT_VISIBLE)}
                      className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-secondary text-muted-foreground"
                    >
                      Reset to defaults
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {isBopmPersona && !accessLoading && filteredDeals.length === 0 && (
            <div className="mb-3"><BopmEmptyState section="RGY Health" /></div>
          )}

          <TabsContent value="health" className="mt-0">
            {/* VSD filter only */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">VSD:</span>
              <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
                {VSD_FILTERS.map(v => (
                  <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                    activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}>{v.label}</button>
                ))}
              </div>
            </div>

            {/* RGY Summary — VSDs (All) or BOPMs within selected pod */}
            <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">
            {showBopmRgyInsights ? `BOPM RGY Summary — ${activeVsd}` : "VSD RGY Summary"}
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-ui">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  {[showBopmRgyInsights ? "Sr / Principal BOPM" : "VSD", "Active Deals", "🔴 Red", "🟡 Yellow", "🟢 Green", "Pending", "Pending (Active)"].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rgySummary.map(r => {
                  const isOverall = r.name === "Pod Overall";
                  const openDrill = (metric: RGYDrillMetric) => setRgyDrill({ rowLabel: r.name, metric });
                  const NumBtn = ({ value, metric, className }: { value: number; metric: RGYDrillMetric; className?: string }) => (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (value > 0) openDrill(metric); }}
                      className={cn(
                        "font-mono tabular-nums text-xs",
                        value > 0 ? "hover:underline cursor-pointer" : "cursor-default opacity-70",
                        className,
                      )}
                    >
                      {value}
                    </button>
                  );
                  return (
                    <tr key={r.name} className={cn(
                      "border-b border-border/50 hover:bg-secondary/30 transition-colors",
                      isOverall && "bg-primary/5 font-semibold"
                    )}>
                      <td className="py-2.5 px-3 font-semibold text-foreground text-xs">{r.name}</td>
                      <td className="py-2.5 px-3"><NumBtn value={r.total} metric="total" className="text-foreground" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={r.red} metric="red" className="text-destructive font-semibold" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={r.yellow} metric="yellow" className="text-warning font-semibold" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={r.green} metric="green" className="text-positive font-semibold" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={r.pending} metric="pending" className="text-muted-foreground" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={r.pendingActive} metric="pendingActive" className="text-amber-600 dark:text-amber-400 font-semibold" /></td>
                    </tr>
                  );
                })}
                {rgySummary.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
            </div>
          </TabsContent>

          <TabsContent value="table" className="mt-0">
            {/* Table tab filters */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              {!isBopmPersona && <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">VSD:</span>
                <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
                  {VSD_FILTERS.map(v => (
                    <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                      "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                      activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}>{v.label}</button>
                  ))}
                </div>
              </div>}

              {!isBopmPersona && <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">BOPM:</span>
                {isVsdPersona ? (
                  <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5 overflow-x-auto max-w-full">
                    <button
                      onClick={() => setActiveBopm("All")}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                        activeBopm === "All" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >All BOPMs</button>
                    {bopmOptions.map((b) => (
                      <button
                        key={b}
                        onClick={() => setActiveBopm(b)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                          activeBopm === b ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >{b}</button>
                    ))}
                  </div>
                ) : (
                  <Select value={activeBopm} onValueChange={setActiveBopm}>
                    <SelectTrigger className="h-7 w-[180px] text-[11px]">
                      <SelectValue placeholder="All BOPMs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs">All BOPMs</SelectItem>
                      {bopmOptions.map(b => (
                        <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>}

              <div className="flex gap-1 bg-secondary rounded-lg p-1">
                {(["All", "Red", "Yellow", "Green", "Pending"] as const).map(f => (
                  <button key={f} onClick={() => setRgyFilter(f)} className={cn(
                    "px-2.5 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                    rgyFilter === f ? (
                      f === "Red" ? "bg-red-500 text-white shadow-sm" :
                      f === "Yellow" ? "bg-amber-500 text-white shadow-sm" :
                      f === "Green" ? "bg-emerald-500 text-white shadow-sm" :
                      f === "Pending" ? "bg-muted-foreground text-background shadow-sm" :
                      "bg-primary text-primary-foreground shadow-sm"
                    ) : "text-muted-foreground hover:text-foreground"
                  )}>{f}</button>
                ))}
              </div>

              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="h-8 w-[170px] text-[11px]">
                  <SelectValue placeholder="All segments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All" className="text-xs">All segments</SelectItem>
                  {DIMENSIONS.map(d => (
                    <SelectItem key={d.key} value={d.key} className="text-xs">{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-1 bg-secondary rounded-lg p-1">
                {(["All", "Retainer", "Non-Retainer"] as const).map(f => (
                  <button key={f} onClick={() => setDealTypeFilter(f)} className={cn(
                    "px-2.5 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                    dealTypeFilter === f
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}>{f}</button>
                ))}
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search clients or deals..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" />
              </div>

              <label className="flex items-center gap-2 text-ui text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="rounded border-border" />
                Show closed/completed
              </label>

              {Object.keys(colFilters).length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="text-xs gap-1 text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> Clear filters ({Object.keys(colFilters).length})
                </Button>
              )}
            </div>

            {/* Flat Table with column filters */}
            <TooltipProvider>
              <div className="bg-card border border-border rounded-xl relative">
                <div ref={tableScrollRef} className="overflow-auto overscroll-x-contain max-h-[calc(100vh-260px)] rounded-xl">
                  <table className="w-full text-ui">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-secondary border-b border-border">
                        {isColVisible("account") && (
                          <ColHeader label="Client" colKey="account" sortKey="account" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.account} onResizeStart={startResize("account")} />
                        )}
                        {isColVisible("deal_name") && (
                          <ColHeader label="Deal Name" colKey="deal_name" sortKey="deal_name" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.deal_name} onResizeStart={startResize("deal_name")} />
                        )}
                        {isColVisible("deal_id") && (
                          <ColHeader label="Deal ID" colKey="deal_id" sortKey="deal_id" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.deal_id} onResizeStart={startResize("deal_id")} />
                        )}
                        {isColVisible("deal_status") && (
                          <ColHeader label="Status" colKey="deal_status" sortKey="deal_status" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={Object.keys(statusBadgeStyles)} width={colWidths.deal_status} onResizeStart={startResize("deal_status")} />
                        )}
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground text-caption whitespace-nowrap">Mark RGY</th>
                        {isColVisible("overall_rgy") && (
                          <ColHeader
                            label="Overall RGY"
                            colKey="overall_rgy"
                            align="center"
                            sortState={{sortKey, sortDir}}
                            onSort={toggleSort}
                            colFilters={colFilters}
                            openFilter={openFilter}
                            setOpenFilter={setOpenFilter}
                            setFilter={setFilter}
                            clearFilter={clearFilter}
                            options={["Green","Yellow","Red","Pending"]}
                            width={colWidths.overall_rgy}
                            onResizeStart={startResize("overall_rgy")}
                          />
                        )}
                        {DIMENSIONS.filter(d => isColVisible(d.key)).map(d => (
                          <ColHeader key={d.key} label={d.label} colKey={d.key} align="center" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["Green","Yellow","Red","NA","Pending"]} width={colWidths[d.key]} onResizeStart={startResize(d.key)} />
                        ))}
                        {isAdminPersona && isColVisible("updated_at") && (
                          <ColHeader label="Last Updated At" colKey="updated_at" sortKey="rgy_updated_at" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.updated_at} onResizeStart={startResize("updated_at")} placeholder="Filter by date..." />
                        )}
                        {isAdminPersona && isColVisible("updated_by") && (
                          <ColHeader label="Last Updated By" colKey="updated_by" sortKey="rgy_updated_by_name" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.updated_by} onResizeStart={startResize("updated_by")} placeholder="Filter by user..." />
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map(deal => {
                        const worst = getWorstRGY(deal);
                        const isPending = !deal.rgy_row_id;
                        const rowTint =
                          isPending ? "" :
                          worst === "R" ? "bg-destructive/10 hover:bg-destructive/15" :
                          worst === "Y" ? "bg-warning/10 hover:bg-warning/15" :
                          worst === "G" ? "bg-positive/10 hover:bg-positive/15" :
                          "";
                        const hasIssueContent = !!((deal.rgy_issue_details || "").trim() || (deal.rgy_action_plan || "").trim());
                        const isExpanded = expandedIssues.has(deal.id);
                        const visibleColCount =
                          (isColVisible("account") ? 1 : 0) +
                          (isColVisible("deal_name") ? 1 : 0) +
                          (isColVisible("deal_id") ? 1 : 0) +
                          (isColVisible("deal_status") ? 1 : 0) +
                          1 /* Mark RGY */ +
                          (isColVisible("overall_rgy") ? 1 : 0) +
                          DIMENSIONS.filter(d => isColVisible(d.key)).length +
                          (isAdminPersona && isColVisible("updated_at") ? 1 : 0) +
                          (isAdminPersona && isColVisible("updated_by") ? 1 : 0);
                        const nonGreenDims = DIMENSIONS
                          .map(d => ({ key: d.key, label: d.label, val: (deal[d.key as keyof DealWithRGY] as string) || "" }))
                          .filter(d => d.val === "R" || d.val === "Y");
                        return (
                          <React.Fragment key={deal.id}>
                          <tr className={cn("border-b border-border/50 transition-colors", rowTint || "hover:bg-accent/10")}>
                            {isColVisible("account") && (
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1.5">
                                  {hasIssueContent ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleIssueExpanded(deal.id)}
                                      className="h-4 w-4 shrink-0 inline-flex items-center justify-center rounded hover:bg-accent/60 text-muted-foreground"
                                      aria-label={isExpanded ? "Hide issue" : "Show issue"}
                                      title={isExpanded ? "Hide issue" : "Show issue"}
                                    >
                                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    </button>
                                  ) : (
                                    <span className="h-4 w-4 shrink-0" />
                                  )}
                                  <span className="text-xs font-medium text-foreground truncate max-w-[140px] block" title={deal.account}>{deal.account}</span>
                                </div>
                              </td>
                            )}
                            {isColVisible("deal_name") && (
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  {worst && <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", worstDotColor[worst])} />}
                                  <Link to={`/deals/${deal.id}`} className="text-primary hover:underline text-xs font-medium">{deal.deal_name}</Link>
                                  <RGYHistoryPopover dealId={deal.id} />
                                </div>
                              </td>
                            )}
                            {isColVisible("deal_id") && (
                              <td className="py-2 px-3 text-xs font-mono text-muted-foreground">{deal.deal_id || "—"}</td>
                            )}
                            {isColVisible("deal_status") && (
                              <td className="py-2 px-3">
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium border", statusBadgeStyles[deal.deal_status] || "bg-muted text-muted-foreground border-border")}>
                                  {statusShortLabels[deal.deal_status] || deal.deal_status || "—"}
                                </Badge>
                              </td>
                            )}
                            <td className="py-2 px-3">
                              {(() => {
                                const allMarked = DIMENSIONS.every(dim => (deal[dim.key as keyof DealWithRGY] as string));
                                const hasNonGreen = DIMENSIONS.some(dim => {
                                  const v = (deal[dim.key as keyof DealWithRGY] as string) || "";
                                  return v === "R" || v === "Y";
                                });
                                const hasIssue = !!(deal.rgy_issue_details || "").trim();
                                return (
                                  <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant={allMarked ? "outline" : "default"}
                                    className="h-7 text-[11px]"
                                    onClick={() => setMarkRGYDeal(deal)}
                                    disabled={!canEditRgy}
                                    title={!canEditRgy ? "Only Sr/Principal/Group BOPM, VSD or Admin can edit RGY" : undefined}
                                  >
                                    {allMarked ? "Update RGY" : "Mark RGY"}
                                  </Button>
                                  {hasNonGreen && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-[11px] px-2"
                                      onClick={() => setCombinedIssuesDeal(deal)}
                                      disabled={!canEditRgy}
                                      title={hasIssue ? "Edit logged issue" : "Log issue"}
                                    >
                                      {hasIssue ? "Edit issue" : "Add issue"}
                                    </Button>
                                  )}
                                  </div>
                                );
                              })()}
                            </td>
                            {isColVisible("overall_rgy") && (() => {
                              const dims: Record<string, string> = {};
                              for (const d of DIMENSIONS) dims[d.key] = (deal[d.key as keyof DealWithRGY] as string) || "";
                              const score = computeOverallCustomerScore(dims);
                              const band = worst;
                              const cellVal: RGYCellValue = band ?? "PENDING";
                              return (
                                <td className="py-2 px-2 text-center">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={cn(
                                          "inline-flex items-center justify-center gap-1 rounded-md text-caption font-medium px-2 h-7 cursor-help",
                                          cellColors[cellVal]
                                        )}
                                      >
                                        <span className="font-semibold">{band ? band : "—"}</span>
                                        {score !== null && (
                                          <span className="font-mono tabular-nums text-[10px] opacity-90">· {Math.round(score)}</span>
                                        )}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="w-[280px] p-3" sideOffset={6}>
                                      {score === null ? (
                                        <p className="text-xs text-muted-foreground">No RGY data</p>
                                      ) : (
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className={cn(
                                                "text-2xl font-medium leading-none",
                                                band === "R" && "text-destructive",
                                                band === "Y" && "text-warning",
                                                band === "G" && "text-positive",
                                              )}>{score.toFixed(1)}</span>
                                              <span className={cn(
                                                "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                                                band === "R" && "bg-destructive/15 text-destructive",
                                                band === "Y" && "bg-warning/15 text-warning",
                                                band === "G" && "bg-positive/15 text-positive",
                                              )}>{band === "R" ? "Red" : band === "Y" ? "Yellow" : "Green"}</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">Weighted RGY rollup</span>
                                          </div>
                                          <div className="relative">
                                            <div className="h-1.5 rounded-full bg-gradient-to-r from-destructive via-warning to-positive opacity-70" />
                                            <div
                                              className={cn(
                                                "absolute -top-0.5 w-2.5 h-2.5 rounded-full border border-background -translate-x-1/2",
                                                band === "R" && "bg-destructive",
                                                band === "Y" && "bg-warning",
                                                band === "G" && "bg-positive",
                                              )}
                                              style={{ left: `${Math.max(0, Math.min(100, score))}%` }}
                                            />
                                            <div className="relative h-3 mt-0.5 text-[9px] text-muted-foreground">
                                              <span className="absolute left-0">0</span>
                                              <span className="absolute" style={{ left: "40%", transform: "translateX(-50%)" }}>40</span>
                                              <span className="absolute" style={{ left: "75%", transform: "translateX(-50%)" }}>75</span>
                                              <span className="absolute right-0">100</span>
                                            </div>
                                          </div>
                                          <div className="flex items-start justify-between gap-2 pt-0.5 text-[10px]">
                                            <div>
                                              <div className="text-muted-foreground">Scale</div>
                                              <div className="flex items-center gap-1.5">
                                                <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-destructive" />0</span>
                                                <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-warning" />50</span>
                                                <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-positive" />100</span>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-muted-foreground">Weights</div>
                                              <div>Customer 50 · Internal 10 · Others 5</div>
                                            </div>
                                          </div>
                                          <p className="text-[10px] text-muted-foreground">N/A and blank values excluded</p>
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </td>
                              );
                            })()}
                            {DIMENSIONS.filter(dim => isColVisible(dim.key)).map(dim => {
                              const raw = (deal[dim.key as keyof DealWithRGY] as string) || "";
                              const val: RGYCellValue = raw === "" ? "PENDING" : (raw as RGYStatus);
                              return (
                                <td key={dim.key} className="py-2 px-2 text-center">
                                  <RGYCell
                                    value={val}
                                    label={dim.label}
                                    issueDetails={deal.rgy_issue_details}
                                    actionPlan={deal.rgy_action_plan}
                                    issueDate={deal.rgy_issue_date}
                                    updatedByName={deal.rgy_updated_by_name}
                                  />
                                </td>
                              );
                            })}
                            {isAdminPersona && isColVisible("updated_at") && (
                              <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                                {deal.rgy_updated_at
                                  ? format(new Date(deal.rgy_updated_at), "dd MMM yyyy, HH:mm")
                                  : <span className="text-muted-foreground/60">—</span>}
                              </td>
                            )}
                            {isAdminPersona && isColVisible("updated_by") && (
                              <td className="py-2 px-3 text-xs text-foreground whitespace-nowrap">
                                {deal.rgy_updated_by_name
                                  ? deal.rgy_updated_by_name
                                  : <span className="text-muted-foreground/60">—</span>}
                              </td>
                            )}
                          </tr>
                          {isExpanded && hasIssueContent && (
                            <tr className={cn("border-b border-border/50", rowTint)}>
                              <td colSpan={visibleColCount} className="p-0">
                                <div className="bg-secondary/40 border-t border-border/60 px-4 py-3">
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                                      <span className="font-semibold text-foreground/80">Logged Issue</span>
                                      {deal.rgy_issue_date && (
                                        <span>· {format(new Date(deal.rgy_issue_date), "dd MMM yyyy")}</span>
                                      )}
                                      {deal.rgy_updated_by_name && (
                                        <span>· by {deal.rgy_updated_by_name}</span>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px]"
                                      onClick={() => setCombinedIssuesDeal(deal)}
                                      disabled={!canEditRgy}
                                    >
                                      Edit issue
                                    </Button>
                                  </div>
                                  {nonGreenDims.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {nonGreenDims.map(d => (
                                        <Badge
                                          key={d.key}
                                          variant="outline"
                                          className={cn(
                                            "text-[10px] px-1.5 py-0 font-medium border",
                                            d.val === "R" && "bg-destructive/15 text-destructive border-destructive/30",
                                            d.val === "Y" && "bg-warning/15 text-warning border-warning/30",
                                          )}
                                        >
                                          {d.label} · {d.val}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(deal.rgy_issue_details || "").trim() && (
                                      <div>
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Issue</div>
                                        <p className="text-xs text-foreground whitespace-pre-wrap leading-snug">{deal.rgy_issue_details}</p>
                                      </div>
                                    )}
                                    {(deal.rgy_action_plan || "").trim() && (
                                      <div>
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Action Plan</div>
                                        <p className="text-xs text-foreground whitespace-pre-wrap leading-snug">{deal.rgy_action_plan}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ScrollToStartButton scrollRef={tableScrollRef} />

                {tableRows.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No deals found matching your filters.</p>
                  </div>
                )}
              </div>
            </TooltipProvider>
          </TabsContent>

          <TabsContent value="insights">
            {!isBopmPersona && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">Weekly RGY Update Compliance</h3>
                <WeeklyComplianceTab rgyByDealId={Object.fromEntries(deals.map(d => [d.deal_id, getWorstRGY(d)]))} />
              </div>
            )}
            <RGYInsightsTab
              deals={deals}
              filteredDeals={filteredDeals}
              issues={rgyIssues}
              activeVsd={activeVsd}
              isBopm={isBopmPersona}
              isVsd={isVsdPersona}
              myVsdName={myVsdName}
              summaryDeals={aiSummaryDeals}
            />
          </TabsContent>

        </Tabs>

        {/* R/Y → G Resolve Issues Dialog (mandatory) */}
        {pendingGreen && (
          <ResolveIssuesDialog
            open
            mode="required"
            dealId={pendingGreen.dealId}
            dealName={deals.find(d => d.id === pendingGreen.dealId)?.deal_name}
            dimensionLabel={pendingGreen.dimLabel}
            onConfirm={handleGreenConfirm}
            onCancel={handleGreenCancel}
          />
        )}

        {/* R → Y Resolve Issues Dialog (optional) */}
        {resolveAfterDowngrade && (
          <ResolveIssuesDialog
            open
            mode="optional"
            dealId={resolveAfterDowngrade.dealId}
            dealName={deals.find(d => d.id === resolveAfterDowngrade.dealId)?.deal_name}
            onConfirm={() => setResolveAfterDowngrade(null)}
            onCancel={() => setResolveAfterDowngrade(null)}
          />
        )}

        {/* Per-click issue form removed — users now log a single combined issue
            from the deal's RGY Health tab via the status bar. */}

        <DealDetailDialog
          deal={selectedDeal}
          open={!!selectedDealId}
          onOpenChange={(open) => { if (!open) setSelectedDealId(null); }}
        />

        {/* Per-row Mark RGY dialog (replaces inline cell editing) */}
        {markRGYDeal && (
          <MarkRGYDialog
            open
            onOpenChange={(o) => { if (!o) setMarkRGYDeal(null); }}
            dealLabel={markRGYDeal.deal_name}
            saving={markRGYSaving}
            dimensions={DIMENSIONS.map(dim => ({
              key: dim.key,
              label: dim.label,
              value: (markRGYDeal[dim.key as keyof DealWithRGY] as string) || "",
            }))}
            onSave={handleMarkRGYSave}
          />
        )}

        {/* Combined-issues dialog: auto-opens after any Red is saved */}
        {combinedIssuesDeal && (() => {
          const nonGreen = DIMENSIONS
            .map(dim => ({ key: dim.key, label: dim.label, value: (combinedIssuesDeal[dim.key as keyof DealWithRGY] as string) || "" }))
            .filter(d => d.value === "R" || d.value === "Y");
          const assigneeNames = Array.from(new Set([
            ...assignmentAssigneeNames,
            combinedIssuesDeal.vsd, combinedIssuesDeal.principal_bopm, combinedIssuesDeal.senior_bopm, combinedIssuesDeal.bopm,
          ].filter(Boolean) as string[]));
          return (
            <RGYCombinedIssuesDialog
              open
              onOpenChange={(o) => { if (!o) setCombinedIssuesDeal(null); }}
              dealLabel={combinedIssuesDeal.deal_name}
              nonGreenDims={nonGreen}
              assigneeNames={assigneeNames}
              readOnly={!canEditRgy}
              onCancel={() => {
                // User closed the issue dialog without saving — revert any
                // RGY dims that were just moved to R/Y for this deal.
                const snap = prevRGYSnapshot;
                if (snap && snap.dealId === combinedIssuesDeal.id) {
                  setDeals(prev => prev.map(d => d.id === snap.dealId
                    ? { ...d, ...(snap.values as any) }
                    : d));
                  const deal = deals.find(d => d.id === snap.dealId);
                  if (deal?.rgy_row_id) {
                    supabase.from("deal_rgy_weekly").update(snap.values as any).eq("id", deal.rgy_row_id);
                  }
                  setPrevRGYSnapshot(null);
                  toast.info("RGY reverted — issue is mandatory for R/Y");
                }
              }}
              initial={{
                issueDetails: combinedIssuesDeal.rgy_issue_details || "",
                actionPlan: combinedIssuesDeal.rgy_action_plan || "",
                issueDate: combinedIssuesDeal.rgy_issue_date || undefined,
              }}
              onSave={async (data) => {
                const deal = combinedIssuesDeal;
                if (deal.rgy_row_id) {
                  await supabase.from("deal_rgy_weekly").update({
                    issue_date: data.issueDate,
                    issue_details: data.issueDetails,
                    action_plan: data.actionPlan,
                    resolution_due_date: data.dueDate || null,
                    issue_status: data.issueStatus,
                  }).eq("id", deal.rgy_row_id);
                }
                if (data.assignees.length > 0 || data.actionPlan.trim() || data.subtasks.length > 0) {
                  const redLabels = nonGreen.filter(d => d.value === "R").map(d => d.label).join(", ");
                  await (supabase.from("deal_tasks") as any).insert({
                    deal_id: deal.id,
                    title: `[RGY Health]${redLabels ? ` ${redLabels} —` : ""} ${(data.actionPlan || data.issueDetails).trim().slice(0, 100)}`,
                    description: `Issue Details: ${data.issueDetails}\nAction Plan: ${data.actionPlan}`,
                    stage: "To Do",
                    assignee: data.assignees[0] || "",
                    assignees: data.assignees,
                    urgency: "Medium",
                    logged_hours: 0,
                    sort_order: 0,
                    start_date: data.issueDate,
                    end_date: data.dueDate || null,
                    subtasks: data.subtasks.map((s, i) => ({ id: `${Date.now()}-${i}`, title: s.title, completed: false })),
                  });
                }
                setDeals(prev => prev.map(d => d.id === deal.id ? {
                  ...d,
                  rgy_issue_details: data.issueDetails,
                  rgy_action_plan: data.actionPlan,
                  rgy_issue_date: data.issueDate,
                } : d));
                setPrevRGYSnapshot(null);
                toast.success("Issue saved & task created");
              }}
            />
          );
        })()}

        {/* RGY Summary drill-down dialog */}
        {rgyDrill && (() => {
          let scoped = filteredDeals;
          if (showBopmRgyInsights) {
            const bucketOf = (d: DealWithRGY) => {
              const raw = (d.principal_bopm || d.senior_bopm || "").trim();
              const lower = raw.toLowerCase();
              const isPlaceholder =
                !raw ||
                lower === "to be assigned" ||
                lower === "tbd" ||
                lower === "tba" ||
                lower === "unassigned" ||
                lower === "not assigned";
              return isPlaceholder ? "Unassigned" : raw;
            };
            if (rgyDrill.rowLabel !== "Pod Overall") {
              scoped = filteredDeals.filter(d => bucketOf(d) === rgyDrill.rowLabel);
            }
            // Pod Overall: keep all filteredDeals (matches tally which counts every deal)
          } else {
            scoped = filteredDeals.filter(d => (vsdForDeal(d as any) || "Unassigned") === rgyDrill.rowLabel);
          }
          const matchMetric = (deal: DealWithRGY) => {
            const w = getWorstRGY(deal);
            switch (rgyDrill.metric) {
              case "total": return true;
              case "red": return w === "R";
              case "yellow": return w === "Y";
              case "green": return w === "G";
              case "pending": return w === null;
              case "pendingActive": return w === null && (deal.deal_status || "").trim() === "Active Deal";
            }
          };
          const rows = scoped.filter(matchMetric);
          const metricLabel: Record<RGYDrillMetric, string> = {
            total: "Active Deals", red: "Red", yellow: "Yellow", green: "Green", pending: "Pending", pendingActive: "Pending (Active)",
          };
          const showActivePending = rgyDrill.metric === "pendingActive";
          return (
            <Dialog open={!!rgyDrill} onOpenChange={(o) => !o && setRgyDrill(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {rgyDrill.rowLabel} — {metricLabel[rgyDrill.metric]} ({rows.length})
                  </DialogTitle>
                </DialogHeader>
                <div className="border border-border rounded-lg overflow-hidden mt-2">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Account</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deal ID</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deal Name</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                        {showActivePending && (
                          <>
                            <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sr / Principal BOPM</th>
                            <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deal Created</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(d => (
                        <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="py-2 px-3 text-foreground">{d.account}</td>
                          <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground">{d.deal_id || "—"}</td>
                          <td className="py-2 px-3">
                            <Link to={`/deals/${d.id}`} className="text-primary hover:underline" onClick={() => setRgyDrill(null)}>
                              {d.deal_name}
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{d.deal_status || "—"}</td>
                          {showActivePending && (
                            <>
                              <td className="py-2 px-3 text-muted-foreground">
                                {(d.principal_bopm || d.senior_bopm) ? (
                                  <span>
                                    {d.principal_bopm || "—"}
                                    {d.senior_bopm && d.principal_bopm && d.senior_bopm !== d.principal_bopm ? ` / ${d.senior_bopm}` : ""}
                                    {!d.principal_bopm && d.senior_bopm ? d.senior_bopm : ""}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground font-mono tabular-nums">
                                {d.deal_created_at ? format(new Date(d.deal_created_at), "dd MMM yyyy") : "—"}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={showActivePending ? 6 : 4} className="text-center py-6 text-muted-foreground">No matching deals.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
        {/* KPI strip drill-down dialog */}
        {kpiDrill && (() => {
          const rows = filteredDeals
            .map(d => {
              const dims: Record<string, string> = {};
              for (const dim of DIMENSIONS) dims[dim.key] = (d[dim.key as keyof DealWithRGY] as string) || "";
              const score = computeOverallCustomerScore(dims);
              const w = getWorstRGY(d);
              return { deal: d, score, worst: w };
            })
            .filter(r => {
              if (kpiDrill === "score") return true;
              if (kpiDrill === "marked") return r.worst === "R" || r.worst === "Y" || r.worst === "G";
              return false;
            })
            .sort((a, b) => {
              if (kpiDrill === "score") return (b.score ?? -1) - (a.score ?? -1);
              return a.deal.account.localeCompare(b.deal.account);
            });
          const titleMap = { score: "Overall Health Score", marked: "Marked Deals" } as const;
          return (
            <Dialog open={!!kpiDrill} onOpenChange={(o) => !o && setKpiDrill(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {titleMap[kpiDrill]} ({rows.length})
                  </DialogTitle>
                </DialogHeader>
                <div className="border border-border rounded-lg overflow-hidden mt-2">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Account</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deal Name</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deal ID</th>
                        <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Overall Health Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ deal, score, worst }) => (
                        <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="py-2 px-3 text-foreground">{deal.account}</td>
                          <td className="py-2 px-3">
                            <Link to={`/deals/${deal.id}`} className="text-primary hover:underline" onClick={() => setKpiDrill(null)}>
                              {deal.deal_name}
                            </Link>
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground">{deal.deal_id || "—"}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 font-mono tabular-nums",
                              worst === "R" && "text-destructive",
                              worst === "Y" && "text-warning",
                              worst === "G" && "text-positive",
                            )}>
                              {worst && <span className={cn("w-2 h-2 rounded-full", worstDotColor[worst])} />}
                              {score === null ? "—" : score.toFixed(1)}
                              {worst && <span className="text-[10px] text-muted-foreground">{worst}</span>}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No matching deals.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>
      <RaiseInterventionDialog
        open={raiseInterventionOpen}
        onOpenChange={setRaiseInterventionOpen}
      />
    </AppLayout>
  );
}
