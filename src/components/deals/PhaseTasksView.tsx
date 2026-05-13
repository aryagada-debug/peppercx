import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Plus, Trash2, Pencil, RefreshCw, Tag, List, LayoutGrid, GripVertical, Save, Copy, Settings2, Search, User, Clock, Flag, Calendar, ArrowUp, ArrowDown, X, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CxDatePickerPopover } from "@/components/cx/CxDatePickerPopover";
import { TaskFormDialog, type TaskData } from "./TaskFormDialog";
import { TaskKanban, type DealTask } from "./TaskKanban";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Phase Template (from PDF onboarding plan) ──
export interface PhaseTemplate {
  phase: string;
  tasks: {
    title: string;
    description: string;
    assigneeRole: string;
    tags: string[];
    /** @deprecated kept for legacy saved templates; new templates use dueDate/endDate */
    dayStart?: number;
    /** @deprecated kept for legacy saved templates; new templates use dueDate/endDate */
    dayEnd?: number;
    /** Specific person assignee (staffing_people.id). Takes precedence over assigneeRole. */
    assigneeUserId?: string | null;
    assigneeUserName?: string | null;
    /** ISO YYYY-MM-DD */
    dueDate?: string | null;
    /** ISO YYYY-MM-DD */
    endDate?: string | null;
    estimatedHours?: number;
    urgency?: "Low" | "Medium" | "High" | "Critical";
  }[];
}

// Mandatory phases auto-populated by generators (RGY, MBR). Always shown in rail.
export const MANDATORY_PHASES = ["RGY Issues", "MBR"] as const;

// Palette of dot colors for phase rows in the editor (cycled by index).
const PHASE_DOT_COLORS = [
  "bg-emerald-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-orange-500",
  "bg-lime-500",
  "bg-indigo-500",
  "bg-pink-500",
  "bg-teal-500",
];

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
  return "";
}

// ── Saved Template type ──
interface SavedTemplate {
  id: string;
  name: string;
  phases: PhaseTemplate[];
  createdBy?: string | null;
}

// ── Assignee Picker (Role tab + People grouped by designation) ──
const COMMON_ROLES = [
  "VSD",
  "Principal BOPM",
  "Senior BOPM",
  "BOPM",
  "SEO Lead",
  "Content Lead",
  "Creative Lead",
  "Supply Lead",
];

interface AssigneeOption { id: string; name: string; staffed?: boolean; designation?: string }

