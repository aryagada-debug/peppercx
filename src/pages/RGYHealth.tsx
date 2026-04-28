import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DealDetailDialog } from "@/components/rgy/DealDetailDialog";
import { RGYInsightsTab } from "@/components/rgy/RGYInsightsTab";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, Plus, Trash2, Check, X, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const VSD_FILTERS = [
  { key: "All", label: "All" },
  { key: "Neema Jayadas", label: "Neema Jayadas" },
  { key: "Aamir Khan", label: "Aamir Khan" },
  { key: "Aditya Shaw", label: "Aditya Shaw" },
  { key: "Sneha Iyer", label: "Sneha Iyer" },
  { key: "Sumit Shekhawat", label: "Sumit Shekhawat" },
  { key: "Other", label: "Other" },
  { key: "Unassigned", label: "Unassigned" },
] as const;
type VsdFilterKey = typeof VSD_FILTERS[number]["key"];
const NAMED_VSDS = new Set(["Neema Jayadas", "Aamir Khan", "Aditya Shaw", "Sneha Iyer", "Sumit Shekhawat"]);
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

const RGY_OPTIONS: { value: RGYStatus; label: string }[] = [
  { value: "G", label: "Green" },
  { value: "Y", label: "Yellow" },
  { value: "R", label: "Red" },
  { value: "NA", label: "N/A" },
];

const cellColors: Record<RGYStatus, string> = {
  R: "rgy-red",
  G: "rgy-green",
  Y: "rgy-yellow",
  NA: "rgy-na",
};

const cellLabels: Record<RGYStatus, string> = {
  R: "R", G: "G", Y: "Y", NA: "NA",
};

const statusLabels: Record<RGYStatus, string> = {
  R: "Red", G: "Green", Y: "Yellow", NA: "N/A",
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
  rgy_row_id?: string;
  rgy_week_start?: string;
  rgy_action_plan?: string;
  rgy_discussed_action_plan?: string;
  rgy_issue_details?: string;
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
  const vals = DIMENSIONS.map(d => deal[d.key as keyof DealWithRGY] as string);
  if (vals.includes("R")) return "R";
  if (vals.includes("Y")) return "Y";
  if (vals.every(v => v === "NA" || !v)) return null;
  return "G";
}

