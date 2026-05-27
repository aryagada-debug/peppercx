import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Plus, Check, X, Pencil, ChevronRight, ChevronDown, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ColHeader, type SortState } from "@/components/table/ColHeader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddPersonDialog } from "@/components/settings/AddPersonDialog";
import { AddTeamDialog } from "@/components/settings/AddTeamDialog";
import { useTaxonomyQuery } from "@/hooks/queries/useTaxonomyQuery";
import { resolvePersonRoleTypeId } from "@/lib/peopleGrouping";
import { ROLE_TYPE_TO_DEPT, DEPARTMENT_LABELS, ROLE_SLOTS } from "@/data/staffingData";

interface Props {
  people: Person[];
  assignments?: StaffingAssignment[];
  deals?: Deal[];
  onAdd: (p: Person) => void | Promise<void>;
  onUpdate: (id: string, updates: Partial<Person>) => void | Promise<void>;
  onRequestDelete: (p: Person) => void;
}

function InlineText({
  value,
  onSave,
  placeholder = "—",
  list,
  className,
  type = "text",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  list?: string;
  className?: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const save = () => {
    if (local.trim() !== value) onSave(local.trim());
    setEditing(false);
  };
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          list={list}
          type={type}
          className="h-8 text-sm"
          autoFocus
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setLocal(value);
              setEditing(false);
            }
          }}
        />
        <button onClick={save} type="button" className="text-primary">
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={() => {
            setLocal(value);
            setEditing(false);
          }}
          type="button"
          className="text-muted-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setLocal(value);
        setEditing(true);
      }}
      className={cn("group/edit flex items-center gap-1 text-left w-full", className)}
    >
      <span className={cn("text-sm truncate", value ? "text-foreground" : "text-muted-foreground")}>
        {value || placeholder}
      </span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100 shrink-0" />
    </button>
  );
}

const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
const USD = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);

/* ------------------------------------------------------------------ */
/* Team derivation                                                     */
/* ------------------------------------------------------------------ */

const BUILT_IN_TEAMS = ["VSD", "Content team", "SEO team", "Creative team", "Other"] as const;
type TeamName = string;

const VSD_SUBTEAM_ORDER = [
  "Aamir Khan",
  "Sumit Shekhawat",
  "Aditya Shaw",
  "Sneha Iyer",
  "Neema Jayadas",
  "Unassigned",
];
const CREATIVE_SUBTEAM_ORDER = ["Copy", "Design", "Strategy", "Video", "Other"];

/* Seniority ranking by team. Lower number = more senior. */
const SENIORITY_BY_TEAM: Record<TeamName, RegExp[]> = {
  VSD: [/^VSD$/i, /principal\s*bopm/i, /senior\s*bopm/i, /\bbopm\b/i],
  "Content team": [/managing\s*editor/i, /content\s*lead/i, /senior\s*content\s*editor/i, /content\s*editor/i, /editor/i],
  "SEO team": [/seo\s*leader/i, /seo\s*growth\s*lead/i, /seo\s*operations/i, /seo/i],
  "Creative team": [/lead/i, /senior/i],
  Other: [],
};

function seniorityRank(team: TeamName, designation: string): number {
  const patterns = SENIORITY_BY_TEAM[team] || [];
  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(designation || "")) return i;
  }
  return 999;
}

