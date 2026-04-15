import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Plus, Trash2, Pencil, RefreshCw, Tag, List, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { TaskFormDialog, type TaskData } from "./TaskFormDialog";
import { TaskKanban, type DealTask } from "./TaskKanban";
import { toast } from "sonner";

// ── Phase Template (from PDF onboarding plan) ──
export interface PhaseTemplate {
  phase: string;
  tasks: { title: string; description: string; assigneeRole: string; tags: string[] }[];
}

export const ONBOARDING_PHASES: PhaseTemplate[] = [
  { phase: "Sales Handover", tasks: [
    { title: "Review proposal & signed documents", description: "Review the sales proposal, SOW, contract, and all signed documents for the deal", assigneeRole: "VSD", tags: ["Sales"] },
    { title: "Setup meeting with Sales", description: "Schedule a handover meeting with the Sales team to discuss deal context and client expectations", assigneeRole: "VSD", tags: ["Sales"] },
    { title: "Conduct Sales-to-CX handover", description: "Complete the formal handover from Sales to CX team with all relevant documents and context", assigneeRole: "Senior BOPM", tags: ["Operations"] },
  ]},
  { phase: "Scope Definition", tasks: [
    { title: "Review engagement model, strategy deck & briefs", description: "Thoroughly review the engagement model, strategy deck, creative briefs, and scope documents", assigneeRole: "BOPM", tags: ["Operations"] },
  ]},
  { phase: "Staffing", tasks: [
    { title: "Initiate staffing request", description: "Raise staffing request based on deal scope and requirements", assigneeRole: "Senior BOPM", tags: ["Operations"] },
    { title: "Margin & Deal Desk review", description: "Complete margin analysis and Deal Desk review for staffing allocation", assigneeRole: "Senior BOPM", tags: ["Finance"] },
  ]},
  { phase: "Supply Requisition", tasks: [
    { title: "Supply assessment and finalization", description: "Assess supply needs and finalize freelancer/vendor requirements", assigneeRole: "BOPM", tags: ["Operations"] },
  ]},
  { phase: "Resource Onboarding", tasks: [
    { title: "Onboard freelancer/resource", description: "Complete onboarding for allocated freelancers or resources", assigneeRole: "BOPM", tags: ["Operations"] },
  ]},
  { phase: "Internal Alignment", tasks: [
    { title: "Internal Kickoff meeting", description: "Conduct internal kickoff with all stakeholders to align on goals, timelines, and deliverables", assigneeRole: "Senior BOPM", tags: ["Operations"] },
    { title: "Account staffing review", description: "Review staffing plan with team leads to ensure adequate resourcing", assigneeRole: "Senior BOPM", tags: ["Operations"] },
    { title: "Immersion session setup", description: "Organize immersion sessions for the team to understand client's business, product, and audience", assigneeRole: "BOPM", tags: ["Operations"] },
    { title: "Complete immersion sessions", description: "Conduct and complete all planned immersion sessions with the team", assigneeRole: "BOPM", tags: ["Operations"] },
    { title: "Internal SEO alignment", description: "Align SEO team on client goals, keyword strategy, and technical requirements", assigneeRole: "SEO Lead", tags: ["SEO"] },
  ]},
  { phase: "Client Kick-off", tasks: [
    { title: "Prepare kickoff deck (SEO)", description: "Create SEO-specific kickoff presentation with strategy, timeline, and deliverables", assigneeRole: "SEO Lead", tags: ["SEO"] },
    { title: "Prepare kickoff deck (Content)", description: "Create content-specific kickoff presentation with editorial plan and guidelines", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Complete client kickoff call", description: "Conduct the client kickoff meeting presenting strategy, team, and roadmap", assigneeRole: "VSD", tags: ["Operations"] },
    { title: "Send Minutes of Meeting", description: "Share MoM from kickoff call with all stakeholders including action items", assigneeRole: "BOPM", tags: ["Operations"] },
    { title: "Finalize communication cadence", description: "Agree on weekly/monthly reporting and communication schedule with client", assigneeRole: "BOPM", tags: ["Operations"] },
  ]},
  { phase: "Project Setup & Planning", tasks: [
    { title: "Project setup in tools", description: "Set up project in all required tools (PM tool, Slack, Drive, etc.)", assigneeRole: "BOPM", tags: ["Operations"] },
    { title: "Roadmap creation", description: "Build detailed project roadmap with milestones and timelines", assigneeRole: "BOPM", tags: ["Operations"] },
    { title: "Assign tasks to team", description: "Break down roadmap into actionable tasks and assign to team members", assigneeRole: "BOPM", tags: ["Operations"] },
    { title: "Create shared folders & repositories", description: "Set up shared Drive folders, asset repositories, and documentation spaces", assigneeRole: "BOPM", tags: ["Operations"] },
    { title: "Create tracking sheets & dashboards", description: "Build performance tracking sheets, KPI dashboards, and reporting templates", assigneeRole: "BOPM", tags: ["Operations"] },
  ]},
  { phase: "Keyword Universe", tasks: [
    { title: "Atlas / tool setup", description: "Set up keyword research tools (Atlas, SEMrush, Ahrefs) for the project", assigneeRole: "SEO Lead", tags: ["SEO"] },
    { title: "Finalize keyword categories", description: "Define and finalize keyword categories/clusters based on business goals", assigneeRole: "SEO Lead", tags: ["SEO"] },
    { title: "Extract & compile keywords", description: "Extract comprehensive keyword list and compile into keyword universe", assigneeRole: "SEO Analyst", tags: ["SEO"] },
  ]},
  { phase: "Competitor Research", tasks: [
    { title: "Review client website", description: "Conduct thorough analysis of client's current website, content, and SEO performance", assigneeRole: "SEO Analyst", tags: ["SEO"] },
    { title: "Review competitor websites", description: "Analyze top competitors' websites, content strategies, and SEO positioning", assigneeRole: "SEO Analyst", tags: ["SEO"] },
  ]},
  { phase: "Keyword Analysis", tasks: [
    { title: "Keyword analysis & prioritization", description: "Analyze keyword difficulty, search volume, and business relevance for prioritization", assigneeRole: "SEO Lead", tags: ["SEO"] },
    { title: "Keyword-to-page mapping", description: "Map prioritized keywords to existing and planned pages on the website", assigneeRole: "SEO Analyst", tags: ["SEO"] },
    { title: "Identify new page opportunities", description: "Identify gaps and opportunities for new pages based on keyword analysis", assigneeRole: "SEO Lead", tags: ["SEO"] },
    { title: "Prepare Information Architecture", description: "Create recommended information architecture based on keyword mapping", assigneeRole: "SEO Lead", tags: ["SEO"] },
  ]},
  { phase: "Initial Benchmarking", tasks: [
    { title: "Pre-SEO ranking report", description: "Generate baseline ranking report before SEO interventions begin", assigneeRole: "SEO Analyst", tags: ["SEO"] },
    { title: "Monthly topics research", description: "Research and plan content topics for the first 3 months", assigneeRole: "SEO Lead", tags: ["SEO", "Content"] },
    { title: "SEO content outline creation", description: "Create detailed content outlines based on keyword strategy", assigneeRole: "SEO Lead", tags: ["SEO", "Content"] },
  ]},
  { phase: "Page Creation", tasks: [
    { title: "Share content suggestions with client", description: "Present content recommendations and get client buy-in", assigneeRole: "BOPM", tags: ["Content"] },
    { title: "Crawl website for technical audit", description: "Perform technical site crawl to identify issues and opportunities", assigneeRole: "SEO Analyst", tags: ["SEO"] },
    { title: "Classify URLs by type & priority", description: "Categorize all URLs by page type, priority, and content status", assigneeRole: "SEO Analyst", tags: ["SEO"] },
  ]},
  { phase: "URL Taxonomy", tasks: [
    { title: "URL taxonomy classification", description: "Create comprehensive URL taxonomy and classification system", assigneeRole: "SEO Lead", tags: ["SEO"] },
  ]},
  { phase: "Backlinking Audit", tasks: [
    { title: "Compare off-page parameters", description: "Audit and compare backlink profiles against competitors", assigneeRole: "SEO Analyst", tags: ["SEO"] },
  ]},
  { phase: "Content Team Initiation", tasks: [
    { title: "Review keyword universe & create content calendar", description: "Content team reviews keyword universe and builds editorial content calendar", assigneeRole: "Content Lead", tags: ["Content"] },
  ]},
  { phase: "Defining Timelines", tasks: [
    { title: "Calendar sign-off & cadence setup", description: "Get client sign-off on content calendar and set up regular review cadence", assigneeRole: "BOPM", tags: ["Operations", "Content"] },
  ]},
  { phase: "Engagement Setup", tasks: [
    { title: "Prepare project brief for content", description: "Create detailed project brief for content creation team", assigneeRole: "BOPM", tags: ["Content"] },
    { title: "Share brief for client approval", description: "Submit project brief to client for review and approval", assigneeRole: "BOPM", tags: ["Content"] },
    { title: "Customize content platform", description: "Configure content platform with brand guidelines, tone of voice, and templates", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Set up content platform for writers", description: "Onboard writers to the platform with access and guidelines", assigneeRole: "Content Lead", tags: ["Content"] },
  ]},
  { phase: "Creator Pool Setup", tasks: [
    { title: "Initial creator briefing", description: "Brief and onboard the creator pool with brand guidelines, expectations, and workflow", assigneeRole: "Content Lead", tags: ["Content"] },
  ]},
  { phase: "Content Pilot", tasks: [
    { title: "Editorial briefing & planning", description: "Conduct editorial briefing session for pilot content batch", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Content allotment to writers", description: "Assign pilot content pieces to selected writers", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Edit & review outlines", description: "Review and provide feedback on content outlines before drafting", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Submit first drafts", description: "Writers submit first drafts for review", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Internal quality review", description: "Conduct internal quality review of drafts against guidelines", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Client review — Round 1", description: "Submit drafts to client for first round of feedback", assigneeRole: "BOPM", tags: ["Content"] },
    { title: "Incorporate feedback — Round 1", description: "Incorporate client feedback and prepare revised drafts", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Client review — Round 2", description: "Submit revised drafts for final client approval", assigneeRole: "BOPM", tags: ["Content"] },
    { title: "Final approvals & publishing", description: "Get final approvals and publish/upload approved content", assigneeRole: "BOPM", tags: ["Content"] },
    { title: "Quality escalation handling", description: "Address any quality escalations from pilot batch", assigneeRole: "Content Lead", tags: ["Content"] },
    { title: "Scale-up preparation", description: "Prepare scale-up plan based on pilot learnings for ongoing content production", assigneeRole: "Content Lead", tags: ["Content"] },
  ]},
];

const TAG_COLORS: Record<string, string> = {
  SEO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Content: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Operations: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Sales: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Finance: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Creative: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const STAGE_DOT: Record<string, string> = {
  "To Do": "bg-muted-foreground",
  "In Progress": "bg-[hsl(var(--info))]",
  "In Review": "bg-warning",
  "Done": "bg-positive",
  "Dropped": "bg-destructive",
};

function resolveAssignee(role: string, deal: any): string {
  const r = role.toLowerCase();
  if (r === "vsd") return deal.vsd || "";
  if (r === "senior bopm") return deal.seniorBopm || "";
  if (r === "bopm") return deal.bopm || "";
  if (r === "principal bopm") return deal.principalBopm || "";
  return ""; // SEO Lead, Content Lead, etc. — left blank for manual assignment
}

interface Props {
  tasks: DealTask[];
  dealId: string;
  deal: any;
  assignees: { id: string; name: string }[];
  onAdd: (task: Omit<DealTask, "id">) => void;
  onAddBulk: (tasks: Omit<DealTask, "id">[]) => void;
  onUpdate: (id: string, updates: Partial<DealTask>) => void;
  onDelete: (id: string) => void;
}

export function PhaseTasksView({ tasks, dealId, deal, assignees, onAdd, onAddBulk, onUpdate, onDelete }: Props) {
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [editTask, setEditTask] = useState<DealTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [templateEditMode, setTemplateEditMode] = useState(false);

  // Check if tasks have been seeded
  const phaseTasks = useMemo(() => tasks.filter(t => t.phase && t.phase !== ""), [tasks]);
  const hasPhaseData = phaseTasks.length > 0;

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const map: Record<string, DealTask[]> = {};
    ONBOARDING_PHASES.forEach(p => { map[p.phase] = []; });
    phaseTasks.forEach(t => {
      if (map[t.phase!]) map[t.phase!].push(t);
      else map[t.phase!] = [t];
    });
    return map;
  }, [phaseTasks]);

  // Find current phase (first with incomplete tasks)
  const currentPhase = useMemo(() => {
    for (const p of ONBOARDING_PHASES) {
      const pts = tasksByPhase[p.phase] || [];
      if (pts.length === 0 || pts.some(t => t.stage !== "Done" && t.stage !== "Dropped")) return p.phase;
    }
    return ONBOARDING_PHASES[0].phase;
  }, [tasksByPhase]);

  const activePhase = selectedPhase || currentPhase;

  // Seed template
  const handleSeedTemplate = useCallback(() => {
    const rows: Omit<DealTask, "id">[] = [];
    let sortIdx = 0;
    ONBOARDING_PHASES.forEach(phase => {
      phase.tasks.forEach(t => {
        rows.push({
          dealId,
          title: t.title,
          description: t.description,
          stage: "To Do",
          assignee: resolveAssignee(t.assigneeRole, deal),
          urgency: "Medium",
          loggedHours: 0,
          sortOrder: sortIdx++,
          estimatedHours: 0,
          subtasks: [],
          phase: phase.phase,
          tags: t.tags,
        });
      });
    });
    onAddBulk(rows);
    toast.success("Onboarding tasks seeded from Template v1");
  }, [dealId, deal, onAddBulk]);

  // Handle marking task done with per-task auto-regen
  const handleStageChange = useCallback((taskId: string, newStage: string) => {
    const task = tasks.find(t => t.id === taskId);
    onUpdate(taskId, { stage: newStage });
    if (task?.autoRegen && newStage === "Done") {
      onAdd({
        dealId: task.dealId,
        title: task.title,
        description: task.description,
        stage: "To Do",
        assignee: task.assignee,
        urgency: task.urgency,
        loggedHours: 0,
        sortOrder: (tasksByPhase[task.phase || ""]?.length || 0) + 1,
        estimatedHours: task.estimatedHours || 0,
        subtasks: [],
        phase: task.phase,
        tags: task.tags,
        autoRegen: task.autoRegen,
      });
      toast.info("Task auto-regenerated");
    }
  }, [tasks, onUpdate, onAdd, tasksByPhase]);

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId);
      toast.success("Task deleted");
      setDeleteConfirmId(null);
    }
  };

  const handleEditSubmit = (data: TaskData) => {
    if (!editTask) return;
    onUpdate(editTask.id, {
      title: data.title,
      description: data.description,
      stage: data.stage,
      assignee: data.assignee,
      startDate: data.startDate,
      endDate: data.endDate,
      urgency: data.urgency,
      estimatedHours: data.estimatedHours || 0,
      subtasks: data.subtasks || [],
    });
    setEditTask(null);
  };

  const handleCreateSubmit = (data: TaskData) => {
    onAdd({
      dealId,
      title: data.title,
      description: data.description,
      stage: data.stage,
      assignee: data.assignee,
      startDate: data.startDate,
      endDate: data.endDate,
      urgency: data.urgency,
      loggedHours: 0,
      sortOrder: (tasksByPhase[activePhase]?.length || 0),
      estimatedHours: data.estimatedHours || 0,
      subtasks: data.subtasks || [],
      phase: activePhase,
      tags: [],
    });
  };

  // Tasks to display
  const visibleTasks = showAll ? phaseTasks : (tasksByPhase[activePhase] || []);

  if (!hasPhaseData) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold mb-2">Onboarding Tasks</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Seed the onboarding task template (Template v1) to create phase-based tasks for this deal.
            Tasks will be pre-populated with assignees based on deal team members.
          </p>
          <Button onClick={handleSeedTemplate} className="gap-2">
            <Plus className="h-4 w-4" /> Seed Template v1
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex gap-4 min-h-[500px]">
      {/* ── Left Pane: Phase Navigation ── */}
      <div className="w-64 shrink-0 border border-border rounded-xl bg-card overflow-hidden">
        <div className="p-3 border-b border-border bg-secondary/30">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phases</p>
        </div>
        <div className="overflow-y-auto max-h-[600px]">
          {/* Show All option */}
          <button
            onClick={() => { setShowAll(true); setSelectedPhase(null); }}
            className={cn(
              "w-full text-left px-3 py-2.5 text-sm border-b border-border/50 transition-colors hover:bg-secondary/40",
              showAll && "bg-primary/10 border-l-2 border-l-primary font-medium"
            )}
          >
            <span className="flex items-center justify-between">
              <span>All Tasks</span>
              <Badge variant="secondary" className="text-[10px] font-mono">{phaseTasks.length}</Badge>
            </span>
          </button>

          {ONBOARDING_PHASES.map(p => {
            const pts = tasksByPhase[p.phase] || [];
            const doneCount = pts.filter(t => t.stage === "Done").length;
            const isActive = !showAll && activePhase === p.phase;
            const isComplete = pts.length > 0 && doneCount === pts.length;

            return (
              <button
                key={p.phase}
                onClick={() => {
                  if (isActive && !showAll) {
                    setShowAll(true);
                    setSelectedPhase(null);
                  } else {
                    setShowAll(false);
                    setSelectedPhase(p.phase);
                  }
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-sm border-b border-border/50 transition-colors hover:bg-secondary/40",
                  isActive && "bg-primary/10 border-l-2 border-l-primary font-medium"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    {isComplete ? (
                      <Check className="h-3.5 w-3.5 text-positive shrink-0" />
                    ) : (
                      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isActive && "rotate-90")} />
                    )}
                    <span className="truncate">{p.phase}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {doneCount}/{pts.length}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right Pane: Tasks ── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">{showAll ? "All Tasks" : activePhase}</h3>
            <p className="text-xs text-muted-foreground">{visibleTasks.length} task{visibleTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={autoRegen} onCheckedChange={setAutoRegen} />
              <Label className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Auto-regenerate
              </Label>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
          </div>
        </div>

        {/* Task List */}
        {visibleTasks.length > 0 ? (
          <div className="space-y-2">
            {visibleTasks.map(task => (
              <div
                key={task.id}
                className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow"
              >
                {/* Checkbox */}
                <Checkbox
                  checked={task.stage === "Done"}
                  onCheckedChange={(checked) => handleStageChange(task.id, checked ? "Done" : "To Do")}
                  className="mt-0.5"
                />

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-sm font-medium", task.stage === "Done" && "line-through text-muted-foreground")}>{task.title}</span>
                    <span className={cn("w-2 h-2 rounded-full shrink-0", STAGE_DOT[task.stage] || "bg-muted-foreground")} title={task.stage} />
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{task.description.replace(/<[^>]*>/g, '').slice(0, 100)}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.assignee && (
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{task.assignee}</span>
                    )}
                    {showAll && task.phase && (
                      <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">{task.phase}</span>
                    )}
                    {(task.tags || []).map(tag => (
                      <span key={tag} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", TAG_COLORS[tag] || "bg-secondary text-muted-foreground")}>
                        {tag}
                      </span>
                    ))}
                    {task.endDate && (
                      <span className="text-[10px] text-muted-foreground">Due: {task.endDate}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Select value={task.stage} onValueChange={(v) => handleStageChange(task.id, v)}>
                    <SelectTrigger className="h-7 w-[100px] text-[10px] border-none bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["To Do", "In Progress", "In Review", "Done", "Dropped"].map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button onClick={() => setEditTask(task)} className="p-1.5 rounded hover:bg-secondary"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <button onClick={() => setDeleteConfirmId(task.id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No tasks in this phase yet.
            <br />
            <button onClick={() => setCreateOpen(true)} className="text-primary hover:underline mt-2 inline-block">+ Add a task</button>
          </div>
        )}
      </div>

      {/* Edit Task Dialog */}
      {editTask && (
        <TaskFormDialog
          open={!!editTask}
          onOpenChange={(open) => { if (!open) setEditTask(null); }}
          onSubmit={handleEditSubmit}
          assignees={assignees}
          initial={{
            ...editTask,
            startDate: editTask.startDate || "",
            endDate: editTask.endDate || "",
            estimatedHours: editTask.estimatedHours || 0,
            subtasks: editTask.subtasks || [],
          }}
          title="Edit Task"
          onDelete={() => { onDelete(editTask.id); setEditTask(null); }}
        />
      )}

      {/* Create Task Dialog */}
      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateSubmit}
        assignees={assignees}
        defaultStage="To Do"
        title="Add Task"
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this task? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
