import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Plus, Trash2, Pencil, RefreshCw, Tag, List, LayoutGrid, GripVertical, Save, Copy, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { TaskFormDialog, type TaskData } from "./TaskFormDialog";
import { TaskKanban, type DealTask } from "./TaskKanban";
import { supabase } from "@/integrations/supabase/client";
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
  return "";
}

// ── Saved Template type ──
interface SavedTemplate {
  id: string;
  name: string;
  phases: PhaseTemplate[];
  createdBy?: string | null;
}

// ── Template Editor Dialog ──
function TemplateEditorDialog({
  open,
  onOpenChange,
  initialPhases,
  onSeed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhases: PhaseTemplate[];
  onSeed: (phases: PhaseTemplate[], opts?: { onlyPhaseIdx?: number }) => void;
}) {
  const [phases, setPhases] = useState<PhaseTemplate[]>(() => JSON.parse(JSON.stringify(initialPhases)));
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Template Editor</DialogTitle>
            <DialogDescription>Customize phases and tasks before seeding. You can also save this as a reusable template.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
            {/* Left: phases list */}
            <div className="w-56 shrink-0 border border-border rounded-lg overflow-hidden flex flex-col">
              <div className="p-2 border-b border-border bg-secondary/30 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phases</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={addPhase}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="overflow-y-auto flex-1">
                {phases.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPhaseIdx(idx)}
                    className={cn(
                      "px-2 py-2 text-xs border-b border-border/50 cursor-pointer hover:bg-secondary/40 flex items-center gap-1",
                      selectedPhaseIdx === idx && "bg-primary/10 border-l-2 border-l-primary font-medium"
                    )}
                  >
                    <span className="flex-1 truncate">{p.phase || "Untitled"}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{p.tasks.length}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: phase details + tasks */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {currentPhase && (
                <>
                  {/* Phase name + actions */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={currentPhase.phase}
                      onChange={(e) => updatePhaseName(selectedPhaseIdx, e.target.value)}
                      className="h-8 text-sm font-medium flex-1"
                      placeholder="Phase name"
                    />
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => movePhase(selectedPhaseIdx, -1)} disabled={selectedPhaseIdx === 0}>↑</Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => movePhase(selectedPhaseIdx, 1)} disabled={selectedPhaseIdx === phases.length - 1}>↓</Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive" onClick={() => removePhase(selectedPhaseIdx)} disabled={phases.length <= 1}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasks ({currentPhase.tasks.length})</Label>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addTask}>
                        <Plus className="h-3 w-3" /> Add Task
                      </Button>
                    </div>

                    {currentPhase.tasks.map((task, tIdx) => (
                      <div key={tIdx} className="border border-border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-center gap-2">
                          <Input
                            value={task.title}
                            onChange={(e) => updateTask(tIdx, "title", e.target.value)}
                            className="h-7 text-sm flex-1"
                            placeholder="Task title"
                          />
                          <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => moveTask(tIdx, -1)} disabled={tIdx === 0}>↑</Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => moveTask(tIdx, 1)} disabled={tIdx === currentPhase.tasks.length - 1}>↓</Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-destructive" onClick={() => removeTask(tIdx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          value={task.description}
                          onChange={(e) => updateTask(tIdx, "description", e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Description"
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            value={task.assigneeRole}
                            onChange={(e) => updateTask(tIdx, "assigneeRole", e.target.value)}
                            className="h-7 text-xs w-36"
                            placeholder="Assignee role (e.g. VSD)"
                          />
                          <Input
                            value={(task.tags || []).join(", ")}
                            onChange={(e) => updateTask(tIdx, "tags", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                            className="h-7 text-xs flex-1"
                            placeholder="Tags (comma-separated)"
                          />
                        </div>
                      </div>
                    ))}

                    {currentPhase.tasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No tasks in this phase. Click "Add Task" to add one.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Saved templates + actions */}
          <div className="border-t border-border pt-3 space-y-3">
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
                <Button onClick={() => { onSeed(phases); onOpenChange(false); }} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Seed Tasks
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

  // Tasks with no phase land in a synthetic "General" bucket so ad-hoc tasks
  // (created from Home, RGY Health, etc.) remain visible in the deal Tasks tab.
  const GENERAL_PHASE = "General";
  const phaseTasks = useMemo(
    () => tasks.map(t => (t.phase && t.phase !== "" ? t : { ...t, phase: GENERAL_PHASE })),
    [tasks]
  );
  const hasPhaseData = phaseTasks.length > 0;

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const map: Record<string, DealTask[]> = {};
    ONBOARDING_PHASES.forEach(p => { map[p.phase] = []; });
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
  const handleSeedFromEditor = useCallback((phases: PhaseTemplate[]) => {
    const rows: Omit<DealTask, "id">[] = [];
    let sortIdx = 0;
    phases.forEach(phase => {
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
    toast.success(`Seeded ${rows.length} tasks across ${phases.length} phases`);
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

  // Get all unique phases from tasks (for dynamic phase list)
  const allPhases = useMemo(() => {
    const phaseNames = ONBOARDING_PHASES.map(p => p.phase);
    phaseTasks.forEach(t => {
      if (t.phase && !phaseNames.includes(t.phase)) phaseNames.push(t.phase);
    });
    if ((tasksByPhase[GENERAL_PHASE]?.length || 0) > 0 && !phaseNames.includes(GENERAL_PHASE)) {
      phaseNames.push(GENERAL_PHASE);
    }
    return phaseNames;
  }, [phaseTasks, tasksByPhase]);

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

            return (
              <button
                key={phaseName}
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
                    <span className="truncate">{phaseName}</span>
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