function classifyPerson(
  p: Person,
  byName: Map<string, Person>,
): { team: TeamName; subTeam: string } {
  const dept = (p.department || "").trim();
  const desig = (p.designation || "").trim();

  // Walk reporting chain to find a VSD root
  const findVsdRoot = (): string | null => {
    let cur: Person | undefined = p;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if ((cur.designation || "").trim().toUpperCase() === "VSD") return cur.name;
      const mgr = (cur.reportingManager || "").trim().toLowerCase();
      cur = mgr ? byName.get(mgr) : undefined;
    }
    return null;
  };

  if (dept === "Delivery Ops and CS" || desig.toUpperCase() === "VSD") {
    const root = findVsdRoot();
    return { team: "VSD", subTeam: root || "Unassigned" };
  }
  if (dept === "Capability - SEO Team" || /SEO/i.test(desig)) {
    return { team: "SEO team", subTeam: "" };
  }
  if (
    dept === "Capability - Quality Team" ||
    /Content|Editor/i.test(desig)
  ) {
    return { team: "Content team", subTeam: "" };
  }
  if (
    dept === "Capability - Creative Team" ||
    dept === "Capability - Video Production Team"
  ) {
    let sub = "Design";
    if (/strateg/i.test(desig)) sub = "Strategy";
    else if (/copy/i.test(desig)) sub = "Copy";
    else if (/video|producer|production/i.test(desig) || /Video/i.test(dept)) sub = "Video";
    return { team: "Creative team", subTeam: sub };
  }
  if (/BOPM/i.test(desig)) {
    const root = findVsdRoot();
    return { team: "VSD", subTeam: root || "Unassigned" };
  }
  return { team: "Other", subTeam: "" };
}

/* ------------------------------------------------------------------ */
/* Resizable column hook                                               */
/* ------------------------------------------------------------------ */

type ColKey = "name" | "designation" | "email" | "reportsTo" | "revType" | "timeUtil" | "revUtil";
const DEFAULT_WIDTHS: Record<ColKey, number> = {
  name: 220,
  designation: 220,
  email: 240,
  reportsTo: 180,
  revType: 360,
  timeUtil: 180,
  revUtil: 180,
};

function useResizableColumns() {
  const [widths, setWidths] = useState<Record<ColKey, number>>(() => {
    try {
      const raw = localStorage.getItem("people-team-cols");
      if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_WIDTHS;
  });
  useEffect(() => {
    try {
      localStorage.setItem("people-team-cols", JSON.stringify(widths));
    } catch {}
  }, [widths]);

  const dragRef = useRef<{ key: ColKey; startX: number; startW: number } | null>(null);
  const onMouseDown = (key: ColKey) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { key, startX: e.clientX, startW: widths[key] };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { key: k, startX, startW } = dragRef.current;
      const w = Math.max(80, startW + (ev.clientX - startX));
      setWidths((p) => ({ ...p, [k]: w }));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return { widths, onMouseDown };
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none hover:bg-primary/40 active:bg-primary"
      title="Drag to resize"
    />
  );
}

