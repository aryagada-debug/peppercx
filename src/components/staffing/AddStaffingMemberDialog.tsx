import React, { useState, useMemo, useCallback } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, AlertTriangle, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeRoleKey, uid, ROLE_SLOTS } from "@/data/staffingData";
import type { StaffingAssignment, Person, Deal, RoleCategory } from "@/data/staffingData";
import { useTaxonomyQuery } from "@/hooks/queries/useTaxonomyQuery";
import { resolvePersonRoleTypeId, countAvailableForRole } from "@/lib/peopleGrouping";
import { usePersonMutations } from "@/hooks/queries/usePeopleQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const ROLE_CATEGORIES: RoleCategory[] = ["Operations", "SEO", "Content", "Content Strategy", "Creative Strategy", "Creative Art", "Creative Copy", "Video", "Performance & Growth"];

const clampAllocationPct = (value: number) => Math.max(0, Math.min(100, Math.round(value * 10) / 10));
const formatAllocationPct = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
const parseAllocationPct = (raw: string, fallback: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampAllocationPct(parsed) : fallback;
};

interface AddStaffingMemberDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  people: Person[];
  assignments: StaffingAssignment[];
  deals: Deal[];
  dealId: string;
  onAdd: (assignment: StaffingAssignment) => void;
  /** If provided, skip step 1 and go directly to step 2 with this category */
  initialCategory?: RoleCategory;
  /** If provided, pre-select this person and go to step 3 */
  initialPersonName?: string;
  /** Edit-mode: when set, dialog updates this assignment instead of adding a new one. */
  editingAssignmentId?: string;
  initialAllocationPct?: number;
  initialRoleKey?: string;
  /** If provided, jump to Step 2 with this Role Type pre-selected so the
   *  person list is already filtered to that role. */
  initialRoleTypeId?: string;
  onUpdate?: (assignmentId: string, patch: Partial<StaffingAssignment>) => void;
}