// ── Inline RGY Selector with blank-on-reclick ──
function RGYCell({
  dealId,
  dimKey,
  value,
  label,
  onUpdate,
}: {
  dealId: string;
  dimKey: string;
  value: RGYStatus;
  label: string;
  onUpdate: (dealId: string, dimKey: string, newValue: RGYStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all",
              cellColors[value]
            )}
            aria-label={`${label}: ${statusLabels[value]} — Click to change`}
          >
            {cellLabels[value]}
          </button>
        </TooltipTrigger>
        <TooltipContent><p>{label} · {statusLabels[value]}</p></TooltipContent>
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg shadow-lg p-1 flex gap-1">
            {RGY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  // If clicking the already-selected value, clear to NA
                  const newVal = opt.value === value ? "NA" as RGYStatus : opt.value;
                  onUpdate(dealId, dimKey, newVal);
                  setOpen(false);
                }}
                className={cn(
                  "w-7 h-7 rounded-md text-caption font-semibold transition-all",
                  cellColors[opt.value],
                  value === opt.value && "ring-2 ring-primary"
                )}
                title={opt.label}
              >
                {cellLabels[opt.value]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
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

function RGYIssueFormDialog({
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
    discussedActionPlan: string;
    actionPlan: string;
    resolutionDueDate: string;
    issueStatus: string;
    tasks: RGYIssueTask[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [issueDetails, setIssueDetails] = useState("");
  const [discussedActionPlan, setDiscussedActionPlan] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [resolutionDueDate, setResolutionDueDate] = useState<Date | undefined>();
  const [issueStatus, setIssueStatus] = useState("Open");
  const [saving, setSaving] = useState(false);

  const [issueTasks, setIssueTasks] = useState<RGYIssueTask[]>(
    nonGreenDims.map(d => ({
      dimension: d.label,
      issueSummary: "",
      urgency: d.value === "R" ? "High" : "Medium",
      assignees: [],
    }))
  );

  const allAssigneeNames = [...new Set(
    [deal.vsd, deal.principal_bopm, deal.senior_bopm, deal.bopm].filter(Boolean)
  )];

  const updateIssueTask = (idx: number, updates: Partial<RGYIssueTask>) => {
    setIssueTasks(prev => prev.map((t, i) => i === idx ? { ...t, ...updates } : t));
  };

  const addNewTask = () => {
    setIssueTasks(prev => [...prev, { dimension: nonGreenDims[0]?.label || "", issueSummary: "", urgency: "Medium", assignees: [] }]);
  };

  const removeTask = (idx: number) => {
    setIssueTasks(prev => prev.filter((_, i) => i !== idx));
  };

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
        discussedActionPlan,
        actionPlan,
        resolutionDueDate: resolutionDueDate?.toISOString().split("T")[0] || "",
        issueStatus,
        tasks: issueTasks.filter(t => t.issueSummary.trim() && t.assignees.length > 0),
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Resolution Due Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left text-sm font-normal h-9", !resolutionDueDate && "text-muted-foreground")}>
                    <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    {resolutionDueDate ? format(resolutionDueDate, "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={resolutionDueDate} onSelect={setResolutionDueDate} className="p-3 pointer-events-auto" />
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

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tasks to Create</label>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addNewTask}>
                <Plus className="h-3 w-3" /> Add Task
              </Button>
            </div>
            <div className="space-y-3">
              {issueTasks.map((task, idx) => (
                <div key={idx} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{task.dimension}</span>
                    <div className="flex items-center gap-2">
                      <Select value={task.urgency} onValueChange={v => updateIssueTask(idx, { urgency: v })}>
                        <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Critical">Critical</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      {issueTasks.length > 1 && (
                        <button onClick={() => removeTask(idx)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <Input
                    value={task.issueSummary}
                    onChange={e => updateIssueTask(idx, { issueSummary: e.target.value })}
                    placeholder="Brief issue summary for task title..."
                    className="h-8 text-sm"
                  />
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Assignees</label>
                    <div className="flex flex-wrap gap-1.5">
                      {allAssigneeNames.map(name => {
                        const selected = task.assignees.includes(name);
                        return (
                          <button
                            key={name}
                            onClick={() => {
                              updateIssueTask(idx, {
                                assignees: selected
                                  ? task.assignees.filter(a => a !== name)
                                  : [...task.assignees, name],
                              });
                            }}
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
                    </div>
                  </div>
                </div>
              ))}
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
}

// ── Main Component ──
export default function RGYHealth() {
  const [deals, setDeals] = useState<DealWithRGY[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [activeVsd, setActiveVsd] = useState<VsdFilterKey>("All");
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState("");
  const [rgyFilter, setRgyFilter] = useState<"All" | "Red" | "Yellow" | "Green">("All");
  const [activeTab, setActiveTab] = useState<"health" | "insights">("health");
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
    account: 160, deal_name: 200, deal_id: 110, deal_status: 110,
    customer: 100, internal: 100, content: 100, seo: 90, supply: 100, copy: 90, design: 100, video: 100,
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
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const startResize = useCallback((key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key, startX: e.clientX, startW: colWidths[key] || 120 };
    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const next = Math.max(60, Math.min(500, r.startW + (ev.clientX - r.startX)));
      setColWidths(prev => ({ ...prev, [r.key]: next }));
    };
    const onUp = () => {
      resizingRef.current = null;
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

  // Green-gate state
  const [greenGate, setGreenGate] = useState<{
    dealId: string;
    dimKey: string;
    tasks: { id: string; title: string; stage: string }[];
  } | null>(null);

  // Issues for insights
  const [rgyIssues, setRgyIssues] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const { data: dealRows } = await supabase
      .from("staffing_deals")
      .select("id, deal_id, deal_name, account, bopm, deal_status, pod, mrr, total_deal_value, vsd, principal_bopm, senior_bopm, start_date, end_date, payment_terms, pc_code")
      .order("deal_name");

    if (!dealRows) { setLoading(false); return; }

    const dealIds = dealRows.map(d => d.id);
    const rgyMap = new Map<string, any>();
    const issuesList: any[] = [];

    for (let i = 0; i < dealIds.length; i += 500) {
      const batch = dealIds.slice(i, i + 500);
      const { data: rgyRows } = await supabase
        .from("deal_rgy_weekly")
        .select("id, deal_id, customer, internal, content, seo, supply, copy, design, video, week_start, issue_details, issue_status, action_plan, discussed_action_plan, issue_date, created_at")
        .in("deal_id", batch)
        .order("week_start", { ascending: false });

      if (rgyRows) {
        for (const r of rgyRows) {
          if (!rgyMap.has(r.deal_id)) {
            rgyMap.set(r.deal_id, r);
            if (r.issue_details && (r.issue_status === "Open" || r.issue_status === "In Progress")) {
              const dealRow = dealRows.find(d => d.id === r.deal_id);
              const dimVals = DIMENSIONS.map(dim => (r as any)[dim.key] as string);
              const worst: "R" | "Y" | "G" | null = dimVals.includes("R") ? "R" : dimVals.includes("Y") ? "Y" : "G";
              const redDims = DIMENSIONS.filter(dim => (r as any)[dim.key] === "R").map(dim => dim.label);
              issuesList.push({
                deal_id: r.deal_id,                            // FK pk for linking
                deal_id_code: dealRow?.deal_id || "",          // human code
                deal_name: dealRow?.deal_name || "Unknown",
                pc_code: dealRow?.pc_code || "",
                account: dealRow?.account || "",
                pod: getPodForDeal(dealRow?.vsd || "", dealRow?.pod || ""),
                vsd: dealRow?.vsd || "",
                deal_status: dealRow?.deal_status || "",
                issue_details: r.issue_details,
                issue_status: r.issue_status || "Open",
                action_plan: (r as any).action_plan || "",
                discussed_action_plan: (r as any).discussed_action_plan || "",
                red_dimensions: redDims,
                worst,
                issue_date: (r as any).issue_date || null,
                created_at: (r as any).created_at || null,
              });
            }
          }
        }
      }
    }

    setRgyIssues(issuesList as any);

    const merged: DealWithRGY[] = dealRows.map(d => {
      const rgy = rgyMap.get(d.id);
      return {
        ...d,
        pc_code: d.pc_code || "",
        rgy_row_id: rgy?.id,
        rgy_week_start: rgy?.week_start,
        rgy_action_plan: rgy?.action_plan || "",
        rgy_discussed_action_plan: rgy?.discussed_action_plan || "",
        rgy_issue_details: rgy?.issue_details || "",
        customer: rgy?.customer || "NA",
        internal: rgy?.internal || "NA",
        content: rgy?.content || "NA",
        seo: rgy?.seo || "NA",
        supply: rgy?.supply || "NA",
        copy: rgy?.copy || "NA",
        design: rgy?.design || "NA",
        video: rgy?.video || "NA",
      };
    });

    setDeals(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRGYUpdate = useCallback(async (dealId: string, dimKey: string, newValue: RGYStatus) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const oldValue = (deal[dimKey as keyof DealWithRGY] as string) || "NA";

    // Green-gate: if going from R/Y to G, check for pending tasks
    if (newValue === "G" && (oldValue === "R" || oldValue === "Y")) {
      const { data: pendingTasks } = await supabase
        .from("deal_tasks")
        .select("id, title, stage")
        .eq("deal_id", dealId)
        .like("title", "[RGY Health]%")
        .neq("stage", "Done");

      if (pendingTasks && pendingTasks.length > 0) {
        setGreenGate({ dealId, dimKey, tasks: pendingTasks });
        return;
      }
    }

    await applyRGYUpdate(dealId, dimKey, newValue, deal);
  }, [deals]);

  const applyRGYUpdate = useCallback(async (dealId: string, dimKey: string, newValue: RGYStatus, deal: DealWithRGY) => {
    // Save snapshot before change for potential revert
    const oldValues: Record<string, string> = {};
    DIMENSIONS.forEach(dim => {
      oldValues[dim.key] = deal[dim.key as keyof DealWithRGY] as string || "NA";
    });

    // Optimistically update local state
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, [dimKey]: newValue } : d));

    const weekStart = getCurrentWeekStart();

    const updatedDeal = { ...deal, [dimKey]: newValue };
    const rgyPayload: Record<string, string> = {};
    DIMENSIONS.forEach(dim => {
      rgyPayload[dim.key] = (updatedDeal[dim.key as keyof DealWithRGY] as string) || "G";
    });

    if (deal.rgy_row_id && deal.rgy_week_start === weekStart) {
      await supabase.from("deal_rgy_weekly").update({ [dimKey]: newValue } as any).eq("id", deal.rgy_row_id);
    } else {
      const { data: inserted } = await supabase.from("deal_rgy_weekly").insert({
        deal_id: dealId,
        week_start: weekStart,
        ...rgyPayload,
        account_health: rgyPayload.customer || "G",
        finance_billing: "G",
        capability_seo: rgyPayload.seo || "G",
        capability_creative: "G",
      } as any).select("id").single();

      if (inserted) {
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, rgy_row_id: inserted.id, rgy_week_start: weekStart } : d));
      }
    }

    // If new value is R or Y, show issue form
    if (newValue === "R" || newValue === "Y") {
      const latestDeal = { ...deal, [dimKey]: newValue };
      const nonGreen = DIMENSIONS
        .map(dim => ({
          key: dim.key,
          label: dim.label,
          value: (latestDeal[dim.key as keyof DealWithRGY] as string) || "NA",
        }))
        .filter(d => d.value === "R" || d.value === "Y");

      setPrevRGYSnapshot({ dealId, values: oldValues });
      setIssueFormDeal(latestDeal as DealWithRGY);
      setIssueFormNonGreen(nonGreen);
    }
  }, []);

  const handleGreenGateConfirm = useCallback(async () => {
    if (!greenGate) return;
    const deal = deals.find(d => d.id === greenGate.dealId);
    if (deal) {
      await applyRGYUpdate(greenGate.dealId, greenGate.dimKey, "G", deal);
    }
    setGreenGate(null);
  }, [greenGate, deals, applyRGYUpdate]);

  const handleMarkTaskDone = useCallback(async (taskId: string) => {
    await supabase.from("deal_tasks").update({ stage: "Done" }).eq("id", taskId);
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
    discussedActionPlan: string;
    actionPlan: string;
    resolutionDueDate: string;
    issueStatus: string;
    tasks: RGYIssueTask[];
  }) => {
    if (!issueFormDeal) return;

    const deal = deals.find(d => d.id === issueFormDeal.id);
    if (deal?.rgy_row_id) {
      await supabase.from("deal_rgy_weekly").update({
        issue_date: issueData.issueDate,
        issue_details: issueData.issueDetails,
        discussed_action_plan: issueData.discussedActionPlan,
        action_plan: issueData.actionPlan,
        resolution_due_date: issueData.resolutionDueDate || null,
        issue_status: issueData.issueStatus,
      }).eq("id", deal.rgy_row_id);
    }

    for (const task of issueData.tasks) {
      for (const assignee of task.assignees) {
        await supabase.from("deal_tasks").insert({
          deal_id: issueFormDeal.id,
          title: `[RGY Health] ${task.dimension} — ${task.issueSummary}`,
          description: `Issue Details: ${issueData.issueDetails}\nAction Plan: ${issueData.actionPlan}\nDiscussed Action Plan: ${issueData.discussedActionPlan}`,
          stage: "To Do",
          assignee,
          urgency: task.urgency,
          logged_hours: 0,
          sort_order: 0,
          start_date: issueData.issueDate,
          end_date: issueData.resolutionDueDate || null,
        });
      }
    }

    setIssueFormDeal(null);
    setIssueFormNonGreen([]);
    setPrevRGYSnapshot(null);
    toast.success("Issue saved & tasks created");
  }, [issueFormDeal, deals]);

  // Filtering
  const filteredDeals = useMemo(() => {
    let d = deals;
    if (!showClosed) d = d.filter(deal => ACTIVE_STATUSES.has(deal.deal_status));
    if (activeVsd === "Unassigned") {
      d = d.filter(deal => UNASSIGNED_VSD_VALUES.has((deal.vsd || "").trim()));
    } else if (activeVsd === "Other") {
      d = d.filter(deal => {
        const v = (deal.vsd || "").trim();
        return v && !UNASSIGNED_VSD_VALUES.has(v) && !NAMED_VSDS.has(v);
      });
    } else if (activeVsd !== "All") {
      d = d.filter(deal => (deal.vsd || "").trim() === activeVsd);
    }
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(deal => deal.account.toLowerCase().includes(s) || deal.deal_name.toLowerCase().includes(s) || deal.deal_id.toLowerCase().includes(s));
    }
    // RGY status filter
    if (rgyFilter !== "All") {
      d = d.filter(deal => {
        const w = getWorstRGY(deal);
        if (rgyFilter === "Red") return w === "R";
        if (rgyFilter === "Yellow") return w === "Y";
        if (rgyFilter === "Green") return w === "G";
        return true;
      });
    }
    return d;
  }, [deals, activeVsd, search, showClosed, rgyFilter]);

  // Apply per-column filters + sort to produce flat row list
  const tableRows = useMemo(() => {
    const matches = (val: any, q: string) => String(val ?? "").toLowerCase().includes(q.toLowerCase());
    let rows = filteredDeals.filter(d => {
      if (colFilters.account && !matches(d.account, colFilters.account)) return false;
      if (colFilters.deal_name && !matches(d.deal_name, colFilters.deal_name)) return false;
      if (colFilters.deal_id && !matches(d.deal_id, colFilters.deal_id)) return false;
      if (colFilters.deal_status && (d.deal_status || "") !== colFilters.deal_status) return false;
      for (const dim of DIMENSIONS) {
        const f = colFilters[dim.key];
        if (f) {
          const code = RGY_FILTER_LABEL_TO_CODE[f] ?? f;
          const hasRow = !!d.rgy_row_id;
          if (code === "Pending") {
            if (hasRow) return false;
          } else {
            if (!hasRow) return false; // "Pending" rows don't match concrete colors
            const v = ((d as any)[dim.key]) || "NA";
            if (v !== code) return false;
          }
        }
      }
      return true;
    });
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a: any, b: any) => {
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
    const allDims = filteredDeals.flatMap(d =>
      DIMENSIONS.map(dim => (d[dim.key as keyof DealWithRGY] as string || "NA") as RGYStatus)
    );
    const red = allDims.filter(v => v === "R").length;
    const yellow = allDims.filter(v => v === "Y").length;
    const green = allDims.filter(v => v === "G").length;
    const scored = allDims.filter(v => v !== "NA").length;
    const score = scored > 0 ? ((green * 100 + yellow * 50) / scored).toFixed(1) : "—";
    return { red, yellow, green, score, totalDeals: filteredDeals.length };
  }, [filteredDeals]);

  const selectedDeal = deals.find(d => d.id === selectedDealId) ?? null;

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
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">RGY Health Tracker</h1>
            <p className="text-ui text-muted-foreground mt-0.5">
              {kpis.totalDeals} deals • Click any RGY cell to update
            </p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <MetricCard label="Red Flags" value={String(kpis.red)} />
          <MetricCard label="Yellow Warnings" value={String(kpis.yellow)} />
          <MetricCard label="Green (Healthy)" value={String(kpis.green)} />
          <MetricCard label="Portfolio Score" value={String(kpis.score)} suffix="/ 100" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
            {VSD_FILTERS.map(v => (
              <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{v.label}</button>
            ))}
          </div>

          {/* RGY Status Filter */}
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {(["All", "Red", "Yellow", "Green"] as const).map(f => (
              <button key={f} onClick={() => setRgyFilter(f)} className={cn(
                "px-2.5 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                rgyFilter === f ? (
                  f === "Red" ? "bg-red-500 text-white shadow-sm" :
                  f === "Yellow" ? "bg-amber-500 text-white shadow-sm" :
                  f === "Green" ? "bg-emerald-500 text-white shadow-sm" :
                  "bg-primary text-primary-foreground shadow-sm"
                ) : "text-muted-foreground hover:text-foreground"
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

        {/* Tab switcher */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-4">
          <TabsList>
            <TabsTrigger value="health">Health Board</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="health">
            {/* Flat Table with column filters */}
            <TooltipProvider>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-ui">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border">
                        <ColHeader label="Client" colKey="account" sortKey="account" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.account} onResizeStart={startResize("account")} />
                        <ColHeader label="Deal Name" colKey="deal_name" sortKey="deal_name" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.deal_name} onResizeStart={startResize("deal_name")} />
                        <ColHeader label="Deal ID" colKey="deal_id" sortKey="deal_id" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.deal_id} onResizeStart={startResize("deal_id")} />
                        <ColHeader label="Status" colKey="deal_status" sortKey="deal_status" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={Object.keys(statusBadgeStyles)} width={colWidths.deal_status} onResizeStart={startResize("deal_status")} />
                        {DIMENSIONS.map(d => (
                          <ColHeader key={d.key} label={d.label} colKey={d.key} align="center" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["Green","Yellow","Red","NA","Pending"]} width={colWidths[d.key]} onResizeStart={startResize(d.key)} />
                        ))}
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground text-caption whitespace-nowrap">AI Summary</th>
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
                        return (
                          <tr key={deal.id} className={cn("border-b border-border/50 transition-colors", rowTint || "hover:bg-accent/10")}>
                            <td className="py-2 px-3">
                              <span className="text-xs font-medium text-foreground truncate max-w-[140px] block" title={deal.account}>{deal.account}</span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                {worst && <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", worstDotColor[worst])} />}
                                <Link to={`/deals/${deal.id}`} className="text-primary hover:underline text-xs font-medium">{deal.deal_name}</Link>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-xs font-mono text-muted-foreground">{deal.deal_id || "—"}</td>
                            <td className="py-2 px-3">
                              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium border", statusBadgeStyles[deal.deal_status] || "bg-muted text-muted-foreground border-border")}>
                                {statusShortLabels[deal.deal_status] || deal.deal_status || "—"}
                              </Badge>
                            </td>
                            {DIMENSIONS.map(dim => {
                              const val = (deal[dim.key as keyof DealWithRGY] as string || "NA") as RGYStatus;
                              return (
                                <td key={dim.key} className="py-2 px-2 text-center">
                                  {isPending ? (
                                    <button
                                      onClick={() => handleRGYUpdate(deal.id, dim.key, "G")}
                                      className="inline-flex items-center justify-center px-2 h-7 rounded-md text-[10px] font-semibold rgy-pending hover:ring-2 hover:ring-primary/30 transition-all"
                                      title="Pending — click to set"
                                    >
                                      Pending
                                    </button>
                                  ) : (
                                    <RGYCell dealId={deal.id} dimKey={dim.key} value={val} label={dim.label} onUpdate={handleRGYUpdate} />
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 max-w-[260px]">
                              {deal.rgy_issue_details ? (
                                <span
                                  className="text-xs text-muted-foreground line-clamp-1 block"
                                  title={deal.rgy_issue_details}
                                >
                                  {deal.rgy_issue_details.replace(/\s+/g, " ").trim()}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {tableRows.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No deals found matching your filters.</p>
                  </div>
                )}
              </div>
            </TooltipProvider>
          </TabsContent>

          <TabsContent value="insights">
            <RGYInsightsTab
              deals={deals}
              filteredDeals={filteredDeals}
              issues={rgyIssues}
              activeVsd={activeVsd}
            />
          </TabsContent>
        </Tabs>

        {/* Green-Gate Dialog */}
        {greenGate && (
          <GreenGateDialog
            pendingTasks={greenGate.tasks}
            onConfirm={handleGreenGateConfirm}
            onCancel={() => setGreenGate(null)}
            onMarkDone={handleMarkTaskDone}
          />
        )}

        {/* Issue Form Dialog */}
        {issueFormDeal && issueFormNonGreen.length > 0 && (
          <RGYIssueFormDialog
            deal={issueFormDeal}
            nonGreenDims={issueFormNonGreen}
            onSave={handleIssueSave}
            onCancel={handleIssueCancel}
          />
        )}

        <DealDetailDialog
          deal={selectedDeal}
          open={!!selectedDealId}
          onOpenChange={(open) => { if (!open) setSelectedDealId(null); }}
        />
      </div>
    </AppLayout>
  );
}
