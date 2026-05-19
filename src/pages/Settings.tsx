import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useStaffingQueries } from "@/hooks/queries/useStaffingQueries";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { Loader2, Pencil, Check, X, Search, Trash2, LayoutGrid, Table as TableIcon, ListTree, Network, AtSign } from "lucide-react";
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
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { GripVertical } from "lucide-react";
import { PeopleTreeView } from "@/components/settings/PeopleTreeView";
import { OrgChartView } from "@/components/settings/OrgChartView";
import { EmailMappingTable } from "@/components/settings/EmailMappingTable";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

const tabs = [
  "People & Reporting",
  "Revenue Capacity",
  "Users & Roles",
  "Access Controls",
  "Notifications",
] as const;
type SettingsTab = typeof tabs[number];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground pt-0.5">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

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
  useCurrencyVersion();
  const [activeTab, setActiveTab] = useState<SettingsTab>("People & Reporting");
  const { people, revenueTargets, loading } = useStaffingQueries();
  const { addPerson, updatePerson, deletePerson, setRevenueTargets } = useStaffingMutations();
  const { isActuallyAdmin } = useUserRole();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [draggingPersonId, setDraggingPersonId] = useState<string | null>(null);
  const [peopleView, setPeopleView] = useState<"tree" | "org" | "email">("tree");
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
            <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs w-fit">
              {([
                { id: "tree", label: "Tree", Icon: ListTree },
                { id: "org", label: "Org chart", Icon: Network },
                { id: "email", label: "Email mapping", Icon: AtSign },
              ] as const).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPeopleView(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-colors",
                    peopleView === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <t.Icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
            </div>

            {peopleView === "tree" && (
              <PeopleTreeView
                people={people}
                onAdd={addPerson}
                onUpdate={updatePerson}
                onDelete={deletePerson}
                onRequestDelete={(p) => setConfirmDelete({ id: p.id, name: p.name })}
              />
            )}
            {peopleView === "org" && (
              <OrgChartView
                people={people}
                onUpdate={updatePerson}
                onRequestDelete={(p) => setConfirmDelete({ id: p.id, name: p.name })}
              />
            )}
            {peopleView === "email" && (
              <EmailMappingTable people={people} onUpdate={updatePerson} />
            )}
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
          <NotificationsPanel />
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the person from People &amp; Reporting. Their staffing assignments
              will be unlinked. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePerson}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ── Notifications panel ────────────────────────────────────────────────────
function NotificationsPanel() {
  const { user } = useAuth();
  const [optIn, setOptIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("weekly_summary_opt_in").eq("user_id", user.id).maybeSingle();
      setOptIn(data?.weekly_summary_opt_in !== false);
      setLoading(false);
    })();
  }, [user]);
  const onToggle = async (v: boolean) => {
    setOptIn(v);
    await supabase.from("profiles").update({ weekly_summary_opt_in: v }).eq("user_id", user!.id);
    toast.success(v ? "You'll get the weekly summary on Slack every Monday" : "Weekly summary turned off");
  };
  const sendTest = async () => {
    if (!user?.email) return;
    setSendingTest(true);
    const { data, error } = await supabase.functions.invoke("weekly-summary-slack", { body: { onlyEmail: user.email } });
    setSendingTest(false);
    if (error) toast.error(error.message);
    else if (!(data as any)?.results?.length) toast.error("No matching Slack user found for your account");
    else if ((data as any).results[0].sent === false) toast.error("Send failed: " + ((data as any).results[0].error || "unknown"));
    else toast.success("Test summary sent — check your Slack DMs");
  };
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Weekly Slack summary</h2>
        <p className="text-xs text-muted-foreground mt-1">Every Monday at 10:00 IST you'll get a Slack DM recapping last week's tasks, MBRs and RGY updates plus what still needs attention. Scoped to your role: admins see all, VSDs see their team, BOPMs see their deals.</p>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">DM me the weekly summary</p>
          <p className="text-[11px] text-muted-foreground">Delivered via Slack to your linked account</p>
        </div>
        <Switch checked={optIn} onCheckedChange={onToggle} disabled={loading} />
      </div>
      <div className="border-t border-border pt-4">
        <button onClick={sendTest} disabled={sendingTest} className="text-xs text-primary hover:underline disabled:opacity-50">
          {sendingTest ? "Sending…" : "Send me a test Slack DM now"}
        </button>
      </div>
    </div>
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
