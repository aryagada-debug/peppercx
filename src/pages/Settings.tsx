import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { Loader2, Pencil, Check, X, Search, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/data/staffingData";
import { UsersTab } from "@/pages/admin/UsersTab";
import { AccessControlsTab } from "@/pages/admin/AccessControlsTab";
import { useUserRole } from "@/hooks/useUserRole";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from "@dnd-kit/core";
import { formatINR } from "@/lib/csvTargets";
import { GripVertical } from "lucide-react";

const tabs = [
  "People & Reporting",
  "Revenue Capacity",
  "Users & Roles",
  "Access Controls",
  "Notifications",
] as const;
type SettingsTab = typeof tabs[number];

function InlineEdit({
  value,
  onSave,
  type = "text",
  className: cls,
  listId,
  placeholder = "—",
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  className?: string;
  listId?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  const save = () => {
    onSave(local.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          type={type}
          list={listId}
          className="h-7 min-w-[120px] text-xs"
          placeholder={placeholder}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setLocal(value);
              setEditing(false);
            }
          }}
        />
        <button onClick={save} className="text-primary" type="button">
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={() => {
            setLocal(value);
            setEditing(false);
          }}
          className="text-muted-foreground"
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn("group/edit flex items-center gap-1 text-left", cls)}
      onClick={() => {
        setLocal(value);
        setEditing(true);
      }}
    >
      <span className={cn("text-xs", value ? "text-foreground" : "text-muted-foreground")}>{value || placeholder}</span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100" />
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("People & Reporting");
  const { people, revenueTargets, loading, updatePerson, deletePerson, setRevenueTargets } = useStaffingData();
  const { isActuallyAdmin } = useUserRole();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [draggingPersonId, setDraggingPersonId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const filteredPeople = useMemo(() => {
    if (!search) return people;
    const q = search.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q) || (p.department || "").toLowerCase().includes(q));
  }, [people, search]);

  const managerNames = useMemo(
    () => Array.from(new Set(people.filter((person) => !person.tbh).map((person) => person.name))).sort((a, b) => a.localeCompare(b)),
    [people],
  );

  const visiblePeople = search ? filteredPeople : people;

  const handleReportingChange = (personId: string, personName: string, newManager: string) => {
    if (newManager && newManager === personName) {
      toast.error("A person can't report to themselves");
      return;
    }
    updatePerson(personId, { reportingManager: newManager });
    toast.success("Reporting manager updated");
  };

  const handleDeletePerson = async () => {
    if (!confirmDelete) return;
    try {
      await deletePerson(confirmDelete.id);
      toast.success(`${confirmDelete.name} removed`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleRevTargetChange = (dept: string, desg: string, newVal: number) => {
    const updated = revenueTargets.map((t) =>
      t.department === dept && t.designation === desg ? { ...t, targetDealValuePerPerson: newVal } : t,
    );
    setRevenueTargets(updated);
    toast.success("Target updated");
  };

  // ---- People grouped by Dept|Designation for the drag-drop revenue table ----
  const peopleByGroup = useMemo(() => {
    const m = new Map<string, typeof people>();
    people.filter((p) => !p.tbh && !p.leaving && p.department && p.designation).forEach((p) => {
      const key = `${p.department}||${p.designation}`;
      if (!m.has(key)) m.set(key, [] as typeof people);
      m.get(key)!.push(p);
    });
    return m;
  }, [people]);

  const draggingPerson = useMemo(
    () => (draggingPersonId ? people.find((p) => p.id === draggingPersonId) : null),
    [draggingPersonId, people],
  );

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingPersonId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const personId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setDraggingPersonId(null);
    if (!overId) return;
    const [dept, desg] = overId.split("||");
    const person = people.find((p) => p.id === personId);
    if (!person || (person.department === dept && person.designation === desg)) return;
    updatePerson(personId, { department: dept, designation: desg });
    toast.success(`${person.name} moved to ${desg}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <datalist id="settings-departments">
        {DEPARTMENTS.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>

      <datalist id="settings-managers">
        {managerNames.map((managerName) => (
          <option key={managerName} value={managerName} />
        ))}
      </datalist>

      <div className="px-3 py-4">
        <h1 className="mb-6 text-subhead font-semibold tracking-tight text-foreground">Settings</h1>

        <div className="mb-6 border-b border-border">
          <div className="-mb-px flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "border-b-2 px-4 py-2.5 text-ui font-medium transition-colors",
                  activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "People & Reporting" && (
          <div className="space-y-4">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search people..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-ui text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      {["Name", "Department", "Designation", "Band", "Pod", "Reporting Manager"].map((heading) => (
                        <th
                          key={heading}
                          className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePeople.map((person) => (
                      <tr key={person.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              person.tbh
                                ? "italic text-muted-foreground"
                                : person.leaving
                                  ? "text-destructive line-through"
                                  : "text-foreground",
                            )}
                          >
                            {person.name} {person.tbh && "(TBH)"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <InlineEdit
                            value={person.department || ""}
                            onSave={(value) => updatePerson(person.id, { department: value })}
                            listId="settings-departments"
                            placeholder="— None —"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <InlineEdit value={person.designation || ""} onSave={(value) => updatePerson(person.id, { designation: value })} />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{person.band || "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{person.pod || "—"}</td>
                        <td className="px-3 py-2">
                          <InlineEdit
                            value={person.reportingManager || ""}
                            onSave={(value) => handleReportingChange(person.id, person.name, value)}
                            listId="settings-managers"
                            placeholder="— None —"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Revenue Capacity" && (
          <RevenueCapacityPanel
            revenueTargets={revenueTargets}
            peopleByGroup={peopleByGroup}
            onTargetChange={handleRevTargetChange}
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            draggingPerson={draggingPerson}
          />
        )}

        {activeTab === "Users & Roles" && (
          isActuallyAdmin ? (
            <UsersTab />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}

        {activeTab === "Access Controls" && (
          isActuallyAdmin ? (
            <AccessControlsTab />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}

        {activeTab === "Notifications" && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Notification settings coming soon.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ── Revenue Capacity panel ──────────────────────────────────────────────────
function DraggablePersonChip({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-foreground cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-30",
      )}
      title="Drag to a different designation to regroup"
    >
      <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
      <span>{name}</span>
    </div>
  );
}

function DroppableRow({
  rowKey,
  children,
  isDraggingActive,
}: {
  rowKey: string;
  children: React.ReactNode;
  isDraggingActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: rowKey });
  return (
    <tr
      ref={setNodeRef}
      className={cn(
        "border-b border-border/50 transition-colors",
        isOver && isDraggingActive ? "bg-primary/10 ring-1 ring-inset ring-primary" : "hover:bg-secondary/20",
      )}
    >
      {children}
    </tr>
  );
}

function RevenueCapacityPanel({
  revenueTargets,
  peopleByGroup,
  onTargetChange,
  sensors,
  onDragStart,
  onDragEnd,
  draggingPerson,
}: {
  revenueTargets: ReturnType<typeof useStaffingData>["revenueTargets"];
  peopleByGroup: Map<string, ReturnType<typeof useStaffingData>["people"]>;
  onTargetChange: (dept: string, desg: string, val: number) => void;
  sensors: ReturnType<typeof useSensors>;
  onDragStart: (e: DragStartEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  draggingPerson: ReturnType<typeof useStaffingData>["people"][number] | null;
}) {
  // Build the union of (dept|desg) keys from both targets and people, so
  // unmapped people still show up.
  const rows = useMemo(() => {
    const set = new Set<string>();
    revenueTargets.forEach((t) => set.add(`${t.department}||${t.designation}`));
    peopleByGroup.forEach((_, k) => set.add(k));
    return Array.from(set)
      .map((k) => {
        const [department, designation] = k.split("||");
        const t = revenueTargets.find((x) => x.department === department && x.designation === designation);
        return {
          key: k,
          department,
          designation,
          capacity: t?.targetDealValuePerPerson || 0,
          people: peopleByGroup.get(k) || [],
        };
      })
      .sort((a, b) => a.department.localeCompare(b.department) || a.designation.localeCompare(b.designation));
  }, [revenueTargets, peopleByGroup]);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof rows>();
    rows.forEach((r) => {
      if (!m.has(r.department)) m.set(r.department, [] as typeof rows);
      m.get(r.department)!.push(r);
    });
    return m;
  }, [rows]);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Revenue Capacity</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Each row sets the target deal value per person for a Department + Designation. Drag any person chip
            into a different row to reassign their grouping — this updates the People table, Staffing capacity
            calculations, and the People view everywhere.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-[22%]">
                  Department
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-[24%]">
                  Designation
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-[18%]">
                  Revenue Capacity / Person
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  People (drag to regroup)
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(grouped.entries()).map(([dept, deptRows]) =>
                deptRows.map((row, idx) => (
                  <DroppableRow key={row.key} rowKey={row.key} isDraggingActive={!!draggingPerson}>
                    <td className="px-4 py-2 align-top">
                      {idx === 0 ? (
                        <span className="text-xs font-medium text-foreground">{dept}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">↳</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-foreground">{row.designation}</td>
                    <td className="px-4 py-2 align-top text-right">
                      <InlineEdit
                        value={String(row.capacity)}
                        onSave={(v) => onTargetChange(row.department, row.designation, Number(v) || 0)}
                        type="number"
                        placeholder="0"
                      />
                      <div className="text-[10px] text-muted-foreground tabular-nums">{formatINR(row.capacity)}</div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {row.people.length === 0 ? (
                          <span className="text-[11px] italic text-muted-foreground">— No one in this group —</span>
                        ) : (
                          row.people.map((p) => <DraggablePersonChip key={p.id} id={p.id} name={p.name} />)
                        )}
                      </div>
                    </td>
                  </DroppableRow>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DragOverlay>
        {draggingPerson ? (
          <div className="inline-flex items-center gap-1 rounded-md border border-primary bg-card px-2 py-0.5 text-[11px] text-foreground shadow-md">
            <GripVertical className="h-2.5 w-2.5 text-primary" />
            <span>{draggingPerson.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
