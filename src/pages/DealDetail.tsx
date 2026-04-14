import { AppLayout } from "@/components/layout/AppLayout";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, Check, X, Calendar, Users, Eye, Edit2, ExternalLink, AlertTriangle, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import React, { useState, useMemo, useCallback } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { uid } from "@/data/staffingData";
import type { StaffingAssignment, Person, Deal, RoleCategory } from "@/data/staffingData";
import { useDealDetail } from "@/hooks/useDealDetail";
import { EditableRGY } from "@/components/deals/EditableRGY";
import { FinancialsTab } from "@/components/deals/FinancialsTab";
import { TaskKanban } from "@/components/deals/TaskKanban";
import { MBRInputDrawer } from "@/components/mbr/MBRInputDrawer";
import { MBRDetailDialog } from "@/components/mbr/MBRDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import type { RGYWeekly } from "@/hooks/useDealDetail";
import { toast } from "sonner";
import { getWeekOptions } from "@/hooks/useMBRData";
import type { MBREntry } from "@/hooks/useMBRData";

const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const fmtDate = (d: string | undefined) => {
  if (!d) return "Not set";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
};

const TABS = ["Overview", "Staffing", "Financials", "Tasks", "RGY Health", "MBR", "Onboarding"] as const;
type TabKey = typeof TABS[number];

const rgyColors: Record<string, string> = { G: "rgy-green", R: "rgy-red", Y: "rgy-yellow" };

