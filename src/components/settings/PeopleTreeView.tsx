import { useMemo, useState, useCallback } from "react";
import {
  ChevronRight, ChevronDown, GripVertical, Plus, Trash2, UserPlus, Search,
  Users, FolderPlus, AlertTriangle,
} from "lucide-react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Person } from "@/data/staffingData";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AddPersonDialog } from "./AddPersonDialog";
import { AddTeamDialog } from "./AddTeamDialog";

/* ────────────────────────────────────────────────────────────────────────── */

const NO_TEAM = "__no_team__";
const NO_SUBTEAM = "__no_subteam__";

interface Props {
  people: Person[];
  onAdd: (p: Person) => Promise<void> | void;
  onUpdate: (id: string, updates: Partial<Person>) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onRequestDelete: (p: Person) => void;
}

/* ── Build hierarchy ─────────────────────────────────────────────────────── */

interface ReportNode {
  person: Person;
  children: ReportNode[];
}

function buildReportTree(rows: Person[]): ReportNode[] {
  const byName = new Map<string, Person>();
  rows.forEach(p => byName.set(p.name, p));
  const childrenMap = new Map<string, Person[]>();
  rows.forEach(p => {
    const mgr = (p.reportingManager || "").trim();
    const key = mgr && byName.has(mgr) && mgr !== p.name ? mgr : "__root__";
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(p);
  });
  const build = (p: Person): ReportNode => ({
    person: p,
    children: (childrenMap.get(p.name) || [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(build),
  });
  return (childrenMap.get("__root__") || [])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(build);
}

/* ── Drag primitives ─────────────────────────────────────────────────────── */

function DraggableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={cn("touch-none", isDragging && "opacity-30")}>
      {children}
    </div>
  );
}