function TemplateAssigneePicker({
  role,
  userId,
  userName,
  assignees,
  onPickRole,
  onPickUser,
}: {
  role: string;
  userId: string | null | undefined;
  userName: string | null | undefined;
  assignees: AssigneeOption[];
  onPickRole: (role: string) => void;
  onPickUser: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"role" | "people">(userId ? "people" : "role");
  const [search, setSearch] = useState("");
  const [customRole, setCustomRole] = useState("");

  const label = userName || role || "Unassigned";
  const isUser = !!userId;

  const { onDeal, byDesignation } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filt = (p: AssigneeOption) =>
      !q || p.name.toLowerCase().includes(q) || (p.designation || "").toLowerCase().includes(q);
    const onDeal = assignees.filter(p => p.staffed && filt(p));
    const others = assignees.filter(p => !p.staffed && filt(p));
    const grouped = new Map<string, AssigneeOption[]>();
    others.forEach(p => {
      const k = (p.designation || "Other").trim() || "Other";
      const arr = grouped.get(k) || [];
      arr.push(p);
      grouped.set(k, arr);
    });
    const byDesignation = Array.from(grouped.entries())
      .map(([k, list]) => ({ designation: k, people: list.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.designation.localeCompare(b.designation));
    return { onDeal, byDesignation };
  }, [assignees, search]);

  const pickRole = (r: string) => {
    onPickRole(r);
    setOpen(false);
  };
  const pickUser = (p: AssigneeOption) => {
    onPickUser(p.id, p.name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded-md pl-2 pr-2 py-0.5 text-[11px] max-w-[180px]",
            isUser
              ? "bg-primary/10 text-primary"
              : "bg-secondary/60 text-foreground hover:bg-secondary"
          )}
          title={isUser ? `Assigned to ${userName}` : role ? `Role: ${role}` : "Click to assign"}
        >
          {isUser ? <User className="h-3 w-3" /> : <Briefcase className="h-3 w-3 text-muted-foreground" />}
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 m-2">
            <TabsTrigger value="role" className="text-xs">Role</TabsTrigger>
            <TabsTrigger value="people" className="text-xs">People</TabsTrigger>
          </TabsList>

          <TabsContent value="role" className="m-0 p-2 pt-0 space-y-0.5 max-h-72 overflow-y-auto">
            {COMMON_ROLES.map(r => (
              <button
                key={r}
                onClick={() => pickRole(r)}
                className={cn(
                  "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent",
                  !isUser && role === r && "bg-primary/10 text-primary font-medium"
                )}
              >
                {r}
              </button>
            ))}
            <div className="border-t border-border mt-1 pt-2">
              <Label className="text-[10px] text-muted-foreground px-2">Custom role</Label>
              <div className="flex gap-1 px-2 pt-1">
                <Input
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && customRole.trim()) pickRole(customRole.trim()); }}
                  placeholder="e.g. Analytics Lead"
                  className="h-7 text-xs"
                />
                <Button size="sm" className="h-7 text-xs" disabled={!customRole.trim()} onClick={() => pickRole(customRole.trim())}>Set</Button>
              </div>
            </div>
            {(isUser || role) && (
              <button
                onClick={() => { onPickRole(""); setOpen(false); }}
                className="w-full text-left text-xs px-2 py-1.5 rounded text-destructive hover:bg-destructive/10 mt-1"
              >
                Clear assignment
              </button>
            )}
          </TabsContent>

          <TabsContent value="people" className="m-0 p-0">
            <div className="p-2 border-b border-border">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or designation"
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {onDeal.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-0.5">On this deal</div>
                  {onDeal.map(p => (
                    <button
                      key={`d-${p.id}`}
                      onClick={() => pickUser(p)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-center justify-between gap-2",
                        userId === p.id && "bg-primary/10"
                      )}
                    >
                      <span className="text-xs truncate">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{p.designation || ""}</span>
                    </button>
                  ))}
                  <div className="border-t border-border my-1" />
                </>
              )}
              {byDesignation.map(group => (
                <div key={group.designation}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-0.5">{group.designation}</div>
                  {group.people.map(p => (
                    <button
                      key={p.id}
                      onClick={() => pickUser(p)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded hover:bg-accent",
                        userId === p.id && "bg-primary/10"
                      )}
                    >
                      <span className="text-xs">{p.name}</span>
                    </button>
                  ))}
                </div>
              ))}
              {onDeal.length === 0 && byDesignation.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6">No people match.</div>
              )}
            </div>
            {isUser && (
              <div className="border-t border-border p-1">
                <button
                  onClick={() => { onPickRole(""); setOpen(false); }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded text-destructive hover:bg-destructive/10"
                >
                  Clear assignment
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

// ── Template Editor Dialog ──
function TemplateEditorDialog({
  open,
  onOpenChange,
  initialPhases,
  assignees,
  onSeed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhases: PhaseTemplate[];
  assignees: AssigneeOption[];
  onSeed: (phases: PhaseTemplate[], opts?: { onlyPhaseIdx?: number; onlyPhaseIdxs?: number[] }) => void;
}) {
  const [phases, setPhases] = useState<PhaseTemplate[]>(() => JSON.parse(JSON.stringify(initialPhases)));
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [phaseSearch, setPhaseSearch] = useState("");
  const [checkedPhaseIdxs, setCheckedPhaseIdxs] = useState<Set<number>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  // Load saved templates
  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    supabase.from("task_templates").select("*").order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setSavedTemplates(data.map((t: any) => ({
            id: t.id,
            name: t.name,
            phases: Array.isArray(t.phases) ? t.phases : [],
            createdBy: t.created_by ?? null,
          })));
        }
        setLoadingTemplates(false);
      });
  }, [open]);

  const currentPhase = phases[selectedPhaseIdx];

  const addPhase = () => {
    const newPhase: PhaseTemplate = { phase: `New Phase ${phases.length + 1}`, tasks: [] };
    setPhases(prev => [...prev, newPhase]);
    setSelectedPhaseIdx(phases.length);
  };

  const removePhase = (idx: number) => {
    if (phases.length <= 1) return;
    setPhases(prev => prev.filter((_, i) => i !== idx));
    setSelectedPhaseIdx(prev => Math.min(prev, phases.length - 2));
  };

  const updatePhaseName = (idx: number, name: string) => {
    setPhases(prev => prev.map((p, i) => i === idx ? { ...p, phase: name } : p));
  };

  const movePhase = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= phases.length) return;
    setPhases(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
    setSelectedPhaseIdx(newIdx);
  };

  const addTask = () => {
    setPhases(prev => prev.map((p, i) =>
      i === selectedPhaseIdx
        ? { ...p, tasks: [...p.tasks, { title: "", description: "", assigneeRole: "", tags: [] }] }
        : p
    ));
  };

  const removeTask = (taskIdx: number) => {
    setPhases(prev => prev.map((p, i) =>
      i === selectedPhaseIdx
        ? { ...p, tasks: p.tasks.filter((_, ti) => ti !== taskIdx) }
        : p
    ));
  };

  const updateTask = (taskIdx: number, field: string, value: any) => {
    setPhases(prev => prev.map((p, i) =>
      i === selectedPhaseIdx
        ? { ...p, tasks: p.tasks.map((t, ti) => ti === taskIdx ? { ...t, [field]: value } : t) }
        : p
    ));
  };

  const moveTask = (taskIdx: number, dir: -1 | 1) => {
    const newIdx = taskIdx + dir;
    if (newIdx < 0 || newIdx >= (currentPhase?.tasks.length || 0)) return;
    setPhases(prev => prev.map((p, i) => {
      if (i !== selectedPhaseIdx) return p;
      const arr = [...p.tasks];
      [arr[taskIdx], arr[newIdx]] = [arr[newIdx], arr[newIdx]]; // swap
      [arr[taskIdx], arr[newIdx]] = [arr[newIdx], arr[taskIdx]];
      return { ...p, tasks: arr };
    }));
  };

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const { data, error } = await (supabase.from("task_templates") as any)
      .insert({ name: saveName.trim(), phases, created_by: uid })
      .select()
      .single();
    if (data) {
      setSavedTemplates(prev => [{ id: data.id, name: data.name, phases: data.phases, createdBy: data.created_by ?? null }, ...prev]);
      toast.success(`Template "${saveName}" saved`);
      setSaveDialogOpen(false);
      setSaveName("");
    } else if (error) {
      toast.error("Failed to save template");
    }
  };

  const handleLoadTemplate = (template: SavedTemplate) => {
    setPhases(JSON.parse(JSON.stringify(template.phases)));
    setSelectedPhaseIdx(0);
    toast.success(`Loaded template "${template.name}"`);
  };

  const handleDeleteTemplate = async (tpl: SavedTemplate) => {
    if (!currentUserId || tpl.createdBy !== currentUserId) {
      toast.error("You can only delete templates you created");
      return;
    }
    await supabase.from("task_templates").delete().eq("id", tpl.id);
    setSavedTemplates(prev => prev.filter(t => t.id !== tpl.id));
    toast.success("Template deleted");
  };

  const filteredPhaseIdxs = useMemo(() => {
    const q = phaseSearch.trim().toLowerCase();
    return phases
      .map((_, i) => i)
      .filter(i => !q || phases[i].phase.toLowerCase().includes(q));
  }, [phases, phaseSearch]);

  const toggleChecked = (idx: number) => {
    setCheckedPhaseIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const totalTasks = phases.reduce((acc, p) => acc + p.tasks.length, 0);
  const estDays = Math.max(1, Math.round(totalTasks / 1.5));
  const checkedCount = checkedPhaseIdxs.size;

  const seedLabel = checkedCount > 0 ? `Seed ${checkedCount} Phase${checkedCount === 1 ? "" : "s"}` : "Seed Tasks";
  const handleSeedAll = () => {
    if (checkedCount > 0) {
      onSeed(phases, { onlyPhaseIdxs: Array.from(checkedPhaseIdxs).sort((a, b) => a - b) });
    } else {
      onSeed(phases);
    }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Settings2 className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base">Template Editor</DialogTitle>
                <DialogDescription className="text-xs">Customize phases and tasks before seeding. You can also save this as a reusable template.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: phases list */}
            <div className="w-64 shrink-0 border-r border-border bg-secondary/20 flex flex-col">
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phases</span>
                <button
                  onClick={addPhase}
                  className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
                  title="Add phase"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={phaseSearch}
                    onChange={(e) => setPhaseSearch(e.target.value)}
                    placeholder="Search phases"
                    className="h-7 pl-7 text-xs bg-background"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-2 pb-2 space-y-0.5">
                {filteredPhaseIdxs.map((idx) => {
                  const p = phases[idx];
                  const isActive = selectedPhaseIdx === idx;
                  const isChecked = checkedPhaseIdxs.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedPhaseIdx(idx)}
                      className={cn(
                        "group flex items-center gap-2 px-2 py-2 rounded-md text-xs cursor-pointer transition-colors",
                        isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-background border border-transparent"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleChecked(idx)}
                        onClick={(e) => e.stopPropagation()}
                        className={cn("h-3.5 w-3.5", !isChecked && "opacity-0 group-hover:opacity-100 transition-opacity", checkedPhaseIdxs.size > 0 && "opacity-100")}
                      />
                      <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <span className={cn("h-2 w-2 rounded-full shrink-0", PHASE_DOT_COLORS[idx % PHASE_DOT_COLORS.length])} />
                      <span className={cn("flex-1 truncate", isActive && "font-medium text-primary")}>{p.phase || "Untitled"}</span>
                      <Badge variant={isActive ? "default" : "secondary"} className="h-5 min-w-[20px] px-1.5 text-[10px] font-mono">
                        {p.tasks.length}
                      </Badge>
                    </div>
                  );
                })}
                {filteredPhaseIdxs.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">No phases match.</p>
                )}
              </div>
              <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Check className="h-3 w-3" /> {totalTasks} tasks</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{estDays} days</span>
              </div>
            </div>

            {/* Right: phase details + tasks */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {currentPhase && (
                <>
                  {/* Phase name + actions */}
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", PHASE_DOT_COLORS[selectedPhaseIdx % PHASE_DOT_COLORS.length])} />
                    <Input
                      value={currentPhase.phase}
                      onChange={(e) => updatePhaseName(selectedPhaseIdx, e.target.value)}
                      className="h-9 text-sm font-medium flex-1 text-primary"
                      placeholder="Phase name"
                    />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => movePhase(selectedPhaseIdx, -1)} disabled={selectedPhaseIdx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => movePhase(selectedPhaseIdx, 1)} disabled={selectedPhaseIdx === phases.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removePhase(selectedPhaseIdx)} disabled={phases.length <= 1}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tasks</Label>
                        <Badge variant="secondary" className="h-5 text-[10px] font-mono">{currentPhase.tasks.length}</Badge>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addTask}>
                        <Plus className="h-3 w-3" /> Add task
                      </Button>
                    </div>

                    {currentPhase.tasks.map((task, tIdx) => (
                      <div key={tIdx} className="flex items-start gap-2 border border-border rounded-lg p-3 bg-card">
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-1.5 shrink-0" />
                        <div className="flex-1 space-y-2 min-w-0">
                          <Input
                            value={task.title}
                            onChange={(e) => updateTask(tIdx, "title", e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Task title"
                          />
                          <Textarea
                            value={task.description}
                            onChange={(e) => updateTask(tIdx, "description", e.target.value)}
                            className="text-xs min-h-[44px] resize-y"
                            placeholder="Description"
                            rows={2}
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Assignee (Role or Person) */}
                            <TemplateAssigneePicker
                              role={task.assigneeRole}
                              userId={task.assigneeUserId}
                              userName={task.assigneeUserName}
                              assignees={assignees}
                              onPickRole={(r) => {
                                updateTask(tIdx, "assigneeRole", r);
                                updateTask(tIdx, "assigneeUserId", null);
                                updateTask(tIdx, "assigneeUserName", null);
                              }}
                              onPickUser={(id, name) => {
                                updateTask(tIdx, "assigneeUserId", id);
                                updateTask(tIdx, "assigneeUserName", name);
                                updateTask(tIdx, "assigneeRole", "");
                              }}
                            />
                            {/* Tag chips */}
                            {(task.tags || []).map((tag, tagIdx) => (
                              <span key={tagIdx} className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium", TAG_COLORS[tag] || "bg-secondary text-muted-foreground")}>
                                {tag}
                                <button onClick={() => updateTask(tIdx, "tags", task.tags.filter((_, i) => i !== tagIdx))} className="hover:opacity-70">
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            ))}
                            <Input
                              value=""
                              onChange={(e) => {
                                const v = e.target.value.replace(/,$/, "").trim();
                                if (v) updateTask(tIdx, "tags", [...(task.tags || []), v]);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === ",") {
                                  e.preventDefault();
                                  const v = (e.target as HTMLInputElement).value.trim();
                                  if (v) {
                                    updateTask(tIdx, "tags", [...(task.tags || []), v]);
                                    (e.target as HTMLInputElement).value = "";
                                  }
                                }
                              }}
                              className="h-6 w-20 text-[11px] bg-secondary/40"
                              placeholder="+ tag"
                            />
                            {/* Due date */}
                            <CxDatePickerPopover
                              value={task.dueDate ?? null}
                              onChange={(v) => updateTask(tIdx, "dueDate", v)}
                            >
                              <button
                                type="button"
                                className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md px-2 py-0.5 text-[10px]"
                                title="Due date"
                              >
                                <Calendar className="h-3 w-3" />
                                <span>{task.dueDate ? task.dueDate : "Set due"}</span>
                              </button>
                            </CxDatePickerPopover>
                            {/* End date */}
                            <CxDatePickerPopover
                              value={task.endDate ?? null}
                              onChange={(v) => {
                                if (v && task.dueDate && v < task.dueDate) {
                                  toast.error("End date must be on or after the due date");
                                  return;
                                }
                                updateTask(tIdx, "endDate", v);
                              }}
                            >
                              <button
                                type="button"
                                className="flex items-center gap-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 rounded-md px-2 py-0.5 text-[10px]"
                                title="End date"
                              >
                                <Calendar className="h-3 w-3" />
                                <span>{task.endDate ? task.endDate : "Set end"}</span>
                              </button>
                            </CxDatePickerPopover>
                            {/* Hours chip */}
                            <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md px-2 py-0.5">
                              <Clock className="h-3 w-3" />
                              <input
                                type="number"
                                value={task.estimatedHours ?? ""}
                                onChange={(e) => updateTask(tIdx, "estimatedHours", e.target.value === "" ? undefined : Number(e.target.value))}
                                className="w-10 h-5 text-[10px] bg-transparent border-0 focus:outline-none text-center"
                                placeholder="0"
                              />
                              <span className="text-[10px]">hrs</span>
                            </div>
                            {/* Urgency chip */}
                            <div className="flex items-center gap-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-md px-2 py-0.5">
                              <Flag className="h-3 w-3" />
                              <select
                                value={task.urgency ?? "Medium"}
                                onChange={(e) => updateTask(tIdx, "urgency", e.target.value)}
                                className="text-[10px] bg-transparent border-0 focus:outline-none"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moveTask(tIdx, -1)} disabled={tIdx === 0}><ArrowUp className="h-3 w-3" /></Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moveTask(tIdx, 1)} disabled={tIdx === currentPhase.tasks.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                          <Button variant="outline" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeTask(tIdx)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={addTask}
                      className="w-full border-2 border-dashed border-border rounded-lg py-2.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add another task
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Saved templates + actions */}
          <div className="border-t border-border px-5 py-3 space-y-3 bg-secondary/10">
            {savedTemplates.length > 0 && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Saved Templates</Label>
                <div className="flex flex-wrap gap-2">
                  {savedTemplates.map(t => (
                    <div key={t.id} className="flex items-center gap-1 border border-border rounded-lg px-2 py-1 text-xs bg-secondary/30">
                      <button onClick={() => handleLoadTemplate(t)} className="hover:text-primary font-medium">{t.name}</button>
                      {currentUserId && t.createdBy === currentUserId && (
                        <button onClick={() => handleDeleteTemplate(t)} title="Delete template" className="text-destructive/50 hover:text-destructive ml-1"><Trash2 className="h-3 w-3" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSaveDialogOpen(true)}>
                  <Save className="h-3.5 w-3.5" /> Save as Template
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  setPhases(JSON.parse(JSON.stringify(ONBOARDING_PHASES)));
                  setSelectedPhaseIdx(0);
                  setCheckedPhaseIdxs(new Set());
                  toast.success("Reset to default Template v1");
                }}>
                  Reset to Default
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button
                  variant="outline"
                  onClick={() => { onSeed(phases, { onlyPhaseIdx: selectedPhaseIdx }); onOpenChange(false); }}
                  className="gap-1.5"
                  disabled={!currentPhase || currentPhase.tasks.length === 0}
                  title="Seed only the currently selected phase"
                >
                  <Plus className="h-3.5 w-3.5" /> Seed This Phase
                </Button>
                <Button onClick={handleSeedAll} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> {seedLabel}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save template name dialog */}
      <AlertDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Template</AlertDialogTitle>
            <AlertDialogDescription>Give this template a name to save it for reuse across deals.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Template name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveTemplate} disabled={!saveName.trim()}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface Props {
  tasks: DealTask[];
  dealId: string;
  deal: any;
  assignees: { id: string; name: string; staffed?: boolean; designation?: string }[];
  onAdd: (task: Omit<DealTask, "id">) => void;
  onAddBulk: (tasks: Omit<DealTask, "id">[]) => void;
  onUpdate: (id: string, updates: Partial<DealTask>) => void;
  onDelete: (id: string) => void;
}

export function PhaseTasksView({ tasks, dealId, deal, assignees, onAdd, onAddBulk, onUpdate, onDelete }: Props) {
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const [editTask, setEditTask] = useState<DealTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Custom phases the user adds inline. Persist to a task only once a task is
  // created in that phase; until then the phase lives in component state.
  const [customPhases, setCustomPhases] = useState<string[]>([]);
  const [renamingPhase, setRenamingPhase] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Tasks with no phase land in a synthetic "General" bucket so ad-hoc tasks
  // (created from Home, RGY Health, etc.) remain visible in the deal Tasks tab.
  const GENERAL_PHASE = "General";
  const phaseTasks = useMemo(
    () => tasks.map(t => (t.phase && t.phase !== "" ? t : { ...t, phase: GENERAL_PHASE })),
    [tasks]
  );
  const hasPhaseData = phaseTasks.length > 0;
  // Re-evaluate empty state when no seeded phase remains (e.g. user deleted all)

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const map: Record<string, DealTask[]> = {};
    ONBOARDING_PHASES.forEach(p => { map[p.phase] = []; });
    MANDATORY_PHASES.forEach(p => { map[p] = []; });
    map[GENERAL_PHASE] = [];
    phaseTasks.forEach(t => {
      const key = t.phase || GENERAL_PHASE;
      if (map[key]) map[key].push(t);
      else map[key] = [t];
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

  // Seed from template editor
  const handleSeedFromEditor = useCallback((phases: PhaseTemplate[], opts?: { onlyPhaseIdx?: number; onlyPhaseIdxs?: number[] }) => {
    let targetPhases: PhaseTemplate[];
    if (opts?.onlyPhaseIdxs && opts.onlyPhaseIdxs.length > 0) {
      targetPhases = opts.onlyPhaseIdxs.map(i => phases[i]).filter(Boolean) as PhaseTemplate[];
    } else if (typeof opts?.onlyPhaseIdx === "number") {
      targetPhases = [phases[opts.onlyPhaseIdx]].filter(Boolean) as PhaseTemplate[];
    } else {
      targetPhases = phases;
    }
    const rows: Omit<DealTask, "id">[] = [];
    let sortIdx = 0;
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    targetPhases.forEach(phase => {
      phase.tasks.forEach(t => {
        // Prefer explicit dueDate/endDate set in the editor; fall back to
        // legacy dayStart/dayEnd offsets for templates saved before this UI change.
        let startDate: string | undefined = t.dueDate || undefined;
        let endDate: string | undefined = t.endDate || undefined;
        if (!startDate && typeof t.dayStart === "number") {
          const s = new Date(today); s.setDate(s.getDate() + t.dayStart);
          startDate = fmt(s);
        }
        if (!endDate && typeof t.dayEnd === "number") {
          const e = new Date(today); e.setDate(e.getDate() + t.dayEnd);
          endDate = fmt(e);
        }
        const assigneeName = t.assigneeUserName || resolveAssignee(t.assigneeRole, deal);
        rows.push({
          dealId,
          title: t.title,
          description: t.description,
          stage: "To Do",
          assignee: assigneeName,
          urgency: t.urgency || "Medium",
          loggedHours: 0,
          sortOrder: sortIdx++,
          estimatedHours: t.estimatedHours || 0,
          subtasks: [],
          phase: phase.phase,
          tags: t.tags,
          startDate,
          endDate,
        });
      });
    });
    onAddBulk(rows);
    toast.success(`Seeded ${rows.length} task${rows.length !== 1 ? "s" : ""} across ${targetPhases.length} phase${targetPhases.length !== 1 ? "s" : ""}`);
  }, [dealId, deal, onAddBulk]);

  // Handle marking task done with per-task auto-regen
  const handleStageChange = useCallback((taskId: string, newStage: string) => {
    // Auto-regen is handled centrally by the parent updateTask hook so a
    // recurring task doesn't get inserted twice.
    onUpdate(taskId, { stage: newStage });
  }, [onUpdate]);

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId);
      toast.success("Task deleted");
      setDeleteConfirmId(null);
    }
  };

  const handleEditSubmit = (data: TaskData) => {
    if (!editTask) return;
    const list = (data.assignees && data.assignees.length)
      ? data.assignees
      : (data.assignee ? [data.assignee] : []);
    onUpdate(editTask.id, {
      title: data.title,
      description: data.description,
      stage: data.stage,
      assignee: list[0] || "",
      assignees: list,
      startDate: data.startDate,
      endDate: data.endDate,
      urgency: data.urgency,
      estimatedHours: data.estimatedHours || 0,
      subtasks: data.subtasks || [],
      autoRegen: data.autoRegen || false,
    } as any);
    setEditTask(null);
  };

  const handleCreateSubmit = (data: TaskData) => {
    const list = (data.assignees && data.assignees.length)
      ? data.assignees
      : (data.assignee ? [data.assignee] : []);
    onAdd({
      dealId,
      title: data.title,
      description: data.description,
      stage: data.stage,
      assignee: list[0] || "",
      assignees: list,
      startDate: data.startDate,
      endDate: data.endDate,
      urgency: data.urgency,
      loggedHours: 0,
      sortOrder: (tasksByPhase[activePhase]?.length || 0),
      estimatedHours: data.estimatedHours || 0,
      subtasks: data.subtasks || [],
      phase: activePhase,
      tags: [],
      autoRegen: data.autoRegen || false,
    } as any);
  };

  // Tasks to display (with search filter applied)
  const baseTasks = showAll ? phaseTasks : (tasksByPhase[activePhase] || []);
  const visibleTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseTasks;
    return baseTasks.filter(t =>
      (t.title || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.assignee || "").toLowerCase().includes(q) ||
      (t.phase || "").toLowerCase().includes(q) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }, [baseTasks, searchQuery]);

  // Get unique phases that actually have seeded tasks. Order: by the order
  // they appear in ONBOARDING_PHASES, then mandatory generators, then any
  // ad-hoc phases (including General), preserving discovery order.
  const allPhases = useMemo(() => {
    const present = new Set<string>();
    phaseTasks.forEach(t => { if (t.phase) present.add(t.phase); });
    const ordered: string[] = [];
    ONBOARDING_PHASES.forEach(p => { if (present.has(p.phase)) { ordered.push(p.phase); present.delete(p.phase); } });
    MANDATORY_PHASES.forEach(p => { if (present.has(p)) { ordered.push(p); present.delete(p); } });
    // Anything left (custom phases, General) — keep insertion order
    phaseTasks.forEach(t => {
      if (t.phase && present.has(t.phase)) { ordered.push(t.phase); present.delete(t.phase); }
    });
    // Append user-added custom phases that don't yet have any tasks.
    customPhases.forEach(p => { if (!ordered.includes(p)) ordered.push(p); });
    return ordered;
  }, [phaseTasks, customPhases]);

  // Phase deletion confirmation state
  const [deletePhaseName, setDeletePhaseName] = useState<string | null>(null);
  const isPhaseDeletable = (name: string) => !(MANDATORY_PHASES as readonly string[]).includes(name);
  const handleDeletePhase = useCallback(async () => {
    const name = deletePhaseName;
    if (!name) return;
    const targetIds = (tasksByPhase[name] || []).map(t => t.id);
    try {
      const { error } = await supabase
        .from("deal_tasks")
        .delete()
        .eq("deal_id", dealId)
        .eq("phase", name);
      if (error) throw error;
      // Optimistically remove from local list via onDelete (parent state)
      targetIds.forEach(id => onDelete(id));
      toast.success(`Deleted phase "${name}" and ${targetIds.length} task${targetIds.length === 1 ? "" : "s"}`);
      if (selectedPhase === name) {
        setSelectedPhase(null);
        setShowAll(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete phase");
    } finally {
      setDeletePhaseName(null);
    }
  }, [deletePhaseName, tasksByPhase, dealId, onDelete, selectedPhase]);

  if (!hasPhaseData) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold mb-2">Onboarding Tasks</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Seed the onboarding task template to create phase-based tasks for this deal.
            You can customize phases and tasks before seeding.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setTemplateEditorOpen(true)} className="gap-2">
              <Settings2 className="h-4 w-4" /> Customize & Seed Template
            </Button>
          </div>
        </div>
        <TemplateEditorDialog
          open={templateEditorOpen}
          onOpenChange={setTemplateEditorOpen}
          initialPhases={ONBOARDING_PHASES}
          assignees={assignees}
          onSeed={handleSeedFromEditor}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex gap-4 h-[calc(100vh-280px)] min-h-[500px] overflow-hidden">
      {/* ── Left Pane: Phase Navigation ── */}
      <div className="w-64 shrink-0 border border-border rounded-xl bg-card overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-secondary/30">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phases</p>
        </div>
        <div className="overflow-y-auto flex-1">
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

          {allPhases.map(phaseName => {
            const pts = tasksByPhase[phaseName] || [];
            const doneCount = pts.filter(t => t.stage === "Done").length;
            const isActive = !showAll && activePhase === phaseName;
            const isComplete = pts.length > 0 && doneCount === pts.length;
            const canDelete = isPhaseDeletable(phaseName);

            return (
              <div
                key={phaseName}
                className={cn(
                  "group relative border-b border-border/50 transition-colors hover:bg-secondary/40",
                  isActive && "bg-primary/10 border-l-2 border-l-primary"
                )}
              >
                <button
                  onClick={() => {
                    if (isActive && !showAll) {
                      setShowAll(true);
                      setSelectedPhase(null);
                    } else {
                      setShowAll(false);
                      setSelectedPhase(phaseName);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm",
                    isActive && "font-medium"
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      {isComplete ? (
                        <Check className="h-3.5 w-3.5 text-positive shrink-0" />
                      ) : (
                        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isActive && "rotate-90")} />
                      )}
                      <span className="truncate">{phaseName}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 pr-5">
                      {doneCount}/{pts.length}
                    </span>
                  </span>
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeletePhaseName(phaseName); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title={`Delete phase "${phaseName}"`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Pane: Tasks ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-base font-semibold">{showAll ? "All Tasks" : activePhase}</h3>
            <p className="text-xs text-muted-foreground">{visibleTasks.length} task{visibleTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="h-8 w-56 text-[12px]"
            />
            {/* View toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground")}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={cn("p-1.5 transition-colors", viewMode === "kanban" ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground")}
                title="Kanban view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTemplateEditorOpen(true)}>
              <Settings2 className="h-3.5 w-3.5" /> Seed from Template
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">

        {/* Task Views */}
        {viewMode === "kanban" ? (
          <TaskKanban
            tasks={visibleTasks}
            dealId={dealId}
            assignees={assignees}
            onAdd={(task) => onAdd({ ...task, phase: showAll ? "" : activePhase })}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ) : visibleTasks.length > 0 ? (
          <div className="space-y-2">
            {visibleTasks.map(task => (
              <div
                key={task.id}
                onClick={() => setEditTask(task)}
                className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow cursor-pointer"
              >
                {/* Checkbox */}
                <Checkbox
                  checked={task.stage === "Done"}
                  onCheckedChange={(checked) => {
                    handleStageChange(task.id, checked ? "Done" : "To Do");
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5"
                />

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-sm font-medium", task.stage === "Done" && "line-through text-muted-foreground")}>{task.title}</span>
                    <span className={cn("w-2 h-2 rounded-full shrink-0", STAGE_DOT[task.stage] || "bg-muted-foreground")} title={task.stage} />
                    {task.autoRegen && (
                      <span title="Auto-regenerate ON"><RefreshCw className="h-3 w-3 text-primary shrink-0" /></span>
                    )}
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
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      onUpdate(task.id, { autoRegen: !task.autoRegen });
                      toast.info(task.autoRegen ? "Auto-regenerate OFF" : "Auto-regenerate ON for this task");
                    }}
                    className={cn("p-1.5 rounded transition-colors", task.autoRegen ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground")}
                    title={task.autoRegen ? "Auto-regen ON — click to turn OFF" : "Auto-regen OFF — click to turn ON"}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
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
            autoRegen: editTask.autoRegen || false,
          }}
          title="Edit Task"
          headerSubtitle={
            deal
              ? `Client: ${deal.account || "—"} · Deal: ${deal.dealName || deal.deal_name || "—"}`
              : undefined
          }
          createdAt={(editTask as any).createdAt}
          createdByName={(editTask as any).createdByName}
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

      {/* Template Editor (also accessible when tasks already exist) */}
      <TemplateEditorDialog
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        initialPhases={ONBOARDING_PHASES}
        assignees={assignees}
        onSeed={handleSeedFromEditor}
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

      {/* Delete Phase Confirmation */}
      <AlertDialog open={!!deletePhaseName} onOpenChange={(open) => !open && setDeletePhaseName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Phase</AlertDialogTitle>
            <AlertDialogDescription>
              {deletePhaseName && (
                <>Remove phase <span className="font-medium">"{deletePhaseName}"</span> and all{" "}
                {(tasksByPhase[deletePhaseName] || []).length} task
                {(tasksByPhase[deletePhaseName] || []).length === 1 ? "" : "s"} in it?
                You can re-seed it from a template afterwards.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Phase</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