function UtilBar({ value, hint }: { value: number; hint?: string }) {
  const v = Math.max(0, Math.round(value));
  const capped = Math.min(v, 100);
  const color =
    v > 100 ? "bg-destructive"
    : v >= 85 ? "bg-warning"
    : v >= 30 ? "bg-positive"
    : v > 0 ? "bg-info"
    : "bg-muted";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-sm overflow-hidden bg-muted min-w-[80px]">
          <div className={cn("h-full rounded-sm", color)} style={{ width: `${capped}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums w-10 text-right">{v}%</span>
      </div>
      {hint && <div className="text-[10px] text-muted-foreground tabular-nums">{hint}</div>}
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  const s = (status || "").trim();
  const l = s.toLowerCase();
  let tone = "bg-muted text-muted-foreground border-border";
  if (/active|live|running|won|signed/.test(l)) tone = "bg-positive/15 text-positive border-positive/30";
  else if (/pitch|proposal|negotiat|prospect/.test(l)) tone = "bg-info/15 text-info border-info/30";
  else if (/pause|hold|renew/.test(l)) tone = "bg-warning/15 text-warning border-warning/30";
  else if (/lost|closed|churn|dropped/.test(l)) tone = "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", tone)}>
      {s || "—"}
    </span>
  );
}

export function PeopleReportingTable({ people, assignments = [], deals = [], onAdd, onUpdate, onRequestDelete }: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ department?: string; subTeam?: string }>({});
  const [teamDialog, setTeamDialog] = useState<{ mode: "team" | "subteam"; parent?: string } | null>(null);
  const [customBump, setCustomBump] = useState(0);
  const { widths, onMouseDown } = useResizableColumns();
  const { data: taxonomy } = useTaxonomyQuery();
  const navigate = useNavigate();
  const [sortState, setSortState] = useState<SortState>({ sortKey: null, sortDir: "asc" });
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const onSort = (k: string) =>
    setSortState((s) => ({
      sortKey: k,
      sortDir: s.sortKey === k && s.sortDir === "asc" ? "desc" : "asc",
    }));
  const setFilter = (k: string, v: string) =>
    setColFilters((p) => ({ ...p, [k]: v }));
  const clearFilter = (k: string) =>
    setColFilters((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });

  // Build a lookup of deals + per-person assignment lists.
  const dealById = useMemo(() => {
    const m = new Map<string, Deal>();
    deals.forEach((d) => m.set(d.id, d));
    return m;
  }, [deals]);

  const assignmentsByPerson = useMemo(() => {
    const m: Record<string, StaffingAssignment[]> = {};
    assignments.forEach((a) => {
      (m[a.personId] = m[a.personId] || []).push(a);
    });
    return m;
  }, [assignments]);

  // Time utilisation = sum allocation %. Revenue utilisation = allocated MRR
  // from RETAINER deals divided by the person's revenue capacity.
  const utilByPerson = useMemo(() => {
    const m: Record<string, { time: number; revenue: number; allocatedMrr: number }> = {};
    for (const p of people) {
      const rows = assignmentsByPerson[p.id] || [];
      const time = rows.reduce((n, a) => n + (a.allocationPct || 0), 0);
      let allocatedMrr = 0;
      for (const a of rows) {
        const d = dealById.get(a.dealId);
        if (!d || d.dealType !== "Retainer") continue;
        allocatedMrr += (d.mrr || 0) * (a.allocationPct || 0) / 100;
      }
      const cap = p.revenueTargetPerPerson || 0;
      const revenue = cap > 0 ? (allocatedMrr / cap) * 100 : 0;
      m[p.id] = { time, revenue, allocatedMrr };
    }
    return m;
  }, [people, assignmentsByPerson, dealById]);

  // Custom teams + sub-teams persisted in localStorage.
  const customTeams = useMemo<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("people-ops.custom-teams") || "[]"); }
    catch { return []; }
  }, [customBump]);
  const customSubsByTeam = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("people-ops.custom-subs:")) continue;
        const parent = k.slice("people-ops.custom-subs:".length);
        out[parent] = JSON.parse(localStorage.getItem(k) || "[]");
      }
    } catch {}
    return out;
  }, [customBump]);

  const TEAM_ORDER = useMemo(
    () => Array.from(new Set([...BUILT_IN_TEAMS, ...customTeams])),
    [customTeams],
  );

  const byName = useMemo(() => {
    const m = new Map<string, Person>();
    people.forEach((p) => m.set(p.name.trim().toLowerCase(), p));
    return m;
  }, [people]);

  const filtered = useMemo(() => {
    let list = [...people];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.designation || "").toLowerCase().includes(q) ||
          (p.email || "").toLowerCase().includes(q) ||
          (p.reportingManager || "").toLowerCase().includes(q),
      );
    }
    const txt = (k: string) => (colFilters[k] || "").trim().toLowerCase();
    const fName = txt("name"), fDesig = txt("designation"), fEmail = txt("email"), fRep = txt("reportsTo");
    if (fName) list = list.filter((p) => p.name.toLowerCase().includes(fName));
    if (fDesig) list = list.filter((p) => (p.designation || "").toLowerCase().includes(fDesig));
    if (fEmail) list = list.filter((p) => (p.email || "").toLowerCase().includes(fEmail));
    if (fRep) list = list.filter((p) => (p.reportingManager || "").toLowerCase() === fRep);
    // Sort
    const { sortKey, sortDir } = sortState;
    const dir = sortDir === "asc" ? 1 : -1;
    const getUtil = (p: Person) => utilByPerson[p.id] || { time: 0, revenue: 0, allocatedMrr: 0 };
    if (sortKey) {
      list.sort((a, b) => {
        let av: any, bv: any;
        switch (sortKey) {
          case "name": av = a.name; bv = b.name; break;
          case "designation": av = a.designation || ""; bv = b.designation || ""; break;
          case "email": av = a.email || ""; bv = b.email || ""; break;
          case "reportsTo": av = a.reportingManager || ""; bv = b.reportingManager || ""; break;
          case "revType": av = a.revenueTargetPerPerson || 0; bv = b.revenueTargetPerPerson || 0; break;
          case "timeUtil": av = getUtil(a).time; bv = getUtil(b).time; break;
          case "revUtil": av = getUtil(a).revenue; bv = getUtil(b).revenue; break;
          default: av = a.name; bv = b.name;
        }
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [people, search, colFilters, sortState, utilByPerson]);

  // Group filtered people by team -> sub-team
  const grouped = useMemo(() => {
    // Group by Department → Role Type using the new taxonomy.
    // Falls back to legacy classification only for people with no resolvable role.
    const departments = taxonomy?.departments ?? [];
    const roleTypesByDept = taxonomy?.roleTypesByDept;
    const roleTypeById = taxonomy?.roleTypeById;

    // bucket: deptName -> roleTypeName -> Person[]
    const buckets = new Map<string, Map<string, Person[]>>();
    const unmapped: Person[] = [];

    for (const p of filtered) {
      const rtId = resolvePersonRoleTypeId(p, taxonomy);
      if (!rtId) { unmapped.push(p); continue; }
      const rt = roleTypeById?.get(rtId);
      const deptId = rt?.departmentId ?? ROLE_TYPE_TO_DEPT[rtId];
      const deptName = (deptId && (taxonomy?.departmentById.get(deptId)?.name ?? DEPARTMENT_LABELS[deptId])) || "Unassigned";
      const roleName = rt?.name ?? (ROLE_SLOTS.find(s => s.roleKey === rtId)?.roleLabel ?? rtId);
      if (!buckets.has(deptName)) buckets.set(deptName, new Map());
      const m = buckets.get(deptName)!;
      if (!m.has(roleName)) m.set(roleName, []);
      m.get(roleName)!.push(p);
    }

    const ordered: { team: TeamName; subs: { sub: string; rows: Person[] }[]; total: number }[] = [];
    const seen = new Set<string>();

    for (const d of departments) {
      const m = buckets.get(d.name);
      if (!m) continue;
      const order = (roleTypesByDept?.get(d.id) || []).map(r => r.name);
      const subs = Array.from(m.entries())
        .map(([sub, rows]) => ({ sub, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) }))
        .sort((a, b) => {
          const ai = order.indexOf(a.sub);
          const bi = order.indexOf(b.sub);
          if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          return a.sub.localeCompare(b.sub);
        });
      const total = subs.reduce((n, s) => n + s.rows.length, 0);
      ordered.push({ team: d.name, subs, total });
      seen.add(d.name);
    }
    // Any extra dept names not in taxonomy (defensive).
    for (const [name, m] of buckets.entries()) {
      if (seen.has(name)) continue;
      const subs = Array.from(m.entries())
        .map(([sub, rows]) => ({ sub, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) }))
        .sort((a, b) => a.sub.localeCompare(b.sub));
      ordered.push({ team: name, subs, total: subs.reduce((n, s) => n + s.rows.length, 0) });
    }
    if (unmapped.length) {
      ordered.push({
        team: "Unassigned",
        subs: [{ sub: "No role type set", rows: unmapped.sort((a, b) => a.name.localeCompare(b.name)) }],
        total: unmapped.length,
      });
    }
    return ordered;
  }, [filtered, taxonomy]);

  const toggle = (key: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const managerNames = useMemo(
    () =>
      Array.from(new Set(people.map((p) => p.name).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [people],
  );

  const openAdd = (defaults: { department?: string; subTeam?: string } = {}) => {
    setAddDefaults(defaults);
    setAddOpen(true);
  };

  // Persist custom (empty) teams / sub-teams in localStorage so headers
  // appear in the grouped view even before any person is assigned.
  const persistCustomTeam = (name: string) => {
    try {
      const key = "people-ops.custom-teams";
      const list: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (!list.includes(name)) localStorage.setItem(key, JSON.stringify([...list, name]));
    } catch {}
    setCustomBump((n) => n + 1);
    toast.success(`Team "${name}" added. Assign people to keep it.`);
  };
  const persistCustomSubTeam = (parent: string, name: string) => {
    try {
      const key = `people-ops.custom-subs:${parent}`;
      const list: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (!list.includes(name)) localStorage.setItem(key, JSON.stringify([...list, name]));
    } catch {}
    setCustomBump((n) => n + 1);
    toast.success(`Sub-team "${name}" added under ${parent}.`);
  };

  return (
    <div className="space-y-3">
      <datalist id="people-reporting-managers">
        {managerNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, designation, email, or manager…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {people.length}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => openAdd()}>Add person</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTeamDialog({ mode: "subteam" })}>
              Add sub-team
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTeamDialog({ mode: "team" })}>
              Add team
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AddPersonDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        people={people}
        defaultDepartment={addDefaults.department}
        defaultSubTeam={addDefaults.subTeam}
        onAdd={onAdd}
      />

      <AddTeamDialog
        open={!!teamDialog}
        onOpenChange={(o) => !o && setTeamDialog(null)}
        mode={teamDialog?.mode || "team"}
        parentTeam={teamDialog?.parent}
        availableTeams={TEAM_ORDER}
        onCreate={async (name, parent) => {
          if (teamDialog?.mode === "team") persistCustomTeam(name);
          else if (parent) persistCustomSubTeam(parent, name);
        }}
      />

      <div className="overflow-auto rounded-xl border border-border bg-card">
        <table className="text-sm" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: widths.name }} />
            <col style={{ width: widths.designation }} />
            <col style={{ width: widths.email }} />
            <col style={{ width: widths.reportsTo }} />
            <col style={{ width: widths.revType }} />
            <col style={{ width: widths.timeUtil }} />
            <col style={{ width: widths.revUtil }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              {([
                ["name", "Name", undefined],
                ["designation", "Designation", undefined],
                ["email", "Email", undefined],
                ["reportsTo", "Reports to", managerNames],
                ["revType", "Revenue capacity", undefined],
                ["timeUtil", "Time utilisation", undefined],
                ["revUtil", "Revenue utilisation", undefined],
              ] as [ColKey, string, string[] | undefined][]).map(([k, label, options]) => (
                <ColHeader
                  key={k}
                  label={label}
                  colKey={k}
                  sortKey={k}
                  numeric={k === "revType" || k === "timeUtil" || k === "revUtil"}
                  options={options}
                  sortState={sortState}
                  onSort={onSort}
                  colFilters={colFilters}
                  openFilter={openFilter}
                  setOpenFilter={setOpenFilter}
                  setFilter={setFilter}
                  clearFilter={clearFilter}
                  onResizeStart={onMouseDown(k)}
                />
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ team, subs, total }) => {
              const teamKey = `team:${team}`;
              const teamCollapsed = collapsed.has(teamKey);
              return (
                <Fragment key={teamKey}>
                   <tr className="border-t border-border bg-secondary/30">
                     <td colSpan={8} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggle(teamKey)}
                        className="flex items-center gap-2 text-left"
                      >
                        {teamCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span className="text-sm font-medium">{team}</span>
                        <span className="text-xs text-muted-foreground">({total})</span>
                      </button>
                    </td>
                  </tr>
                  {!teamCollapsed &&
                    subs.map(({ sub, rows }) => {
                      const subKey = `sub:${team}:${sub}`;
                      const hasSub = sub !== "";
                      const subCollapsed = collapsed.has(subKey);
                      return (
                        <Fragment key={subKey}>
                           {hasSub && (
                             <tr className="border-t border-border/50 bg-secondary/10">
                               <td colSpan={8} className="px-3 py-1.5 pl-8">
                                <button
                                  type="button"
                                  onClick={() => toggle(subKey)}
                                  className="flex items-center gap-2 text-left"
                                >
                                  {subCollapsed ? (
                                    <ChevronRight className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                  <span className="text-sm text-foreground/80">{sub}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({rows.length})
                                  </span>
                                </button>
                              </td>
                            </tr>
                          )}
                          {!subCollapsed &&
                            rows.map((p) => {
                              const currency = p.revenueTargetCurrency || "INR";
                              const symbol = currency === "USD" ? "$" : "₹";
                              const fmt = currency === "USD" ? USD : INR;
                              const u = utilByPerson[p.id] || { time: 0, revenue: 0, allocatedMrr: 0 };
                              const isExpanded = expanded.has(p.id);
                              const personDeals = (assignmentsByPerson[p.id] || [])
                                .map((a) => ({ a, d: dealById.get(a.dealId) }))
                                .filter((x) => x.d);
                              return (
                                <Fragment key={p.id}>
                                <tr
                                  className="border-t border-border/40 hover:bg-secondary/20 cursor-pointer"
                                  onClick={() =>
                                    setExpanded((s) => {
                                      const n = new Set(s);
                                      n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                                      return n;
                                    })
                                  }
                                >
                                  <td className="px-3 py-1.5 pl-10" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpanded((s) => {
                                            const n = new Set(s);
                                            n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                                            return n;
                                          });
                                        }}
                                        className="rounded p-0.5 hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0"
                                        aria-label={isExpanded ? "Collapse" : "Expand"}
                                      >
                                        {isExpanded
                                          ? <ChevronDown className="h-3.5 w-3.5" />
                                          : <ChevronRight className="h-3.5 w-3.5" />}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <InlineText
                                      value={p.name}
                                      onSave={(v) => v && onUpdate(p.id, { name: v })}
                                    />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                                    <InlineText
                                      value={p.designation || ""}
                                      onSave={(v) => onUpdate(p.id, { designation: v })}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                                    <InlineText
                                      value={p.email || ""}
                                      onSave={(v) => onUpdate(p.id, { email: v })}
                                      placeholder="—"
                                      type="email"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                                    <InlineText
                                      value={p.reportingManager || ""}
                                      onSave={(v) => {
                                        if (v && v === p.name) {
                                          toast.error("A person can't report to themselves");
                                          return;
                                        }
                                        onUpdate(p.id, { reportingManager: v });
                                      }}
                                      list="people-reporting-managers"
                                      placeholder="—"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        value={currency}
                                        onChange={(e) =>
                                          onUpdate(p.id, {
                                            revenueTargetCurrency: e.target.value as
                                              | "INR"
                                              | "USD",
                                          })
                                        }
                                        className="h-8 shrink-0 rounded border border-input bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                      >
                                        <option value="INR">₹ INR</option>
                                        <option value="USD">$ USD</option>
                                      </select>
                                      <div className="relative w-32 shrink-0">
                                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                          {symbol}
                                        </span>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={1000}
                                          value={p.revenueTargetPerPerson ?? 0}
                                          onChange={(e) =>
                                            onUpdate(p.id, {
                                              revenueTargetPerPerson:
                                                Number(e.target.value) || 0,
                                            })
                                          }
                                          className="h-8 pl-5 pr-2 text-sm tabular-nums"
                                          placeholder="0"
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                        = {symbol}
                                        {fmt(p.revenueTargetPerPerson || 0)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <UtilBar value={u.time} hint={`${Math.round((u.time / 100) * 160)}h / 160h`} />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <UtilBar
                                      value={u.revenue}
                                      hint={
                                        (p.revenueTargetPerPerson || 0) > 0
                                          ? `${symbol}${fmt(Math.round(u.allocatedMrr))} / ${symbol}${fmt(p.revenueTargetPerPerson || 0)}`
                                          : "No capacity set"
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => onRequestDelete(p)}
                                      className="text-muted-foreground hover:text-red-600"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-primary/[0.03] border-t border-primary/15">
                                    <td colSpan={8} className="px-3 py-3 pl-10">
                                      {personDeals.length === 0 ? (
                                        <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                          Not staffed on any deals.
                                        </div>
                                      ) : (
                                        <div className="rounded-lg border border-primary/20 bg-card p-3 space-y-2">
                                          <div className="text-[10px] uppercase tracking-wider text-primary font-medium">
                                            Deals tagged ({personDeals.length})
                                          </div>
                                          <table className="text-xs" style={{ tableLayout: "fixed", width: 820 }}>
                                            <colgroup>
                                              <col style={{ width: 90 }} />
                                              <col style={{ width: 300 }} />
                                              <col style={{ width: 120 }} />
                                              <col style={{ width: 100 }} />
                                              <col style={{ width: 70 }} />
                                              <col style={{ width: 110 }} />
                                              <col style={{ width: 30 }} />
                                            </colgroup>
                                            <thead>
                                              <tr className="text-muted-foreground border-b border-border/60">
                                                <th className="text-left font-medium py-1 pr-2">Deal ID</th>
                                                <th className="text-left font-medium py-1 pr-2">Deal</th>
                                                <th className="text-left font-medium py-1 pr-2">Status</th>
                                                <th className="text-left font-medium py-1 pr-2">Type</th>
                                                <th className="text-right font-medium py-1 pr-2">Alloc %</th>
                                                <th className="text-right font-medium py-1 pr-2">MRR</th>
                                                <th />
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {personDeals.map(({ a, d }) => {
                                                const alloc = a.allocationPct || 0;
                                                const allocColor =
                                                  alloc > 100 ? "text-destructive"
                                                  : alloc >= 85 ? "text-warning"
                                                  : "text-foreground";
                                                return (
                                                  <tr
                                                    key={a.id}
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/deals/${d!.id}?tab=Staffing`); }}
                                                    className="group/dealrow cursor-pointer border-t border-border/30 even:bg-secondary/20 hover:bg-primary/5 transition-colors"
                                                  >
                                                    <td className="py-1 pr-2 font-mono text-[11px] text-muted-foreground truncate">{d!.dealId || "—"}</td>
                                                    <td className="py-1 pr-2 font-medium text-foreground truncate group-hover/dealrow:text-primary">{d!.dealName || d!.account}</td>
                                                    <td className="py-1 pr-2"><StatusPill status={d!.dealStatus} /></td>
                                                    <td className="py-1 pr-2">
                                                      <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                                                        {d!.dealType}
                                                      </span>
                                                    </td>
                                                    <td className={cn("py-1 pr-2 text-right tabular-nums font-medium", allocColor)}>{alloc}%</td>
                                                    <td className="py-1 pr-2 text-right tabular-nums">
                                                      {d!.dealType === "Retainer" && d!.mrr ? `₹${INR(d!.mrr)}` : "—"}
                                                    </td>
                                                    <td className="py-1 text-right">
                                                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover/dealrow:opacity-100 transition-opacity inline" />
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                                </Fragment>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
            {grouped.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No people match "{search}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}