function DropTarget({
  id, children, kind, className,
}: { id: string; children: React.ReactNode; kind: "team" | "subteam" | "person"; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { kind } });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "bg-primary/5 ring-1 ring-primary/40 rounded-md")}>
      {children}
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function PeopleTreeView({ people, onAdd, onUpdate, onRequestDelete }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Local-only buckets so admins can pre-create empty teams/sub-teams.
  const [extraTeams, setExtraTeams] = useState<string[]>([]);
  const [extraSubteams, setExtraSubteams] = useState<Record<string, string[]>>({});

  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addPersonDefaults, setAddPersonDefaults] = useState<{ team?: string; subTeam?: string }>({});
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [addSubteamFor, setAddSubteamFor] = useState<string | null>(null);

  const matchesSearch = useCallback((p: Person) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.department || "").toLowerCase().includes(q) ||
      (p.subTeam || "").toLowerCase().includes(q) ||
      (p.designation || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  }, [search]);

  const visiblePeople = useMemo(() => people.filter(matchesSearch), [people, matchesSearch]);

  // Group people by team → sub-team.
  const grouped = useMemo(() => {
    const teams = new Map<string, Map<string, Person[]>>();
    // Seed with extras so empty buckets show.
    extraTeams.forEach(t => { if (!teams.has(t)) teams.set(t, new Map()); });
    Object.entries(extraSubteams).forEach(([t, list]) => {
      if (!teams.has(t)) teams.set(t, new Map());
      list.forEach(s => { if (!teams.get(t)!.has(s)) teams.get(t)!.set(s, []); });
    });
    visiblePeople.forEach(p => {
      const t = p.department || NO_TEAM;
      const s = p.subTeam || NO_SUBTEAM;
      if (!teams.has(t)) teams.set(t, new Map());
      const inner = teams.get(t)!;
      if (!inner.has(s)) inner.set(s, []);
      inner.get(s)!.push(p);
    });
    return teams;
  }, [visiblePeople, extraTeams, extraSubteams]);

  const sortedTeams = useMemo(() => Array.from(grouped.keys()).sort((a, b) => {
    if (a === NO_TEAM) return 1;
    if (b === NO_TEAM) return -1;
    return a.localeCompare(b);
  }), [grouped]);

  // Auto-expand teams/subteams when searching.
  const isExpanded = (key: string, defaultOpen = false) => {
    if (search.trim()) return true;
    return expanded[key] ?? defaultOpen;
  };
  const toggle = (key: string) => setExpanded(e => ({ ...e, [key]: !(e[key] ?? false) }));

  /* ── Drag handlers ─── */

  const handleDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggingId(null);
    const personId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : "";
    if (!overId) return;
    const dragged = people.find(p => p.id === personId);
    if (!dragged) return;

    const data = (e.over as any)?.data?.current as { kind?: string } | undefined;
    const kind = data?.kind;

    if (kind === "team") {
      const team = overId.replace(/^team::/, "");
      const targetTeam = team === NO_TEAM ? "" : team;
      if ((dragged.department || "") === targetTeam) return;
      const subteamsInTarget = grouped.get(team)?.keys
        ? Array.from(grouped.get(team)!.keys()) : [];
      const keepSub = subteamsInTarget.includes(dragged.subTeam || "");
      await onUpdate(personId, {
        department: targetTeam,
        subTeam: keepSub ? (dragged.subTeam || "") : "",
      });
      toast.success(`Moved to ${targetTeam || "—"}`);
      return;
    }
    if (kind === "subteam") {
      const [, team, sub] = overId.split("::");
      const targetTeam = team === NO_TEAM ? "" : team;
      const targetSub = sub === NO_SUBTEAM ? "" : sub;
      if ((dragged.department || "") === targetTeam && (dragged.subTeam || "") === targetSub) return;
      await onUpdate(personId, { department: targetTeam, subTeam: targetSub });
      toast.success(`Moved to ${targetSub || "—"}`);
      return;
    }
    if (kind === "person") {
      const targetId = overId.replace(/^person::/, "");
      const target = people.find(p => p.id === targetId);
      if (!target) return;
      if (target.id === dragged.id) return;
      if (target.name === dragged.name) return;
      // Loop guard: don't let a manager report to one of their descendants.
      const isDescendantOf = (rootName: string, candidateName: string): boolean => {
        const stack = [rootName];
        const seen = new Set<string>();
        while (stack.length) {
          const cur = stack.pop()!;
          if (seen.has(cur)) continue;
          seen.add(cur);
          for (const p of people) {
            if ((p.reportingManager || "") === cur) {
              if (p.name === candidateName) return true;
              stack.push(p.name);
            }
          }
        }
        return false;
      };
      if (isDescendantOf(dragged.name, target.name)) {
        toast.error("Can't report to one of your own reports");
        return;
      }
      await onUpdate(personId, { reportingManager: target.name });
      toast.success(`${dragged.name} now reports to ${target.name}`);
    }
  };

  /* ── Render helpers ─── */

  const renderPersonRow = (p: Person, indent: number) => {
    const isDrag = draggingId === p.id;
    return (
      <DropTarget id={`person::${p.id}`} kind="person" key={p.id}>
        <DraggableRow id={p.id}>
          <div
            style={{ paddingLeft: 12 + indent * 18 }}
            className={cn(
              "group flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-secondary/30 cursor-grab",
              isDrag && "opacity-40",
              p.leaving && "opacity-60",
            )}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            <div className="flex-1 min-w-0 flex items-baseline gap-2">
              <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
              <span className="text-[11px] text-muted-foreground truncate">{p.designation || "—"}</span>
              {p.band && (
                <span className="text-[10px] rounded px-1 py-0.5 border border-border text-muted-foreground">{p.band}</span>
              )}
              {p.tbh && (
                <span className="text-[10px] italic text-muted-foreground">(TBH)</span>
              )}
              {p.leaving && (
                <span className="text-[10px] font-medium text-destructive">· Leaving</span>
              )}
            </div>
            {p.email && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={p.email}>{p.email}</span>
            )}
            <button
              type="button"
              onClick={() => onUpdate(p.id, { leaving: !p.leaving })}
              className={cn(
                "h-6 px-2 rounded border text-[10px] font-medium transition-colors",
                p.leaving
                  ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                  : "border-border text-muted-foreground hover:bg-secondary/50",
              )}
              title={p.leaving ? "Unmark as leaving" : "Mark as leaving"}
            >
              {p.leaving ? "Unmark leaving" : "Leaving"}
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(p)}
              className="h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100"
              title="Delete person"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </DraggableRow>
      </DropTarget>
    );
  };

  /**
   * Inside a sub-team, build a small reporting tree out of just those people
   * so reports are visually nested under their managers.
   */
  const renderSubteamPeople = (peopleInSub: Person[]) => {
    const nodes = buildReportTree(peopleInSub);
    const render = (n: ReportNode, depth: number): React.ReactNode => (
      <div key={n.person.id}>
        {renderPersonRow(n.person, depth)}
        {n.children.map(c => render(c, depth + 1))}
      </div>
    );
    return nodes.map(n => render(n, 0));
  };

  /* ── Render ─── */

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search people, teams, designations…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddTeamOpen(true)}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border text-xs hover:bg-secondary/50"
          >
            <FolderPlus className="h-3.5 w-3.5" /> Add team
          </button>
          <button
            type="button"
            onClick={() => { setAddPersonDefaults({}); setAddPersonOpen(true); }}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-xs font-medium"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add person
          </button>
        </div>
      </div>

      {/* Tree */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
          {sortedTeams.map(team => {
            const subMap = grouped.get(team)!;
            const teamLabel = team === NO_TEAM ? "Unassigned" : team;
            const totalPeople = Array.from(subMap.values()).reduce((sum, l) => sum + l.length, 0);
            const teamKey = `team::${team}`;
            const isOpen = isExpanded(teamKey, true);
            const subKeys = Array.from(subMap.keys()).sort((a, b) => {
              if (a === NO_SUBTEAM) return 1;
              if (b === NO_SUBTEAM) return -1;
              return a.localeCompare(b);
            });
            // Detect "no real subteams": only the placeholder bucket.
            const onlyDefault = subKeys.length === 1 && subKeys[0] === NO_SUBTEAM;

            return (
              <div key={team} className="px-2 py-2">
                <DropTarget id={teamKey} kind="team">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => toggle(teamKey)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{teamLabel}</span>
                    <span className="text-[10px] text-muted-foreground">{totalPeople} {totalPeople === 1 ? "person" : "people"}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAddSubteamFor(team === NO_TEAM ? "" : team)}
                        className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-secondary/50"
                      >
                        <Plus className="h-3 w-3" /> Sub-team
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddPersonDefaults({ team: team === NO_TEAM ? "" : team }); setAddPersonOpen(true); }}
                        className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-secondary/50"
                      >
                        <UserPlus className="h-3 w-3" /> Person
                      </button>
                    </div>
                  </div>
                </DropTarget>

                {isOpen && (
                  <div className="pl-4 mt-1 space-y-1">
                    {subKeys.map(sub => {
                      const subKey = `subteam::${team}::${sub}`;
                      const subOpen = isExpanded(subKey, true);
                      const list = subMap.get(sub) || [];
                      const subLabel = sub === NO_SUBTEAM ? (onlyDefault ? "All" : "No sub-team") : sub;

                      return (
                        <div key={sub}>
                          <DropTarget id={subKey} kind="subteam">
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-secondary/20">
                              <button
                                type="button"
                                onClick={() => toggle(subKey)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {subOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                              <span className="text-xs font-medium text-foreground">{subLabel}</span>
                              <span className="text-[10px] text-muted-foreground">{list.length}</span>
                              <div className="ml-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddPersonDefaults({
                                      team: team === NO_TEAM ? "" : team,
                                      subTeam: sub === NO_SUBTEAM ? "" : sub,
                                    });
                                    setAddPersonOpen(true);
                                  }}
                                  className="h-6 px-1.5 inline-flex items-center gap-1 rounded text-[10px] text-muted-foreground hover:bg-secondary/50"
                                >
                                  <Plus className="h-3 w-3" /> Person
                                </button>
                              </div>
                            </div>
                          </DropTarget>

                          {subOpen && (
                            <div className="pl-4">
                              {list.length > 0 ? (
                                renderSubteamPeople(list)
                              ) : (
                                <div className="py-2 px-3 text-[11px] text-muted-foreground italic">
                                  No people. Drop someone here or click + Person.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {sortedTeams.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
              <AlertTriangle className="h-4 w-4" /> No people match your search.
            </div>
          )}
        </div>

        <DragOverlay>
          {draggingId ? (
            <div className="rounded-md border border-primary/60 bg-card px-3 py-1.5 text-xs font-medium shadow-sm">
              {people.find(p => p.id === draggingId)?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Dialogs */}
      <AddPersonDialog
        open={addPersonOpen}
        onOpenChange={setAddPersonOpen}
        people={people}
        defaultDepartment={addPersonDefaults.team}
        defaultSubTeam={addPersonDefaults.subTeam}
        onAdd={onAdd}
      />
      <AddTeamDialog
        open={addTeamOpen}
        onOpenChange={setAddTeamOpen}
        mode="team"
        onCreate={(name) => {
          setExtraTeams(t => t.includes(name) ? t : [...t, name]);
          setExpanded(e => ({ ...e, [`team::${name}`]: true }));
        }}
      />
      <AddTeamDialog
        open={addSubteamFor !== null}
        onOpenChange={(o) => { if (!o) setAddSubteamFor(null); }}
        mode="subteam"
        parentTeam={addSubteamFor || ""}
        onCreate={(name) => {
          if (addSubteamFor === null) return;
          const team = addSubteamFor;
          setExtraSubteams(prev => {
            const list = new Set(prev[team] || []);
            list.add(name);
            return { ...prev, [team]: Array.from(list) };
          });
          setExpanded(e => ({ ...e, [`team::${team}`]: true, [`subteam::${team || NO_TEAM}::${name}`]: true }));
        }}
      />
    </div>
  );
}