export function AddStaffingMemberDialog({
  open, onOpenChange, people, assignments, deals, dealId, onAdd, initialCategory, initialPersonName,
  editingAssignmentId, initialAllocationPct, initialRoleKey, initialRoleTypeId, onUpdate,
}: AddStaffingMemberDialogProps) {
  const { canEditAll } = useUserRole();
  const requiresApproval = !canEditAll;
  const canViewCurrentEngagements = canEditAll;
  const isEditMode = !!editingAssignmentId;
  // Steps: 1=Department, 2=Role Type, 3=Person + Allocation
  const getInitialStep = (): 1 | 2 | 3 => {
    if (initialPersonName) return 3;
    if (initialRoleTypeId || initialCategory) return 2;
    return 1;
  };

  const [step, setStep] = useState<1 | 2 | 3>(getInitialStep());
  const [selectedCategory, setSelectedCategory] = useState<RoleCategory | null>(() => {
    if (initialCategory) return initialCategory;
    if (initialRoleTypeId) {
      const slot = ROLE_SLOTS.find(s => s.roleKey === initialRoleTypeId);
      if (slot) return slot.category;
    }
    return null;
  });
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedRoleTypeId, setSelectedRoleTypeId] = useState<string | null>(initialRoleTypeId || null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(() => {
    if (initialPersonName) return people.find(p => p.name === initialPersonName) || null;
    return null;
  });
  const [allocationPct, setAllocationPct] = useState(initialAllocationPct ?? 10);
  const [allocationInput, setAllocationInput] = useState(formatAllocationPct(initialAllocationPct ?? 10));
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const dealForDates = useMemo(() => deals.find(d => d.id === dealId), [deals, dealId]);
  const editingAssignment = useMemo(
    () => editingAssignmentId ? assignments.find(a => a.id === editingAssignmentId) : undefined,
    [editingAssignmentId, assignments]
  );
  const [startDate, setStartDate] = useState<string>(editingAssignment?.startDate || dealForDates?.startDate || "");
  const [endDate, setEndDate] = useState<string>(editingAssignment?.endDate || dealForDates?.endDate || "");
  const [roleOnDeal, setRoleOnDeal] = useState(() => {
    if (initialRoleKey) return initialRoleKey;
    if (initialPersonName) {
      const p = people.find(pp => pp.name === initialPersonName);
      return p?.roleTitle || p?.roleCategory || "";
    }
    return "";
  });
  const [assignmentType, setAssignmentType] = useState<"Internal" | "External" | "Freelance">("Internal");
  const [expandedOpsGroup, setExpandedOpsGroup] = useState<string | null>(null);
  const { data: taxonomy } = useTaxonomyQuery();
  const alreadyAssigned = useMemo(() => new Set(assignments.filter(a => a.dealId === dealId).map(a => a.personId)), [assignments, dealId]);
  const [searchQuery, setSearchQuery] = useState("");

  // TBH inline form (Step 2, after a Role Type or category is chosen)
  const [tbhFormOpen, setTbhFormOpen] = useState(false);
  const [tbhName, setTbhName] = useState("");
  const [tbhSaving, setTbhSaving] = useState(false);
  const { addPerson } = usePersonMutations();

  const selectedRoleType = useMemo(
    () => (selectedRoleTypeId ? taxonomy?.roleTypeById.get(selectedRoleTypeId) : undefined),
    [selectedRoleTypeId, taxonomy],
  );
  const selectedDept = useMemo(
    () => (selectedDeptId ? taxonomy?.departmentById.get(selectedDeptId) : undefined),
    [selectedDeptId, taxonomy],
  );

  const handleAddTbh = useCallback(async () => {
    const fallbackLabel = selectedRoleType?.name || selectedCategory || "Role";
    const finalName = tbhName.trim() || `TBH — ${fallbackLabel}`;
    const rtSlot = selectedRoleTypeId ? ROLE_SLOTS.find(s => s.roleKey === selectedRoleTypeId) : undefined;
    const newPerson: Person = {
      id: uid(),
      name: finalName,
      roleCategory: (rtSlot?.category ?? selectedCategory ?? "Other") as RoleCategory,
      roleTitle: selectedRoleType?.name || rtSlot?.roleLabel || selectedCategory || "",
      pod: "",
      region: "India",
      leaving: false,
      tbh: true,
      department: selectedDept?.name || "",
      designation: selectedRoleType?.name || rtSlot?.roleLabel || "",
      reportingManager: "",
      band: "",
      email: "",
      subTeam: "",
      departmentId: selectedDeptId || null,
      roleTypeId: selectedRoleTypeId || null,
    };
    setTbhSaving(true);
    try {
      await addPerson.mutateAsync(newPerson);
      toast.success(`TBH placeholder added for ${fallbackLabel}`);
      setTbhFormOpen(false);
      setTbhName("");
      setSelectedPerson(newPerson);
      setRoleOnDeal(newPerson.roleTitle || newPerson.roleCategory);
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message || "Failed to add TBH");
    } finally {
      setTbhSaving(false);
    }
  }, [tbhName, selectedRoleType, selectedCategory, selectedRoleTypeId, selectedDept, selectedDeptId, addPerson]);

  // People filtered by the selected Role Type (preferred) or legacy category.
  const filteredPeople = useMemo(() => {
    if (selectedRoleTypeId) {
      return people.filter(p => resolvePersonRoleTypeId(p, taxonomy) === selectedRoleTypeId);
    }
    if (selectedCategory) return people.filter(p => p.roleCategory === selectedCategory);
    return [];
  }, [people, selectedRoleTypeId, selectedCategory, taxonomy]);

  // Global search across ALL people, regardless of selected category.
  // Activates whenever the user types in the search box on step 2.
  const searchedPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return people.filter(p => {
      const hay = `${p.name} ${p.roleTitle || ""} ${p.roleCategory || ""} ${p.pod || ""} ${p.region || ""} ${p.email || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [people, searchQuery]);

  const getPersonUtilization = useCallback((personId: string) => {
    const personAssignments = assignments.filter(a => a.personId === personId);
    const total = personAssignments.reduce((s, a) => s + a.allocationPct, 0);
    return { total, assignments: personAssignments };
  }, [assignments]);

  const getDealName = useCallback((dId: string) => {
    const d = deals.find(x => x.id === dId);
    return d ? `${d.account} — ${d.dealName}` : dId;
  }, [deals]);

  const reset = () => {
    const initialPct = initialAllocationPct ?? 10;
    setStep(initialCategory ? 2 : 1);
    setSelectedCategory(initialCategory || null);
    setSelectedDeptId(null);
    setSelectedRoleTypeId(null);
    setSelectedPerson(null);
    setAllocationPct(initialPct);
    setAllocationInput(formatAllocationPct(initialPct));
    setExpandedPerson(null);
    setRoleOnDeal(initialRoleKey || "");
    setAssignmentType("Internal");
    setExpandedOpsGroup(null);
    setSearchQuery("");
    setStartDate(editingAssignment?.startDate || dealForDates?.startDate || "");
    setEndDate(editingAssignment?.endDate || dealForDates?.endDate || "");
  };

  // Re-initialize when dialog opens with new props
  React.useEffect(() => {
    if (open) {
      // Default start/end dates to the deal's dates whenever the dialog opens.
      // The edit-mode branch below overrides with the assignment's own dates.
      setStartDate(dealForDates?.startDate || "");
      setEndDate(dealForDates?.endDate || "");
      if (editingAssignmentId) {
        const cur = assignments.find(a => a.id === editingAssignmentId);
        const curPerson = cur ? people.find(pp => pp.id === cur.personId) : null;
        if (curPerson) {
          setSelectedPerson(curPerson);
          setSelectedCategory((curPerson.roleCategory as RoleCategory) || initialCategory || null);
        } else if (initialCategory) {
          setSelectedCategory(initialCategory);
        }
        if (cur) {
          const nextPct = cur.allocationPct ?? initialAllocationPct ?? 10;
          setAllocationPct(nextPct);
          setAllocationInput(formatAllocationPct(nextPct));
          setStartDate(cur.startDate || dealForDates?.startDate || "");
          setEndDate(cur.endDate || dealForDates?.endDate || "");
          setRoleOnDeal(normalizeRoleKey(cur.roleKey || initialRoleKey || curPerson?.roleTitle || ""));
        }
        setStep(curPerson ? 3 : (initialCategory ? 2 : 1));
        return;
      }
      if (initialPersonName) {
        const p = people.find(pp => pp.name === initialPersonName);
        if (p) {
          const nextPct = initialAllocationPct ?? 10;
          setSelectedPerson(p);
          setRoleOnDeal(normalizeRoleKey(p.roleTitle || p.roleCategory));
          setSelectedCategory(p.roleCategory as RoleCategory);
          setAllocationPct(nextPct);
          setAllocationInput(formatAllocationPct(nextPct));
          setStep(3);
          return;
        }
      }
      if (initialRoleTypeId) {
        const slot = ROLE_SLOTS.find(s => s.roleKey === initialRoleTypeId);
        setSelectedRoleTypeId(initialRoleTypeId);
        setSelectedCategory((slot?.category as RoleCategory) || initialCategory || null);
        setStep(2);
        return;
      }
      if (initialCategory) {
        setSelectedCategory(initialCategory);
        setStep(2);
      } else {
        setStep(1);
      }
    }
  }, [open, initialCategory, initialPersonName, people, editingAssignmentId, assignments, initialRoleKey, initialRoleTypeId, initialAllocationPct, dealForDates?.startDate, dealForDates?.endDate]);

  const handleConfirm = () => {
    if (!selectedPerson) return;
    const finalAllocationPct = parseAllocationPct(allocationInput, allocationPct);
    if (isEditMode && editingAssignmentId && onUpdate) {
      onUpdate(editingAssignmentId, {
        personId: selectedPerson.id,
        roleKey: normalizeRoleKey(roleOnDeal || selectedPerson.roleTitle || selectedPerson.roleCategory),
        allocationPct: finalAllocationPct,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (!requiresApproval) toast.success(`${selectedPerson.name} updated`);
      reset();
      onOpenChange(false);
      return;
    }
    onAdd({
      id: uid(),
      dealId,
      roleKey: normalizeRoleKey(roleOnDeal || selectedPerson.roleTitle || selectedPerson.roleCategory),
      personId: selectedPerson.id,
      allocationPct: finalAllocationPct,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    if (!requiresApproval) {
      toast.success(`${selectedPerson.name} added at ${finalAllocationPct}%`);
    }
    reset();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {step === 1 && "Select Department"}
            {step === 2 && (selectedDeptId
              ? `Select Role Type — ${taxonomy?.departmentById.get(selectedDeptId)?.name ?? ""}`
              : `Select Member — ${selectedCategory}`)}
            {step === 3 && `${isEditMode ? "Update Assignment" : "Set Allocation"} — ${selectedPerson?.name}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1 && "Choose a department to drill into its role types."}
            {step === 2 && (selectedDeptId
              ? "Pick a role type to see available members."
              : "Pick a team member to assign. Click the arrow to see their current deals.")}
            {step === 3 && "Set the allocation percentage for this deal."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-2">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {(taxonomy?.departments ?? []).map(dept => {
                const roles = taxonomy?.roleTypesByDept.get(dept.id) || [];
                const count = people.filter(p =>
                  !p.tbh && !p.leaving && roles.some(r => r.id === resolvePersonRoleTypeId(p, taxonomy))
                ).length;
                return (
                  <button
                    key={dept.id}
                    onClick={() => { setSelectedDeptId(dept.id); setSelectedRoleTypeId(null); setSelectedCategory(null); setStep(2); }}
                    className="rounded-lg border border-border p-3 text-left hover:bg-accent/20 transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{dept.name}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {roles.length} role type{roles.length === 1 ? "" : "s"} · {count} available
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && selectedDeptId && !selectedRoleTypeId && (
            <div className="grid grid-cols-2 gap-2">
              {(taxonomy?.roleTypesByDept.get(selectedDeptId) || []).map(rt => {
                const count = countAvailableForRole(people, rt.id, taxonomy);
                return (
                  <button
                    key={rt.id}
                    onClick={() => { setSelectedRoleTypeId(rt.id); }}
                    className="rounded-lg border border-border p-3 text-left hover:bg-accent/20 transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{rt.name}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{count} available</span>
                  </button>
                );
              })}
              <Button
                variant="ghost" size="sm"
                onClick={() => { setSelectedDeptId(null); setStep(1); }}
                className="col-span-2 justify-start"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to departments
              </Button>
            </div>
          )}

          {step === 2 && (selectedRoleTypeId || (!selectedDeptId && selectedCategory)) && (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search all people by name, role, pod, email…"
                  className="h-8 pl-8 text-xs"
                  autoFocus
                />
              </div>
              {/* Add TBH placeholder for the selected role type / category */}
              <div className="mb-2 rounded-lg border border-dashed border-warning/40 bg-warning/5 p-2">
                {!tbhFormOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTbhFormOpen(true);
                      setTbhName(`TBH — ${selectedRoleType?.name || selectedCategory || "Role"}`);
                    }}
                    className="flex items-center gap-2 text-xs font-medium text-warning hover:underline"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add TBH placeholder for {selectedRoleType?.name || selectedCategory}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tbhName}
                      onChange={(e) => setTbhName(e.target.value)}
                      placeholder={`TBH — ${selectedRoleType?.name || selectedCategory || "Role"}`}
                      className="h-7 text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleAddTbh(); }
                        if (e.key === "Escape") { e.preventDefault(); setTbhFormOpen(false); }
                      }}
                    />
                    <Button size="sm" className="h-7 px-2 text-xs" disabled={tbhSaving} onClick={handleAddTbh}>
                      {tbhSaving ? "Adding…" : "Save TBH"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setTbhFormOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Creates a hiring placeholder you can assign to this deal. Shows up in Hiring Gaps until a real hire is made.
                </p>
              </div>
              {searchedPeople ? (
                searchedPeople.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No people match "{searchQuery}".</p>
                ) : (
                  searchedPeople.map(p => {
                    const util = getPersonUtilization(p.id);
                    const utilColor = util.total > 100 ? "text-destructive" : util.total >= 80 ? "text-warning" : "text-positive";
                    const isAssigned = alreadyAssigned.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/10 border border-border rounded-lg"
                        onClick={() => { setSelectedPerson(p); setRoleOnDeal(p.roleTitle || p.roleCategory); setStep(3); }}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                          {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                            {isAssigned && <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary/30">Assigned</Badge>}
                            {p.tbh && <Badge variant="outline" className="text-[10px] px-1 py-0 text-warning border-warning/30">TBH</Badge>}
                            {p.leaving && <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30">Leaving</Badge>}
                          </div>
                          <span className="text-xs text-muted-foreground">{p.roleTitle || p.roleCategory} · {p.pod} · {p.region}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn("text-sm font-mono font-medium", utilColor)}>{util.total}%</span>
                          <span className="block text-[10px] text-muted-foreground">{util.assignments.length} deal{util.assignments.length !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    );
                  })
                )
              ) : filteredPeople.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No available members in {selectedCategory}.</p>
              ) : selectedCategory === "Operations" ? (
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
                            const isAssigned = alreadyAssigned.has(p.id);
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
                                    {isAssigned && <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary/30">Assigned</Badge>}
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
                  const isAssigned = alreadyAssigned.has(p.id);
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
                            {isAssigned && <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary/30">Assigned</Badge>}
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
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  if (selectedRoleTypeId) { setSelectedRoleTypeId(null); }
                  else { setSelectedCategory(null); setStep(1); }
                  setExpandedOpsGroup(null);
                }}
                className="mt-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {selectedRoleTypeId ? "Back to role types" : "Back to departments"}
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
                <div className="rounded-lg bg-secondary/50 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                    {selectedPerson.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedPerson.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPerson.roleTitle} · {selectedPerson.pod} · {selectedPerson.region}</p>
                  </div>
                </div>

                {canViewCurrentEngagements && <div className="rounded-lg border border-border overflow-hidden">
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
                              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right shrink-0">{(a.allocationPct / 100 * 40).toFixed(1)}h</span>
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
                </div>}

                {canViewCurrentEngagements && util.total >= 100 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">This person is already at {util.total}% capacity across other deals. Adding them may exceed 100%.</p>
                  </div>
                )}

                {requiresApproval && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                    This change will be sent to <span className="font-medium">Central Cx</span> for approval.
                    All details below will be included in the request.
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role on this deal</label>
                  <Input value={roleOnDeal} onChange={e => setRoleOnDeal(e.target.value)} placeholder="e.g. Senior BOPM" className="h-8 text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Allocation %</label>
                    <Input type="number" min={0} max={100} step="0.1" value={allocationInput}
                      onChange={e => {
                        const next = e.target.value;
                        setAllocationInput(next);
                        if (next === "") return;
                        setAllocationPct(parseAllocationPct(next, allocationPct));
                      }}
                      onBlur={() => {
                        const nextPct = parseAllocationPct(allocationInput, allocationPct);
                        setAllocationPct(nextPct);
                        setAllocationInput(formatAllocationPct(nextPct));
                      }}
                      className="h-8 text-sm" />
                    <p className="text-[10px] text-muted-foreground mt-1">= {(allocationPct / 100 * 40).toFixed(1)} hrs/week{newTotal > 100 ? ` · ⚠ Total ${newTotal}%` : ""}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                    <Select value={assignmentType} onValueChange={v => setAssignmentType(v as any)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Internal">Internal</SelectItem>
                        <SelectItem value="External">External</SelectItem>
                        <SelectItem value="Freelance">Freelance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start date</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" />
                    {dealForDates?.startDate && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Deal starts: <span className="font-mono text-foreground">{dealForDates.startDate}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">End date</label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" />
                    {dealForDates?.endDate && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Deal ends: <span className="font-mono text-foreground">{dealForDates.endDate}</span>
                      </p>
                    )}
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
          {step === 3 && (
            <AlertDialogAction onClick={handleConfirm}>
              {requiresApproval
                ? "Send for Approval"
                : (isEditMode ? "Save changes" : "Add to Plan")}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
