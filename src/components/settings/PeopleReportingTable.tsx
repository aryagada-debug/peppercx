import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/data/staffingData";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Plus, Check, X, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddPersonDialog } from "@/components/settings/AddPersonDialog";

interface Props {
  people: Person[];
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

const TEAM_ORDER = ["VSD", "Content team", "SEO team", "Creative team", "Other"] as const;
type TeamName = (typeof TEAM_ORDER)[number];

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

type ColKey = "name" | "designation" | "email" | "reportsTo" | "revType";
const DEFAULT_WIDTHS: Record<ColKey, number> = {
  name: 220,
  designation: 220,
  email: 240,
  reportsTo: 180,
  revType: 360,
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

export function PeopleReportingTable({ people, onAdd, onUpdate, onRequestDelete }: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ department?: string; subTeam?: string }>({});
  const { widths, onMouseDown } = useResizableColumns();

  const byName = useMemo(() => {
    const m = new Map<string, Person>();
    people.forEach((p) => m.set(p.name.trim().toLowerCase(), p));
    return m;
  }, [people]);

  const filtered = useMemo(() => {
    const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.designation || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.reportingManager || "").toLowerCase().includes(q),
    );
  }, [people, search]);

  // Group filtered people by team -> sub-team
  const grouped = useMemo(() => {
    const teams = new Map<TeamName, Map<string, Person[]>>();
    for (const t of TEAM_ORDER) teams.set(t, new Map());
    for (const p of filtered) {
      const { team, subTeam } = classifyPerson(p, byName);
      const subMap = teams.get(team)!;
      const key = subTeam || "";
      if (!subMap.has(key)) subMap.set(key, []);
      subMap.get(key)!.push(p);
    }
    // Order sub-teams
    const ordered: { team: TeamName; subs: { sub: string; rows: Person[] }[]; total: number }[] = [];
    for (const t of TEAM_ORDER) {
      const subMap = teams.get(t)!;
      if (subMap.size === 0) continue;
      const order =
        t === "VSD" ? VSD_SUBTEAM_ORDER : t === "Creative team" ? CREATIVE_SUBTEAM_ORDER : [];
      const subs = Array.from(subMap.entries())
        .map(([sub, rows]) => ({
          sub,
          rows: rows.sort((a, b) => {
            const ra = seniorityRank(t, a.designation || "");
            const rb = seniorityRank(t, b.designation || "");
            if (ra !== rb) return ra - rb;
            return a.name.localeCompare(b.name);
          }),
        }))
        .sort((a, b) => {
          const ai = order.indexOf(a.sub);
          const bi = order.indexOf(b.sub);
          if (ai !== -1 || bi !== -1)
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          return a.sub.localeCompare(b.sub);
        });
      const total = subs.reduce((n, s) => n + s.rows.length, 0);
      ordered.push({ team: t, subs, total });
    }
    return ordered;
  }, [filtered, byName]);

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
            <DropdownMenuItem onClick={() => openAdd({ department: "Delivery Ops and CS" })}>
              Add sub-team (VSD)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAdd({ department: "" })}>
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

      <div className="overflow-auto rounded-xl border border-border bg-card">
        <table className="text-sm" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: widths.name }} />
            <col style={{ width: widths.designation }} />
            <col style={{ width: widths.email }} />
            <col style={{ width: widths.reportsTo }} />
            <col style={{ width: widths.revType }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              {(
                [
                  ["name", "Name"],
                  ["designation", "Designation"],
                  ["email", "Email"],
                  ["reportsTo", "Reports to"],
                  ["revType", "Rev type"],
                ] as [ColKey, string][]
              ).map(([k, label]) => (
                <th
                  key={k}
                  className="relative px-3 py-2 text-left font-medium uppercase tracking-wider text-[10px]"
                >
                  {label}
                  <ResizeHandle onMouseDown={onMouseDown(k)} />
                </th>
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
                    <td colSpan={6} className="px-3 py-2">
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
                        <span className="text-xs font-medium">{team}</span>
                        <span className="text-[10px] text-muted-foreground">({total})</span>
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
                              <td colSpan={6} className="px-3 py-1.5 pl-8">
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
                                  <span className="text-[11px] text-foreground/80">{sub}</span>
                                  <span className="text-[10px] text-muted-foreground">
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
                              return (
                                <tr
                                  key={p.id}
                                  className="border-t border-border/40 hover:bg-secondary/20"
                                >
                                  <td className="px-3 py-1.5 pl-10">
                                    <InlineText
                                      value={p.name}
                                      onSave={(v) => v && onUpdate(p.id, { name: v })}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <InlineText
                                      value={p.designation || ""}
                                      onSave={(v) => onUpdate(p.id, { designation: v })}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <InlineText
                                      value={p.email || ""}
                                      onSave={(v) => onUpdate(p.id, { email: v })}
                                      placeholder="—"
                                      type="email"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
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
                                  <td className="px-3 py-1.5">
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
                                        className="h-7 shrink-0 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                                      >
                                        <option value="INR">₹ INR</option>
                                        <option value="USD">$ USD</option>
                                      </select>
                                      <div className="relative w-32 shrink-0">
                                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
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
                                          className="h-7 pl-5 pr-2 text-xs tabular-nums"
                                          placeholder="0"
                                        />
                                      </div>
                                      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                                        = {symbol}
                                        {fmt(p.revenueTargetPerPerson || 0)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
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
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
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