// ── Editable Cell ──
function EditableCell({ value, onSave, type = "text", prefix = "", placeholder = "—" }: { value: string; onSave: (v: string) => void; type?: string; prefix?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={local} onChange={e => setLocal(e.target.value)} type={type} className="h-7 text-sm w-full" autoFocus onKeyDown={e => { if (e.key === "Enter") { onSave(local); setEditing(false); } if (e.key === "Escape") { setLocal(value); setEditing(false); } }} />
        <button onClick={() => { onSave(local); setEditing(false); }} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={() => { setLocal(value); setEditing(false); }} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5 cursor-pointer" onClick={() => setEditing(true)}>
      <span className={cn("text-sm font-medium", value ? "text-foreground" : "text-muted-foreground")}>{prefix}{value || placeholder}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ── Financial Metric Card ──
function FinancialMetricCard({ label, value, subLabel, onSave }: { label: string; value: string; subLabel: string; onSave: (v: string) => void }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <EditableCell value={value} onSave={onSave} type="number" prefix="₹" placeholder="—" />
      <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>
    </div>
  );
}

// ── Team Member Select (dropdown from staffing people) ──
function TeamMemberSelect({ currentName, role, color, people, onSelect }: {
  currentName: string; role: string; color: string; people: { id: string; name: string; roleTitle: string }[]; onSelect: (name: string) => void;
}) {
  const initials = currentName && currentName !== "Not assigned"
    ? currentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0", color)}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <Select value={currentName || "_none"} onValueChange={v => v !== "_none" && onSelect(v)}>
          <SelectTrigger className="h-7 text-sm border-none bg-transparent shadow-none px-0 focus:ring-0">
            <SelectValue placeholder="Not assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none" className="text-xs text-muted-foreground">— Not assigned —</SelectItem>
            {people.map(p => (
              <SelectItem key={p.id} value={p.name} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{role}</span>
    </div>
  );
}

// ── Add Staffing Member Dialog ──
const ROLE_CATEGORIES: RoleCategory[] = ["Operations", "SEO", "Content", "Content Strategy", "Creative Strategy", "Creative Art", "Creative Copy", "Video", "Performance & Growth"];

function AddStaffingMemberDialog({
  open, onOpenChange, people, assignments, deals, dealId, onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  people: Person[];
  assignments: StaffingAssignment[];
  deals: Deal[];
  dealId: string;
  onAdd: (assignment: StaffingAssignment) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCategory, setSelectedCategory] = useState<RoleCategory | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [allocationPct, setAllocationPct] = useState(10);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [roleOnDeal, setRoleOnDeal] = useState("");
  const [assignmentType, setAssignmentType] = useState<"Internal" | "External" | "Freelance">("Internal");
  const [expandedOpsGroup, setExpandedOpsGroup] = useState<string | null>(null);
  const alreadyAssigned = useMemo(() => new Set(assignments.filter(a => a.dealId === dealId).map(a => a.personId)), [assignments, dealId]);

  const filteredPeople = useMemo(() => {
    if (!selectedCategory) return [];
    return people.filter(p => p.roleCategory === selectedCategory && !alreadyAssigned.has(p.id));
  }, [people, selectedCategory, alreadyAssigned]);

  const getPersonUtilization = useCallback((personId: string) => {
    const personAssignments = assignments.filter(a => a.personId === personId);
    const total = personAssignments.reduce((s, a) => s + a.allocationPct, 0);
    return { total, assignments: personAssignments };
  }, [assignments]);

  const getDealName = useCallback((dId: string) => {
    const d = deals.find(x => x.id === dId);
    return d ? `${d.account} — ${d.dealName}` : dId;
  }, [deals]);

  const reset = () => { setStep(1); setSelectedCategory(null); setSelectedPerson(null); setAllocationPct(10); setExpandedPerson(null); setRoleOnDeal(""); setAssignmentType("Internal"); setExpandedOpsGroup(null); };

  const handleConfirm = () => {
    if (!selectedPerson) return;
    onAdd({
      id: uid(),
      dealId,
      roleKey: roleOnDeal || selectedPerson.roleTitle || selectedPerson.roleCategory,
      personId: selectedPerson.id,
      allocationPct,
    });
    toast.success(`${selectedPerson.name} added at ${allocationPct}%`);
    reset();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {step === 1 && "Select Team"}
            {step === 2 && `Select Member — ${selectedCategory}`}
            {step === 3 && `Set Allocation — ${selectedPerson?.name}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1 && "Choose a team/capability to browse available members."}
            {step === 2 && "Pick a team member to assign. Click the arrow to see their current deals."}
            {step === 3 && "Set the allocation percentage for this deal."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-2">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {ROLE_CATEGORIES.map(cat => {
                const count = people.filter(p => p.roleCategory === cat && !alreadyAssigned.has(p.id)).length;
                return (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setStep(2); }}
                    className="rounded-lg border border-border p-3 text-left hover:bg-accent/20 transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{cat}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{count} available</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <>
              {filteredPeople.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No available members in {selectedCategory}.</p>
              ) : selectedCategory === "Operations" ? (
                // Group Operations by roleTitle
                (() => {
                  const OPS_GROUPS = ["VSD", "Principal BOPM", "Senior BOPM", "BOPM"];
                  const grouped: Record<string, Person[]> = {};
                  const otherOps: Person[] = [];
                  filteredPeople.forEach(p => {
                    const matchedGroup = OPS_GROUPS.find(g => (p.roleTitle || "").toLowerCase().includes(g.toLowerCase()));
                    if (matchedGroup) {
                      if (!grouped[matchedGroup]) grouped[matchedGroup] = [];
                      grouped[matchedGroup].push(p);
                    } else {
                      otherOps.push(p);
                    }
                  });
                  const allGroups = [...OPS_GROUPS.filter(g => grouped[g]?.length), ...(otherOps.length ? ["Other"] : [])];
                  if (otherOps.length) grouped["Other"] = otherOps;

                  return allGroups.map(group => (
                    <div key={group} className="border border-border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-3 hover:bg-accent/10 transition-colors"
                        onClick={() => setExpandedOpsGroup(expandedOpsGroup === group ? null : group)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{group}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{grouped[group].length}</Badge>
                        </div>
                        {expandedOpsGroup === group ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {expandedOpsGroup === group && (
                        <div className="border-t border-border/50">
                          {grouped[group].map(p => {
                            const util = getPersonUtilization(p.id);
                            const utilColor = util.total > 100 ? "text-destructive" : util.total >= 80 ? "text-warning" : "text-positive";
                            return (
                              <div
                                key={p.id}
                                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/10 border-b border-border/30 last:border-b-0"
                                onClick={() => { setSelectedPerson(p); setRoleOnDeal(p.roleTitle || p.roleCategory); setStep(3); }}
                              >
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                  {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                                    {p.tbh && <Badge variant="outline" className="text-[10px] px-1 py-0 text-warning border-warning/30">TBH</Badge>}
                                    {p.leaving && <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30">Leaving</Badge>}
                                  </div>
                                  <span className="text-xs text-muted-foreground">{p.pod} · {p.region}</span>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className={cn("text-sm font-mono font-medium", utilColor)}>{util.total}%</span>
                                  <span className="block text-[10px] text-muted-foreground">{util.assignments.length} deal{util.assignments.length !== 1 ? "s" : ""}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ));
                })()
              ) : (
                filteredPeople.map(p => {
                  const util = getPersonUtilization(p.id);
                  const isExpanded = expandedPerson === p.id;
                  const utilColor = util.total > 100 ? "text-destructive" : util.total >= 80 ? "text-warning" : "text-positive";
                  return (
                    <div key={p.id} className="border border-border rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/10"
                        onClick={() => { setSelectedPerson(p); setRoleOnDeal(p.roleTitle || p.roleCategory); setStep(3); }}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                          {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                            {p.tbh && <Badge variant="outline" className="text-[10px] px-1 py-0 text-warning border-warning/30">TBH</Badge>}
                            {p.leaving && <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30">Leaving</Badge>}
                          </div>
                          <span className="text-xs text-muted-foreground">{p.roleTitle} · {p.pod} · {p.region}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn("text-sm font-mono font-medium", utilColor)}>{util.total}%</span>
                          <span className="block text-[10px] text-muted-foreground">{util.assignments.length} deal{util.assignments.length !== 1 ? "s" : ""}</span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedPerson(isExpanded ? null : p.id); }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 border-t border-border/50 bg-accent/5">
                          <div className="pt-2">
                            <Progress value={Math.min(util.total, 100)} className="h-2 mb-2" />
                            {util.assignments.length > 0 ? (
                              <div className="space-y-1">
                                {util.assignments.map(a => (
                                  <div key={a.id} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground truncate mr-2">{getDealName(a.dealId)}</span>
                                    <span className="font-mono text-foreground shrink-0">{a.allocationPct}%</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No current assignments</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory(null); setStep(1); setExpandedOpsGroup(null); }} className="mt-2">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to teams
              </Button>
            </>
          )}

          {step === 3 && selectedPerson && (() => {
            const util = getPersonUtilization(selectedPerson.id);
            const freeCapacity = Math.max(0, 100 - util.total);
            const newTotal = util.total + allocationPct;
            const capacityColor = freeCapacity <= 0 ? "text-destructive" : freeCapacity <= 20 ? "text-warning" : "text-positive";

            return (
              <div className="space-y-4">
                {/* Person header */}
                <div className="rounded-lg bg-secondary/50 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                    {selectedPerson.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedPerson.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPerson.roleTitle} · {selectedPerson.pod} · {selectedPerson.region}</p>
                  </div>
                </div>

                {/* Current engagements */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-secondary/30">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Current Engagements</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-medium text-foreground">{util.total}% allocated</span>
                      <span className="text-muted-foreground">·</span>
                      <span className={cn("font-mono font-medium", capacityColor)}>{freeCapacity}% free</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <Progress value={Math.min(util.total, 100)} className="h-2 mb-3" />
                    {util.assignments.length > 0 ? (
                      <div className="space-y-2.5">
                        {util.assignments.map(a => {
                          const assignDeal = deals.find(d => d.id === a.dealId);
                          return (
                            <div key={a.id} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-foreground truncate block">{getDealName(a.dealId)}</span>
                                <span className="text-[10px] text-muted-foreground">{a.roleKey}</span>
                              </div>
                              <div className="w-20 shrink-0">
                                <Progress value={a.allocationPct} className="h-1.5" />
                              </div>
                              <span className="text-xs font-mono text-foreground w-10 text-right shrink-0">{a.allocationPct}%</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-positive border-positive/30 shrink-0">
                                {assignDeal?.dealStatus === "Deal Completed Successfully" ? "Completed" : "Active"}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">No current assignments — fully available</p>
                    )}
                  </div>
                </div>

                {/* Capacity warning */}
                {util.total >= 100 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">This person is already at {util.total}% capacity across other deals. Adding them may exceed 100%.</p>
                  </div>
                )}

                {/* Role on this deal */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role on this deal</label>
                  <Input
                    value={roleOnDeal}
                    onChange={e => setRoleOnDeal(e.target.value)}
                    placeholder="e.g. Senior BOPM"
                    className="h-8 text-sm"
                  />
                </div>

                {/* Allocation + Type row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Allocation %</label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={allocationPct}
                      onChange={e => setAllocationPct(Math.max(1, Math.min(100, Number(e.target.value) || 0)))}
                      className="h-8 text-sm"
                    />
                    {newTotal > 100 && (
                      <p className="text-[10px] text-warning mt-1">⚠ Total will be {newTotal}%</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                    <Select value={assignmentType} onValueChange={v => setAssignmentType(v as any)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Internal">Internal</SelectItem>
                        <SelectItem value="External">External</SelectItem>
                        <SelectItem value="Freelance">Freelance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button variant="ghost" size="sm" onClick={() => { setSelectedPerson(null); setStep(2); }}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to members
                </Button>
              </div>
            );
          })()}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={reset}>Cancel</AlertDialogCancel>
          {step === 3 && <AlertDialogAction onClick={handleConfirm}>Add to Plan</AlertDialogAction>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


function DealMBRTab({ deal, dealId, mbrEntries, upsertMBREntry }: {
  deal: any;
  dealId: string;
  mbrEntries: MBREntry[];
  upsertMBREntry: (params: any, weekStart: string) => Promise<void>;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MBREntry | null>(null);
  const [viewEntry, setViewEntry] = useState<MBREntry | null>(null);

  const weekOptions = getWeekOptions();
  const currentWeek = weekOptions.find(w => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    return w.value === monday.toISOString().split("T")[0];
  })?.value || weekOptions[0]?.value || "";

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const dealForDrawer = {
    id: dealId,
    account: deal.account || "",
    dealName: deal.dealName || "",
    vsd: deal.vsd || "",
    pcCode: deal.pcCode || "",
  };

  const dealForDialog = {
    id: dealId,
    pcCode: deal.pcCode || "",
    dealId: deal.dealId || "",
    account: deal.account || "",
    dealName: deal.dealName || "",
    vsd: deal.vsd || "",
    principalBopm: deal.principalBopm || "",
    seniorBopm: deal.seniorBopm || "",
    bopm: deal.bopm || "",
    customerStatus: deal.customerStatus || "",
    customerType: deal.customerType || "",
    serviceLineTagging: deal.serviceLineTagging || "",
    businessUnit: deal.businessUnit || "",
    mrr: deal.mrr || null,
    totalDealValue: deal.totalDealValue || null,
    netDealValue: deal.netDealValue || null,
  };

  const handleRowClick = (entry: MBREntry) => {
    if (entry.status === "Done") {
      setViewEntry(entry);
    } else {
      setEditingEntry(entry);
      setSelectedWeek(entry.weekStart);
      setDrawerOpen(true);
    }
  };

  const handleNewMBR = () => {
    setEditingEntry(null);
    setDrawerOpen(true);
  };

  const handleSave = (data: any) => {
    const weekToUse = data.mbrDate || selectedWeek;
    upsertMBREntry(data, weekToUse);
    toast.success("MBR entry saved");
  };

  const sentimentColors: Record<string, string> = {
    Green: "bg-positive/15 text-positive",
    Yellow: "bg-warning/15 text-warning",
    Red: "bg-destructive/15 text-destructive",
  };

  const statusColors: Record<string, string> = {
    Done: "bg-positive/15 text-positive",
    "Not Done": "bg-destructive/15 text-destructive",
    Pending: "bg-warning/15 text-warning",
    "Not Required": "bg-muted text-muted-foreground",
  };

  // Sort descending by weekStart
  const sorted = useMemo(() => [...mbrEntries].sort((a, b) => b.weekStart.localeCompare(a.weekStart)), [mbrEntries]);
  const doneEntries = useMemo(() => sorted.filter(e => e.status === "Done"), [sorted]);
  const lastDone = doneEntries[0];

  // Missing month warning
  const currentMonthLabel = format(new Date(), "MMMM yyyy");
  const currentMonthPrefix = format(new Date(), "yyyy-MM");
  const hasMBRThisMonth = doneEntries.some(e => e.weekStart.startsWith(currentMonthPrefix));

  return (
    <div className="animate-fade-in space-y-4">
      {/* Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total MBRs Done", value: String(doneEntries.length) },
          { label: "Last Sentiment", value: lastDone?.sentiment || "—", isSentiment: true },
          { label: "Next MBR Date", value: sorted[0]?.scheduledDate ? format(new Date(sorted[0].scheduledDate), "dd MMM yyyy") : "Not scheduled" },
          { label: "Last Mode", value: lastDone?.mode || "—" },
        ].map(card => (
          <div key={card.label} className="rounded-lg bg-[#E8E6DF] dark:bg-secondary/60 border-l-4 border-l-[#534AB7] p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {(card as any).isSentiment && lastDone?.sentiment ? (
                <Badge className={cn("text-xs", sentimentColors[lastDone.sentiment] || "")}>{lastDone.sentiment}</Badge>
              ) : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Missing month warning */}
      {!hasMBRThisMonth && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>No MBR recorded for {currentMonthLabel}</span>
        </div>
      )}

      {/* Next MBR scheduled banner */}
      {sorted[0]?.scheduledDate && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
          <Calendar className="h-4 w-4 shrink-0 text-primary" />
          <span>📅 Next MBR scheduled: <span className="font-semibold">{format(new Date(sorted[0].scheduledDate), "dd MMM yyyy")}</span></span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MBR History</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNewMBR}>
          <Plus className="h-3.5 w-3.5" /> Record MBR
        </Button>
      </div>

      {sorted.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/40 border-b border-border">
                {["Week", "Status", "Sentiment", "Mode", "Scheduled Date", "Next MBR", "Fathom Link", "PPT Link", "Notes", ""].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(entry => (
                <tr
                  key={entry.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer group"
                  onClick={() => handleRowClick(entry)}
                >
                  <td className="py-2.5 px-3 font-mono text-xs text-foreground">{entry.weekStart}</td>
                  <td className="py-2.5 px-3">
                    <Badge className={cn("text-xs", statusColors[entry.status] || "")}>{entry.status}</Badge>
                  </td>
                  <td className="py-2.5 px-3">
                    {entry.sentiment ? (
                      <Badge className={cn("text-xs", sentimentColors[entry.sentiment] || "")}>{entry.sentiment}</Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{entry.mode || "—"}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{entry.scheduledDate || "—"}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{entry.scheduledDate ? format(new Date(entry.scheduledDate), "dd MMM yyyy") : "—"}</td>
                  <td className="py-2.5 px-3">
                    {entry.fathomLink ? (
                      <a href={entry.fathomLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 dark:text-blue-400 font-medium hover:underline inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        Link <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    {entry.mbrPptLink ? (
                      <a href={entry.mbrPptLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 dark:text-blue-400 font-medium hover:underline inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        PPT <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[150px] truncate">{entry.notes || "—"}</td>
                  <td className="py-2.5 px-3">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {entry.status === "Done"
                        ? <Eye className="h-4 w-4 text-muted-foreground" />
                        : <Edit2 className="h-4 w-4 text-muted-foreground" />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
          <p className="text-muted-foreground mb-3">No MBR entries yet for this deal.</p>
          <Button variant="outline" onClick={handleNewMBR}>
            <Plus className="h-4 w-4 mr-1" /> Record First MBR
          </Button>
        </div>
      )}

      {drawerOpen && (
        <MBRInputDrawer
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setEditingEntry(null); }}
          deal={dealForDrawer}
          existingEntry={editingEntry}
          selectedWeek={selectedWeek}
          onSave={handleSave}
        />
      )}

      {viewEntry && (
        <MBRDetailDialog
          open={!!viewEntry}
          onClose={() => setViewEntry(null)}
          deal={dealForDialog}
          entry={viewEntry}
          onEdit={() => {
            setEditingEntry(viewEntry);
            setSelectedWeek(viewEntry.weekStart);
            setViewEntry(null);
            setDrawerOpen(true);
          }}
        />
      )}
    </div>
  );
}

// ── RGY Issue Form ──
interface RGYIssueTask {
  dimension: string;
  issueSummary: string;
  urgency: string;
  assignees: string[];
}

interface RGYIssueFormProps {
  dealId: string;
  currentRGY: RGYWeekly;
  assignees: { id: string; name: string }[];
  teamMembers: string[];
  onSaveIssue: (data: {
    issueDate: string;
    issueDetails: string;
    discussedActionPlan: string;
    actionPlan: string;
    resolutionDueDate: string;
    issueStatus: string;
    tasks: RGYIssueTask[];
  }) => Promise<void>;
  onCancel: () => void;
}

function RGYIssueForm({ dealId, currentRGY, assignees, teamMembers, onSaveIssue, onCancel }: RGYIssueFormProps) {
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [issueDetails, setIssueDetails] = useState("");
  const [discussedActionPlan, setDiscussedActionPlan] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [resolutionDueDate, setResolutionDueDate] = useState<Date | undefined>();
  const [issueStatus, setIssueStatus] = useState("Open");
  const [saving, setSaving] = useState(false);

  // Build tasks from non-green dimensions
  const nonGreenDims = [
    { key: "accountHealth", label: "Account Health", value: currentRGY.accountHealth },
    { key: "delivery", label: "Delivery", value: currentRGY.delivery },
    { key: "financeBilling", label: "Finance/Billing", value: currentRGY.financeBilling },
    { key: "capabilitySeo", label: "Capability-SEO", value: currentRGY.capabilitySeo },
    { key: "capabilityCreative", label: "Capability-Creative", value: currentRGY.capabilityCreative },
  ].filter(d => d.value === "R" || d.value === "Y");

  const [issueTasks, setIssueTasks] = useState<RGYIssueTask[]>(
    nonGreenDims.map(d => ({
      dimension: d.label,
      issueSummary: "",
      urgency: d.value === "R" ? "High" : "Medium",
      assignees: [],
    }))
  );

  const allAssigneeNames = [...new Set([
    ...assignees.map(a => a.name),
    ...teamMembers,
  ])].filter(Boolean);

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
      await onSaveIssue({
        issueDate: issueDate.toISOString().split("T")[0],
        issueDetails,
        discussedActionPlan,
        actionPlan,
        resolutionDueDate: resolutionDueDate?.toISOString().split("T")[0] || "",
        issueStatus,
        tasks: issueTasks.filter(t => t.issueSummary.trim() && t.assignees.length > 0),
      });
      setIssueDetails("");
      setDiscussedActionPlan("");
      setActionPlan("");
      setIssueTasks(nonGreenDims.map(d => ({
        dimension: d.label,
        issueSummary: "",
        urgency: d.value === "R" ? "High" : "Medium",
        assignees: [],
      })));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-semibold text-foreground">Issue Tracker — Non-Green Dimensions</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Issue Date */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Issue Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left text-sm font-normal h-9")}>
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                {format(issueDate, "dd MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="single" selected={issueDate} onSelect={d => d && setIssueDate(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {/* Resolution Due Date */}
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

        {/* Status */}
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

      {/* Issue Details */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Issue Details</label>
        <Textarea value={issueDetails} onChange={e => setIssueDetails(e.target.value)} placeholder="Describe the issue..." className="text-sm min-h-[60px]" />
      </div>

      {/* Discussed Action Plan */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Discussed Action Plan</label>
        <Textarea value={discussedActionPlan} onChange={e => setDiscussedActionPlan(e.target.value)} placeholder="What was discussed..." className="text-sm min-h-[60px]" />
      </div>

      {/* Action Plan */}
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
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Assignees (select multiple)</label>
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

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save Issue & Create Tasks
        </Button>
      </div>
    </div>
  );
}
// ── Grouped RGY History ──
function GroupedRGYHistory({ rgyWeekly }: { rgyWeekly: RGYWeekly[] }) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map: Record<string, RGYWeekly[]> = {};
    rgyWeekly.forEach(r => {
      if (!map[r.weekStart]) map[r.weekStart] = [];
      map[r.weekStart].push(r);
    });
    // Sort weeks descending
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [rgyWeekly]);

  const toggleWeek = (week: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week); else next.add(week);
      return next;
    });
  };

  const renderRow = (r: RGYWeekly, label: string, indent = false) => {
    const hasIssue = [r.accountHealth, r.delivery, r.financeBilling, r.capabilitySeo, r.capabilityCreative].some(v => v === "R" || v === "Y");
    return (
      <tr key={r.id} className={cn("border-b border-border/50 hover:bg-secondary/20 transition-colors", hasIssue && "bg-warning/5")}>
        <td className={cn("py-2 px-3 font-mono text-xs text-foreground", indent && "pl-8")}>
          {label}
          {indent && r.createdAt && (
            <span className="text-muted-foreground ml-1">
              {new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </td>
        {[r.accountHealth || "G", r.delivery || "G", r.financeBilling || "G", r.capabilitySeo || "G", r.capabilityCreative || "G"].map((val, i) => (
          <td key={i} className="py-2 px-2 text-center">
            <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold", rgyColors[val] || "rgy-na")}>{val}</span>
          </td>
        ))}
        <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{r.issueDetails || "—"}</td>
        <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{r.actionPlan || r.planOfAction || "—"}</td>
        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{r.resolutionDueDate || "—"}</td>
        <td className="py-2 px-2 text-center">
          {r.issueStatus && r.issueStatus !== "Open" ? (
            <Badge variant="outline" className={cn("text-[10px]",
              r.issueStatus === "Resolved" ? "border-positive/40 text-positive" :
              r.issueStatus === "In Progress" ? "border-primary/40 text-primary" : ""
            )}>{r.issueStatus}</Badge>
          ) : hasIssue ? (
            <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Open</Badge>
          ) : <span className="text-muted-foreground text-[10px]">—</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/40 border-b border-border">
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Week</th>
            {["Acct Health", "Delivery", "Finance", "SEO", "Creative"].map(d => (
              <th key={d} className="text-center py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">{d}</th>
            ))}
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Issue</th>
            <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Action Plan</th>
            <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Due</th>
            <th className="text-center py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([weekStart, entries]) => {
            if (entries.length === 1) {
              return renderRow(entries[0], weekStart);
            }
            const isExpanded = expandedWeeks.has(weekStart);
            const latest = entries[0]; // already sorted by created_at desc
            return (
              <React.Fragment key={weekStart}>
                <tr
                  className={cn("border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer",
                    [latest.accountHealth, latest.delivery, latest.financeBilling, latest.capabilitySeo, latest.capabilityCreative].some(v => v === "R" || v === "Y") && "bg-warning/5"
                  )}
                  onClick={() => toggleWeek(weekStart)}
                >
                  <td className="py-2 px-3 font-mono text-xs text-foreground">
                    <span className="inline-flex items-center gap-1">
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {weekStart}
                      <Badge variant="outline" className="text-[9px] ml-1">{entries.length} changes</Badge>
                    </span>
                  </td>
                  {[latest.accountHealth || "G", latest.delivery || "G", latest.financeBilling || "G", latest.capabilitySeo || "G", latest.capabilityCreative || "G"].map((val, i) => (
                    <td key={i} className="py-2 px-2 text-center">
                      <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold", rgyColors[val] || "rgy-na")}>{val}</span>
                    </td>
                  ))}
                  <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{latest.issueDetails || "—"}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{latest.actionPlan || latest.planOfAction || "—"}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{latest.resolutionDueDate || "—"}</td>
                  <td className="py-2 px-2 text-center">
                    {latest.issueStatus && latest.issueStatus !== "Open" ? (
                      <Badge variant="outline" className={cn("text-[10px]",
                        latest.issueStatus === "Resolved" ? "border-positive/40 text-positive" :
                        latest.issueStatus === "In Progress" ? "border-primary/40 text-primary" : ""
                      )}>{latest.issueStatus}</Badge>
                    ) : [latest.accountHealth, latest.delivery, latest.financeBilling, latest.capabilitySeo, latest.capabilityCreative].some(v => v === "R" || v === "Y") ? (
                      <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Open</Badge>
                    ) : <span className="text-muted-foreground text-[10px]">—</span>}
                  </td>
                </tr>
                {isExpanded && entries.slice(1).map(r => renderRow(r, "", true))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DealDetail() {
  const { dealId } = useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const { deals, people, assignments, loading: staffLoading, updateDeal, updatePerson, addAssignment, updateAssignment, deleteAssignment } = useStaffingData();
  const {
    sowItems, rgyWeekly, onboarding, financials, tasks, mbrEntries, loading: detailLoading,
    toggleOnboardingStep, addSoWItem, updateSoWItem, deleteSoWItem,
    addRGYWeek, updateRGYWeek, addFinancial, updateFinancial, deleteFinancial,
    addTask, updateTask, deleteTask, seedOnboarding, upsertMBREntry,
  } = useDealDetail(dealId);

  const deal = useMemo(() => deals.find(d => d.id === dealId), [deals, dealId]);
  const dealAssignments = useMemo(() => assignments.filter(a => a.dealId === dealId), [assignments, dealId]);
  const dealPeople = useMemo(() => {
    const personIds = new Set(dealAssignments.map(a => a.personId));
    return people.filter(p => personIds.has(p.id));
  }, [dealAssignments, people]);

  const onboardingPct = useMemo(() => {
    if (!onboarding.length) return 0;
    return Math.round((onboarding.filter(s => s.completed).length / onboarding.length) * 100);
  }, [onboarding]);

  const handleDealFieldSave = useCallback((field: string, value: string) => {
    if (!dealId) return;
    const numFields = ["mrr", "totalDealValue", "retainerDealValue", "nonRetainerDealValue", "netDealValue"];
    const v = numFields.includes(field) ? Number(value) || undefined : value;
    updateDeal(dealId, { [field]: v });
    toast.success("Updated");
  }, [dealId, updateDeal]);

  // Progress & renewal calculations
  const progressInfo = useMemo(() => {
    if (!deal?.startDate || !deal?.endDate) return null;
    const start = new Date(deal.startDate);
    const end = new Date(deal.endDate);
    const today = new Date();
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const pct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    return { pct, daysRemaining, totalDays, startLabel: fmtDate(deal.startDate), endLabel: fmtDate(deal.endDate) };
  }, [deal?.startDate, deal?.endDate]);

  // Current week's RGY for overview
  const currentRGY = useMemo(() => {
    if (rgyWeekly.length > 0) return rgyWeekly[0];
    return null;
  }, [rgyWeekly]);

  // RGY issue form visibility
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [prevRGYSnapshot, setPrevRGYSnapshot] = useState<Record<string, string> | null>(null);

  // Staffing dialog states
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<string | null>(null);
  const [editAllocationValue, setEditAllocationValue] = useState(0);
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState<string | null>(null);

  // Green-gate dialog state
  const [greenGateDialog, setGreenGateDialog] = useState<{
    pendingDims: { key: string; label: string; tasks: any[] }[];
    pendingSave: any[] | null;
  } | null>(null);

  const dimensionLabels: Record<string, string> = {
    accountHealth: "Account Health",
    delivery: "Delivery",
    financeBilling: "Finance/Billing",
    capabilitySeo: "Capability-SEO",
    capabilityCreative: "Capability-Creative",
  };

  const handleRGYSave = useCallback((dims: any[]) => {
    if (!dealId) return;

    const rgyData: Record<string, string> = {};
    const planParts: string[] = [];
    dims.forEach(d => {
      rgyData[d.key] = d.value;
      if (d.planOfAction) planParts.push(`${d.label}: ${d.planOfAction}`);
    });

    // Check green-gate: if any dimension is moving TO Green, check for open tasks
    if (currentRGY) {
      const oldValues: Record<string, string> = {
        accountHealth: currentRGY.accountHealth || "G",
        delivery: currentRGY.delivery || "G",
        financeBilling: currentRGY.financeBilling || "G",
        capabilitySeo: currentRGY.capabilitySeo || "G",
        capabilityCreative: currentRGY.capabilityCreative || "G",
      };

      const pendingGreenDims: { key: string; label: string; tasks: any[] }[] = [];
      for (const [key, newVal] of Object.entries(rgyData)) {
        const oldVal = oldValues[key];
        if (newVal === "G" && oldVal !== "G") {
          // Find open [RGY Health] tasks for this dimension
          const label = dimensionLabels[key] || key;
          const openTasks = tasks.filter(
            t => t.title.startsWith("[RGY Health]") &&
              t.title.includes(label) &&
              t.stage !== "Done" && t.stage !== "Dropped"
          );
          if (openTasks.length > 0) {
            pendingGreenDims.push({ key, label, tasks: openTasks });
          }
        }
      }

      if (pendingGreenDims.length > 0) {
        setGreenGateDialog({ pendingDims: pendingGreenDims, pendingSave: dims });
        return; // Block save
      }
    }

    // Snapshot current values before saving for potential revert
    if (currentRGY) {
      setPrevRGYSnapshot({
        accountHealth: currentRGY.accountHealth,
        delivery: currentRGY.delivery,
        financeBilling: currentRGY.financeBilling,
        capabilitySeo: currentRGY.capabilitySeo,
        capabilityCreative: currentRGY.capabilityCreative,
      });
    }

    // Always insert a new row for full history
    addRGYWeek({
      dealId,
      weekStart: (() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        return monday.toISOString().split("T")[0];
      })(),
      internal: rgyData.accountHealth || "G",
      customer: "G",
      delivery: rgyData.delivery || "G",
      consumption: "G",
      accountHealth: rgyData.accountHealth || "G",
      financeBilling: rgyData.financeBilling || "G",
      capabilitySeo: rgyData.capabilitySeo || "G",
      capabilityCreative: rgyData.capabilityCreative || "G",
      planOfAction: planParts.join("; "),
    });

    // Check if any dimension is Y or R to show issue form
    const hasYorR = Object.values(rgyData).some(v => v === "Y" || v === "R");
    setShowIssueForm(hasYorR);
    if (!hasYorR) setPrevRGYSnapshot(null);
    toast.success("RGY health saved");
  }, [dealId, currentRGY, addRGYWeek, tasks]);

  const handleForceCloseGreenGate = useCallback(async () => {
    if (!greenGateDialog) return;
    // Mark all pending tasks as Done
    for (const dim of greenGateDialog.pendingDims) {
      for (const task of dim.tasks) {
        await updateTask(task.id, { stage: "Done" });
      }
    }
    toast.success("Tasks force-closed");
    // Now retry the save
    if (greenGateDialog.pendingSave) {
      setGreenGateDialog(null);
      handleRGYSave(greenGateDialog.pendingSave);
    } else {
      setGreenGateDialog(null);
    }
  }, [greenGateDialog, updateTask, handleRGYSave]);

  // SoW add
  const [addingSoW, setAddingSoW] = useState(false);
  const [newSoW, setNewSoW] = useState({ scope: "", revenueShare: 0, teamCapability: "" });

  if (staffLoading || detailLoading) {
    return <AppLayout><div className="p-8 flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  if (!deal) {
    return <AppLayout><div className="p-8"><Link to="/clients" className="text-primary hover:underline text-sm">← Back to Clients</Link><p className="mt-4 text-muted-foreground">Deal not found.</p></div></AppLayout>;
  }

  const subtitle = [deal.serviceLineTagging || deal.capabilityLine, deal.account].filter(Boolean).join(" · ");

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link to="/clients" className="h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors mt-1 shrink-0" aria-label="Back to clients">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">{deal.dealName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {deal.dealType}
            </span>
            <span className={cn(
              "inline-flex px-3 py-1 rounded-full text-xs font-medium",
              (deal.dealStatusCx || deal.dealStatus) === "Active"
                ? "bg-[hsl(142_60%_96%)] text-[hsl(142_60%_30%)]"
                : "bg-secondary text-muted-foreground"
            )}>
              {deal.dealStatusCx || deal.dealStatus}
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-border mb-6">
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{tab}</button>
            ))}
          </div>
        </div>

        {/* ══════════ Overview ══════════ */}
        {activeTab === "Overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* ── Financial Snapshot ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Financial Snapshot</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <FinancialMetricCard label="MRR" value={String(deal.mrr || "")} subLabel="Monthly recurring" onSave={v => handleDealFieldSave("mrr", v)} />
                <FinancialMetricCard label="Total Value" value={String(deal.totalDealValue || "")} subLabel="Contract total" onSave={v => handleDealFieldSave("totalDealValue", v)} />
                <FinancialMetricCard label="Retainer Value" value={String(deal.retainerDealValue || "")} subLabel="Of total value" onSave={v => handleDealFieldSave("retainerDealValue", v)} />
                <FinancialMetricCard label="Non-Retainer" value={String(deal.nonRetainerDealValue || "")} subLabel="Non-retainer portion" onSave={v => handleDealFieldSave("nonRetainerDealValue", v)} />
              </div>
            </div>

            {/* ── Aggregated Financial Metrics (from monthly data) ── */}
            {financials.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">YTD Financial Summary</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(() => {
                    const totalConsumed = financials.reduce((s, r) => s + (r.consumption || 0), 0);
                    const totalInvoiced = financials.reduce((s, r) => s + (r.invoiced || 0), 0);
                    const totalReceived = financials.reduce((s, r) => s + (r.received || 0), 0);
                    const outstanding = totalInvoiced - totalReceived;
                    return (
                      <>
                        <div className="rounded-lg bg-secondary/50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Consumed</p>
                          <p className="text-sm font-medium text-foreground">{fmtCurrency(totalConsumed)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">YTD consumption</p>
                        </div>
                        <div className="rounded-lg bg-secondary/50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Invoiced</p>
                          <p className="text-sm font-medium text-foreground">{fmtCurrency(totalInvoiced)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Billed to client</p>
                        </div>
                        <div className="rounded-lg bg-secondary/50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Received</p>
                          <p className="text-sm font-medium text-foreground">{fmtCurrency(totalReceived)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Payments cleared</p>
                        </div>
                        <div className="rounded-lg bg-secondary/50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Outstanding</p>
                          <p className={cn("text-sm font-medium", outstanding > 0 ? "text-[hsl(0_70%_50%)]" : "text-foreground")}>{fmtCurrency(outstanding)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Pending receivable</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No financial data yet. Add months in the Financials tab.</p>
              </div>
            )}

            {/* ── Contract Details + Team ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Contract Details */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Contract Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Payment Terms</span>
                    <EditableCell value={deal.paymentTerms || ""} onSave={v => handleDealFieldSave("paymentTerms", v)} placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Duration</span>
                    <EditableCell value={deal.duration || ""} onSave={v => handleDealFieldSave("duration", v)} placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Service Line</span>
                    <EditableCell value={deal.serviceLineTagging || deal.capabilityLine || ""} onSave={v => handleDealFieldSave("serviceLineTagging", v)} placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Start Date</span>
                    <EditableCell value={deal.startDate || ""} onSave={v => handleDealFieldSave("startDate", v)} type="date" placeholder="Not set" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">End Date</span>
                    <EditableCell value={deal.endDate || ""} onSave={v => handleDealFieldSave("endDate", v)} type="date" placeholder="Not set" />
                  </div>
                </div>

                {/* Progress bar */}
                {progressInfo && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{progressInfo.startLabel}</span>
                      <span>{progressInfo.endLabel}</span>
                    </div>
                    <Progress value={progressInfo.pct} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {progressInfo.pct}% complete · {progressInfo.daysRemaining} days remaining
                    </p>
                    <div className="mt-3">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-[hsl(38_92%_95%)] text-[hsl(38_80%_35%)]">
                        Renews in {progressInfo.daysRemaining} days
                      </span>
                    </div>
                  </div>
                )}
                {!progressInfo && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">Set start and end dates to see progress.</p>
                  </div>
                )}
              </div>

              {/* Team */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Team</h3>
                </div>
                <div className="divide-y divide-border">
                  <TeamMemberSelect
                    currentName={deal.vsd || ""}
                    role="VSD"
                    color="bg-teal-600"
                    people={people.filter(p => (p.roleTitle || "").toLowerCase().includes("vsd"))}
                    onSelect={name => {
                      handleDealFieldSave("vsd", name);
                      const person = people.find(p => p.name === name);
                      if (person) {
                        const existing = assignments.find(a => a.dealId === dealId && a.roleKey === "VSD");
                        if (existing) updateAssignment(existing.id, { personId: person.id });
                        else addAssignment({ id: uid(), dealId: dealId!, roleKey: "VSD", personId: person.id, allocationPct: 10 });
                      }
                    }}
                  />
                  <TeamMemberSelect
                    currentName={deal.principalBopm || ""}
                    role="Principal BOPM"
                    color="bg-primary"
                    people={people.filter(p => (p.roleTitle || "").toLowerCase().includes("principal bopm"))}
                    onSelect={name => {
                      handleDealFieldSave("principalBopm", name);
                      const person = people.find(p => p.name === name);
                      if (person) {
                        const existing = assignments.find(a => a.dealId === dealId && a.roleKey === "Principal BOPM");
                        if (existing) updateAssignment(existing.id, { personId: person.id });
                        else addAssignment({ id: uid(), dealId: dealId!, roleKey: "Principal BOPM", personId: person.id, allocationPct: 10 });
                      }
                    }}
                  />
                  <TeamMemberSelect
                    currentName={deal.seniorBopm || ""}
                    role="Senior BOPM"
                    color="bg-muted-foreground/60"
                    people={people.filter(p => (p.roleTitle || "").toLowerCase().includes("senior bopm"))}
                    onSelect={name => {
                      handleDealFieldSave("seniorBopm", name);
                      const person = people.find(p => p.name === name);
                      if (person) {
                        const existing = assignments.find(a => a.dealId === dealId && a.roleKey === "Senior BOPM");
                        if (existing) updateAssignment(existing.id, { personId: person.id });
                        else addAssignment({ id: uid(), dealId: dealId!, roleKey: "Senior BOPM", personId: person.id, allocationPct: 10 });
                      }
                    }}
                  />
                  <TeamMemberSelect
                    currentName={deal.bopm || ""}
                    role="BOPM"
                    color="bg-muted-foreground/60"
                    people={people.filter(p => {
                      const rt = (p.roleTitle || "").toLowerCase();
                      return rt.includes("bopm") && !rt.includes("senior") && !rt.includes("principal");
                    })}
                    onSelect={name => {
                      handleDealFieldSave("bopm", name);
                      const person = people.find(p => p.name === name);
                      if (person) {
                        const existing = assignments.find(a => a.dealId === dealId && a.roleKey === "BOPM");
                        if (existing) updateAssignment(existing.id, { personId: person.id });
                        else addAssignment({ id: uid(), dealId: dealId!, roleKey: "BOPM", personId: person.id, allocationPct: 10 });
                      }
                    }}
                  />
                </div>

                {/* Additional assigned members from staffing */}
                {(() => {
                  const coreRoles = new Set(["VSD", "Principal BOPM", "Senior BOPM", "BOPM"]);
                  const otherAssignments = dealAssignments.filter(a => !coreRoles.has(a.roleKey));
                  if (otherAssignments.length === 0) return null;
                  const grouped: Record<string, { person: typeof people[0]; alloc: typeof otherAssignments[0] }[]> = {};
                  otherAssignments.forEach(a => {
                    const p = people.find(pp => pp.id === a.personId);
                    if (!p) return;
                    const cat = p.roleCategory || "Other";
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push({ person: p, alloc: a });
                  });
                  return (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Other Assigned</p>
                      {Object.entries(grouped).map(([cat, members]) => (
                        <div key={cat}>
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">{cat}</p>
                          {members.map(({ person, alloc }) => (
                            <div key={alloc.id} className="flex items-center gap-2 py-1 text-xs">
                              <span className="text-foreground">{person.name}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="font-mono text-muted-foreground">{alloc.allocationPct}%</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── RGY + SoW ── */}
            <EditableRGY
              dimensions={[
                { key: "accountHealth", label: "Account Health", owner: "VSD", value: currentRGY?.accountHealth || "G", planOfAction: "" },
                { key: "delivery", label: "Delivery", owner: "BOPM", value: currentRGY?.delivery || "G", planOfAction: "" },
                { key: "financeBilling", label: "Finance / Billing", owner: "Finance", value: currentRGY?.financeBilling || "G", planOfAction: "" },
                { key: "capabilitySeo", label: "Capability — SEO", owner: "SEO", value: currentRGY?.capabilitySeo || "G", planOfAction: "" },
                { key: "capabilityCreative", label: "Capability — Creative", owner: "Creative", value: currentRGY?.capabilityCreative || "G", planOfAction: "" },
              ]}
              onSave={handleRGYSave}
            />

            {/* Overview RGY Issue Form */}
            {showIssueForm && currentRGY && (
              <RGYIssueForm
                dealId={dealId!}
                currentRGY={currentRGY!}
                assignees={dealPeople.map(p => ({ id: p.id, name: p.name }))}
                teamMembers={[deal.vsd, deal.principalBopm, deal.seniorBopm, deal.bopm].filter(Boolean)}
                onCancel={() => {
                  setShowIssueForm(false);
                  if (prevRGYSnapshot && currentRGY) {
                    updateRGYWeek(currentRGY.id, {
                      accountHealth: prevRGYSnapshot.accountHealth || "G",
                      delivery: prevRGYSnapshot.delivery || "G",
                      financeBilling: prevRGYSnapshot.financeBilling || "G",
                      capabilitySeo: prevRGYSnapshot.capabilitySeo || "G",
                      capabilityCreative: prevRGYSnapshot.capabilityCreative || "G",
                    });
                    toast.info("RGY changes reverted");
                  }
                  setPrevRGYSnapshot(null);
                }}
                onSaveIssue={async (issueData) => {
                  if (currentRGY) {
                    await updateRGYWeek(currentRGY.id, {
                      issueDate: issueData.issueDate,
                      issueDetails: issueData.issueDetails,
                      discussedActionPlan: issueData.discussedActionPlan,
                      actionPlan: issueData.actionPlan,
                      resolutionDueDate: issueData.resolutionDueDate,
                      issueStatus: issueData.issueStatus,
                    });
                  }
                  for (const task of issueData.tasks) {
                    for (const assignee of task.assignees) {
                      await addTask({
                        dealId: dealId!,
                        title: `[RGY Health] ${task.dimension} — ${task.issueSummary}`,
                        description: `Issue Details: ${issueData.issueDetails}\nAction Plan: ${issueData.actionPlan}\nDiscussed Action Plan: ${issueData.discussedActionPlan}`,
                        stage: "To Do",
                        assignee,
                        urgency: task.urgency,
                        loggedHours: 0,
                        sortOrder: 0,
                        startDate: issueData.issueDate,
                        endDate: issueData.resolutionDueDate,
                      });
                    }
                  }
                  setShowIssueForm(false);
                  setPrevRGYSnapshot(null);
                  toast.success("Issue saved & tasks created");
                }}
              />
            )}

            {/* ── SoW ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Scope of Work
              </p>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">SoW Items</h3>
                  <button
                    onClick={() => setAddingSoW(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </button>
                </div>

                {/* Column headers */}
                <div className="flex items-center px-5 py-2 bg-secondary/40 border-b border-border">
                  <span className="flex-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Scope</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right w-40">Revenue share team</span>
                  <span className="w-8" />
                </div>

                {/* Add row */}
                {addingSoW && (
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-accent/5">
                    <div className="flex-1">
                      <Input value={newSoW.scope} onChange={e => setNewSoW(p => ({ ...p, scope: e.target.value }))} className="h-7 text-sm" placeholder="Scope description" />
                    </div>
                    <div className="w-40">
                      <Input value={newSoW.teamCapability} onChange={e => setNewSoW(p => ({ ...p, teamCapability: e.target.value }))} className="h-7 text-sm" placeholder="e.g. SEO" />
                    </div>
                    <div className="flex gap-1 w-8 justify-end">
                      <button onClick={() => { addSoWItem({ dealId: dealId!, ...newSoW }); setNewSoW({ scope: "", revenueShare: 0, teamCapability: "" }); setAddingSoW(false); }} className="text-primary"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setAddingSoW(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}

                {/* Items */}
                {sowItems.map((s, i) => (
                  <div key={s.id} className={cn(
                    "flex items-center px-5 py-3 group hover:bg-accent/5 transition-colors",
                    i < sowItems.length - 1 && "border-b border-border"
                  )}>
                    <div className="flex-1 min-w-0">
                      <EditableCell value={s.scope} onSave={v => updateSoWItem(s.id, { scope: v })} />
                    </div>
                    <div className="w-40 text-right">
                      <EditableCell value={s.teamCapability} onSave={v => updateSoWItem(s.id, { teamCapability: v })} />
                    </div>
                    <div className="w-8 flex justify-end">
                      <button onClick={() => deleteSoWItem(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Empty state */}
                {sowItems.length === 0 && !addingSoW && (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-muted-foreground">No SoW items yet. Click 'Add item' to start.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ Staffing ══════════ */}
        {activeTab === "Staffing" && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Team Members</h3>
              <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Member
              </Button>
            </div>

            {dealPeople.length > 0 ? (
              (() => {
                const TEAM_ORDER = ["Operations", "SEO", "Content", "Content Strategy", "Creative Strategy", "Creative Art", "Creative Copy", "Video", "Performance & Growth", "Other"];
                const grouped = TEAM_ORDER
                  .map(cat => ({ category: cat, members: dealPeople.filter(p => p.roleCategory === cat) }))
                  .filter(g => g.members.length > 0);

                let totalCostWeek = 0;
                let totalHrsWeek = 0;
                let totalRevManaged = 0;
                const dealMrr = deal.mrr || 0;

                return (
                  <>
                    {(() => {
                      dealPeople.forEach(p => {
                        const alloc = dealAssignments.find(a => a.personId === p.id);
                        const pct = (alloc?.allocationPct || 0) / 100;
                        const hrs = pct * 40;
                        totalHrsWeek += hrs;
                        totalCostWeek += hrs * (p.hourlyRate || 0);
                        totalRevManaged += dealMrr * pct;
                      });
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Team Size</p><p className="text-xl font-semibold text-foreground">{dealPeople.length}</p></div>
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Total Hrs/Week</p><p className="text-xl font-semibold text-foreground">{totalHrsWeek.toFixed(1)}h</p></div>
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Cost/Week</p><p className="text-xl font-semibold text-foreground">{fmtCurrency(totalCostWeek)}</p></div>
                          <div className="rounded-lg bg-secondary/50 p-4"><p className="metric-label">Revenue Managed</p><p className="text-xl font-semibold text-foreground">{fmtCurrency(totalRevManaged)}</p></div>
                        </div>
                      );
                    })()}

                    {grouped.map(group => (
                      <div key={group.category} className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-accent/20 border-b border-border flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.category}</span>
                          <span className="text-xs text-muted-foreground">{group.members.length} member{group.members.length > 1 ? "s" : ""}</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Role</th>
                              <th className="text-left py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Pod</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Allocation</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Hrs/Week</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Rate/Hr</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Cost/Week</th>
                              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Rev Managed</th>
                              <th className="w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.members.map(p => {
                              const alloc = dealAssignments.find(a => a.personId === p.id);
                              const pct = (alloc?.allocationPct || 0) / 100;
                              const hrs = pct * 40;
                              const costWeek = hrs * (p.hourlyRate || 0);
                              const revManaged = (deal.mrr || 0) * pct;
                              const isEditingThis = editingAllocation === alloc?.id;
                              return (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-accent/10">
                                  <td className="py-2.5 px-4 font-medium text-foreground">{p.name}{p.tbh && <span className="ml-1 text-xs text-warning">(TBH)</span>}{p.leaving && <span className="ml-1 text-xs text-destructive">(Leaving)</span>}</td>
                                  <td className="py-2.5 px-4 text-muted-foreground">{p.roleTitle || p.designation}</td>
                                  <td className="py-2.5 px-4 text-muted-foreground">{p.pod}</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                                    {isEditingThis ? (
                                      <div className="flex items-center justify-end gap-1">
                                        <Input
                                          type="number"
                                          min={1}
                                          max={100}
                                          value={editAllocationValue}
                                          onChange={e => setEditAllocationValue(Number(e.target.value) || 0)}
                                          className="h-7 w-16 text-sm text-right"
                                          autoFocus
                                          onKeyDown={e => {
                                            if (e.key === "Enter") { updateAssignment(alloc!.id, { allocationPct: editAllocationValue }); setEditingAllocation(null); toast.success("Allocation updated"); }
                                            if (e.key === "Escape") setEditingAllocation(null);
                                          }}
                                        />
                                        <span className="text-xs">%</span>
                                        <button onClick={() => { updateAssignment(alloc!.id, { allocationPct: editAllocationValue }); setEditingAllocation(null); toast.success("Allocation updated"); }} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => setEditingAllocation(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                                      </div>
                                    ) : (
                                      <span
                                        className="cursor-pointer hover:underline"
                                        onClick={() => { if (alloc) { setEditingAllocation(alloc.id); setEditAllocationValue(alloc.allocationPct); } }}
                                      >
                                        {alloc?.allocationPct || 0}%
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{hrs.toFixed(1)}h</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                                    <EditableCell value={String(p.hourlyRate || 0)} onSave={v => updatePerson(p.id, { hourlyRate: Number(v) || 0 })} type="number" prefix="₹" />
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(costWeek)}</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(revManaged)}</td>
                                  <td className="py-2.5 px-4 text-right">
                                    <button
                                      onClick={() => alloc && setConfirmDeleteAssignment(alloc.id)}
                                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                      title="Remove from deal"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </>
                );
              })()
            ) : (
              <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
                <p className="text-muted-foreground mb-3">No team members assigned to this deal.</p>
                <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add First Member
                </Button>
              </div>
            )}

            {/* Add Member Dialog */}
            <AddStaffingMemberDialog
              open={addMemberOpen}
              onOpenChange={setAddMemberOpen}
              people={people}
              assignments={assignments}
              deals={deals}
              dealId={dealId!}
              onAdd={addAssignment}
            />

            {/* Confirm Delete Assignment */}
            <AlertDialog open={!!confirmDeleteAssignment} onOpenChange={v => { if (!v) setConfirmDeleteAssignment(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove the member's assignment from this deal.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { if (confirmDeleteAssignment) { deleteAssignment(confirmDeleteAssignment); toast.success("Member removed"); setConfirmDeleteAssignment(null); } }}>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* ══════════ Financials ══════════ */}
        {activeTab === "Financials" && (
          <FinancialsTab rows={financials} dealId={dealId!} deal={deal ? { totalDealValue: deal.totalDealValue, mrr: deal.mrr } : undefined} onAdd={addFinancial} onUpdate={updateFinancial} onDelete={deleteFinancial} />
        )}

        {/* ══════════ Tasks ══════════ */}
        {activeTab === "Tasks" && (
          <TaskKanban tasks={tasks} dealId={dealId!} assignees={dealPeople.map(p => ({ id: p.id, name: p.name }))} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} />
        )}

        {/* ══════════ RGY Health ══════════ */}
        {activeTab === "RGY Health" && (
          <div className="animate-fade-in space-y-5">
            {/* Current Week RGY Editor */}
            <EditableRGY
              dimensions={[
                { key: "accountHealth", label: "Account Health", owner: "VSD", value: currentRGY?.accountHealth || "G" },
                { key: "delivery", label: "Delivery", owner: "BOPM", value: currentRGY?.delivery || "G" },
                { key: "financeBilling", label: "Finance / Billing", owner: "Finance", value: currentRGY?.financeBilling || "G" },
                { key: "capabilitySeo", label: "Capability — SEO", owner: "SEO", value: currentRGY?.capabilitySeo || "G" },
                { key: "capabilityCreative", label: "Capability — Creative", owner: "Creative", value: currentRGY?.capabilityCreative || "G" },
              ]}
              onSave={handleRGYSave}
            />

            {/* RGY Task Summary */}
            {(() => {
              const rgyTasks = tasks.filter(t => t.title.startsWith("[RGY Health]"));
              const toDo = rgyTasks.filter(t => t.stage === "To Do").length;
              const inProgress = rgyTasks.filter(t => t.stage === "In Progress").length;
              const inReview = rgyTasks.filter(t => t.stage === "In Review").length;
              const done = rgyTasks.filter(t => t.stage === "Done").length;
              const dropped = rgyTasks.filter(t => t.stage === "Dropped").length;
              const hasNonGreen = currentRGY && (
                currentRGY.accountHealth !== "G" || currentRGY.delivery !== "G" ||
                currentRGY.financeBilling !== "G" || currentRGY.capabilitySeo !== "G" ||
                currentRGY.capabilityCreative !== "G"
              );
              const allDone = rgyTasks.length > 0 && rgyTasks.every(t => t.stage === "Done" || t.stage === "Dropped");
              const showWarning = hasNonGreen && allDone;

              if (rgyTasks.length === 0) return null;
              return (
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">RGY Health Tasks Summary</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {toDo > 0 && <Badge variant="outline" className="gap-1">To Do <span className="font-bold">{toDo}</span></Badge>}
                    {inProgress > 0 && <Badge variant="outline" className="gap-1 border-primary/40 text-primary">In Progress <span className="font-bold">{inProgress}</span></Badge>}
                    {inReview > 0 && <Badge variant="outline" className="gap-1 border-blue-400/40 text-blue-600">In Review <span className="font-bold">{inReview}</span></Badge>}
                    {done > 0 && <Badge variant="outline" className="gap-1 border-positive/40 text-positive">Done <span className="font-bold">{done}</span></Badge>}
                    {dropped > 0 && <Badge variant="outline" className="gap-1">Dropped <span className="font-bold">{dropped}</span></Badge>}
                  </div>
                  {showWarning && (
                    <div className="flex items-center gap-2 mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>All RGY tasks are done but status is still Red/Yellow — consider updating RGY status to Green.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Issue Capture Form — show only when user changes to Y/R */}
            {showIssueForm && currentRGY && (
              <RGYIssueForm
                dealId={dealId!}
                currentRGY={currentRGY!}
                assignees={dealPeople.map(p => ({ id: p.id, name: p.name }))}
                teamMembers={[
                  deal.vsd, deal.principalBopm, deal.seniorBopm, deal.bopm
                ].filter(Boolean)}
                onCancel={() => {
                  setShowIssueForm(false);
                  // Revert RGY to previous values
                  if (prevRGYSnapshot && currentRGY) {
                    updateRGYWeek(currentRGY.id, {
                      accountHealth: prevRGYSnapshot.accountHealth || "G",
                      delivery: prevRGYSnapshot.delivery || "G",
                      financeBilling: prevRGYSnapshot.financeBilling || "G",
                      capabilitySeo: prevRGYSnapshot.capabilitySeo || "G",
                      capabilityCreative: prevRGYSnapshot.capabilityCreative || "G",
                    });
                    toast.info("RGY changes reverted");
                  }
                  setPrevRGYSnapshot(null);
                }}
                onSaveIssue={async (issueData) => {
                  if (currentRGY) {
                    await updateRGYWeek(currentRGY.id, {
                      issueDate: issueData.issueDate,
                      issueDetails: issueData.issueDetails,
                      discussedActionPlan: issueData.discussedActionPlan,
                      actionPlan: issueData.actionPlan,
                      resolutionDueDate: issueData.resolutionDueDate,
                      issueStatus: issueData.issueStatus,
                    });
                  }
                  // Create tasks
                  for (const task of issueData.tasks) {
                    for (const assignee of task.assignees) {
                      await addTask({
                        dealId: dealId!,
                        title: `[RGY Health] ${task.dimension} — ${task.issueSummary}`,
                        description: `Issue Details: ${issueData.issueDetails}\nAction Plan: ${issueData.actionPlan}\nDiscussed Action Plan: ${issueData.discussedActionPlan}`,
                        stage: "To Do",
                        assignee,
                        urgency: task.urgency,
                        loggedHours: 0,
                        sortOrder: 0,
                        startDate: issueData.issueDate,
                        endDate: issueData.resolutionDueDate,
                      });
                    }
                  }
                  setShowIssueForm(false);
                  setPrevRGYSnapshot(null);
                  toast.success("Issue saved & tasks created");
                }}
              />
            )}

            {/* Green-Gate Dialog */}
            {greenGateDialog && (
              <AlertDialog open={!!greenGateDialog} onOpenChange={(open) => { if (!open) setGreenGateDialog(null); }}>
                <AlertDialogContent className="max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      Open Tasks Must Be Completed
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      The following RGY Health tasks are still open. You must complete or force-close them before moving the status to Green.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {greenGateDialog.pendingDims.map(dim => (
                      <div key={dim.key} className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground">{dim.label}</p>
                        {dim.tasks.map(task => (
                          <div key={task.id} className="flex items-center gap-2 pl-2">
                            <Checkbox
                              checked={task.stage === "Done"}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  updateTask(task.id, { stage: "Done" });
                                  // Update local dialog state
                                  setGreenGateDialog(prev => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      pendingDims: prev.pendingDims.map(d => ({
                                        ...d,
                                        tasks: d.tasks.map(t => t.id === task.id ? { ...t, stage: "Done" } : t)
                                      }))
                                    };
                                  });
                                }
                              }}
                            />
                            <span className="text-sm text-foreground">{task.title}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">{task.stage}</Badge>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      variant="outline"
                      onClick={handleForceCloseGreenGate}
                      className="text-warning border-warning/40"
                    >
                      Force Close All & Save
                    </Button>
                    <AlertDialogAction
                      disabled={greenGateDialog.pendingDims.some(d => d.tasks.some(t => t.stage !== "Done" && t.stage !== "Dropped"))}
                      onClick={() => {
                        const pendingSave = greenGateDialog.pendingSave;
                        setGreenGateDialog(null);
                        if (pendingSave) handleRGYSave(pendingSave);
                      }}
                    >
                      Save as Green
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Historic Timeline — Grouped by Week */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">RGY History</p>
              {rgyWeekly.length > 0 ? (
                <GroupedRGYHistory rgyWeekly={rgyWeekly} />
              ) : (
                <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
                  <p className="text-muted-foreground">No weekly RGY data recorded yet. Use the editor above to set health status.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ MBR ══════════ */}
        {activeTab === "MBR" && (
          <DealMBRTab
            deal={deal}
            dealId={dealId!}
            mbrEntries={mbrEntries}
            upsertMBREntry={upsertMBREntry}
          />
        )}

        {/* ══════════ Onboarding ══════════ */}
        {activeTab === "Onboarding" && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">Onboarding Progress</p>
                <span className={cn("text-sm font-semibold font-mono", onboardingPct === 100 ? "text-positive" : "text-foreground")}>{onboardingPct}%</span>
              </div>
              <Progress value={onboardingPct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{onboarding.filter(s => s.completed).length} of {onboarding.length} steps completed</p>
            </div>
            {onboarding.length > 0 ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {(() => {
                  const categories = [...new Set(onboarding.map(s => s.category))];
                  return categories.map(cat => (
                    <div key={cat}>
                      <div className="px-4 py-2 bg-accent/20 border-b border-border">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</span>
                      </div>
                      {onboarding.filter(s => s.category === cat).map(step => (
                        <div key={step.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-accent/10 transition-colors">
                          <button onClick={() => toggleOnboardingStep(step.id)} className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0",
                            step.completed ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
                          )}>
                            {step.completed && <span className="text-[10px]">✓</span>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className={cn("text-sm", step.completed ? "line-through text-muted-foreground" : "text-foreground")}>{step.stepName}</span>
                          </div>
                          {step.owner && <span className="text-xs text-muted-foreground">{step.owner}</span>}
                          {step.dueDate && <span className="text-xs font-mono text-muted-foreground">{step.dueDate}</span>}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
                <p className="text-muted-foreground mb-3">No onboarding steps configured yet.</p>
                <Button variant="outline" onClick={() => { seedOnboarding(deal.dealType); toast.success("Onboarding checklist generated"); }}>
                  <Plus className="h-4 w-4 mr-1" /> Generate Checklist for {deal.dealType}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
