import React, { useMemo, useState } from "react";
import { formatINR } from "@/lib/csvTargets";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Deal, Person, StaffingAssignment, RevenueCapacityTarget } from "@/data/staffingData";
import { BopmFilter, dealMatchesBopm } from "@/components/access/BopmFilter";
import { useAllPersonNames } from "@/hooks/useAppUsers";

const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);

const fmtCurrency = (n: number | undefined) => {
  return formatINR(Number(n) || 0);
};

type Bucket = "overloaded" | "nearFull" | "healthy" | "underUtil";

function getBucket(pct: number): Bucket {
  if (pct > 100) return "overloaded";
  if (pct >= 85) return "nearFull";
  if (pct >= 30) return "healthy";
  return "underUtil";
}

const BUCKET_CONFIG: Record<Bucket, { label: string; dot: string; bar: string; text: string }> = {
  overloaded:   { label: "Overloaded",     dot: "bg-destructive", bar: "bg-destructive", text: "text-destructive" },
  nearFull:     { label: "Near Full",      dot: "bg-warning",     bar: "bg-warning",     text: "text-warning" },
  healthy:      { label: "Healthy",        dot: "bg-positive",    bar: "bg-positive",    text: "text-positive" },
  underUtil:    { label: "Under-utilised", dot: "bg-info",        bar: "bg-info",        text: "text-info" },
};

interface Props {
  people: Person[];
  deals: Deal[];
  assignments: StaffingAssignment[];
  revenueTargets?: RevenueCapacityTarget[];
  onUpdateAssignment?: (id: string, updates: Partial<StaffingAssignment>) => void;
  /** When true, render a "Filter by BOPM" dropdown that scopes deals + people. */
  enableBopmFilter?: boolean;
  /** Optional VSD scope for the BOPM filter dropdown. */
  bopmFilterScopedVsd?: string | null;
}

export function PeopleViewTab({
  people, deals, assignments, revenueTargets = [], onUpdateAssignment,
  enableBopmFilter, bopmFilterScopedVsd,
}: Props) {
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<Bucket | null>(null);
  const [bopmFilter, setBopmFilter] = useState<string>("All");
  const [expandedDept, setExpandedDept] = useState<Set<string>>(new Set());
  const [expandedPerson, setExpandedPerson] = useState<Set<string>>(new Set());
  const [editingAlloc, setEditingAlloc] = useState<string | null>(null);
  const [allocDraft, setAllocDraft] = useState<string>("");
  const [allCollapsed, setAllCollapsed] = useState(true);
  const [didAutoExpand, setDidAutoExpand] = useState(false);
  const allPersonNames = useAllPersonNames();

  // Apply BOPM filter (if any) to the deal universe — utilisation/MRR/etc.
  // are computed against `scopedDeals` so they reflect only the filtered pod.
  const scopedDeals = useMemo(() => {
    if (!enableBopmFilter || !bopmFilter || bopmFilter === "All") return deals;
    return deals.filter(d => dealMatchesBopm(d as any, bopmFilter, allPersonNames));
  }, [deals, enableBopmFilter, bopmFilter, allPersonNames]);

  const scopedDealIds = useMemo(() => new Set(scopedDeals.map(d => d.id)), [scopedDeals]);
  const scopedAssignments = useMemo(
    () => assignments.filter(a => scopedDealIds.has(a.dealId)),
    [assignments, scopedDealIds],
  );

  const dealMap = useMemo(() => {
    const m: Record<string, Deal> = {};
    scopedDeals.forEach(d => { m[d.id] = d; });
    return m;
  }, [scopedDeals]);

  const activeDealIds = useMemo(() => new Set(scopedDeals.filter(d => ACTIVE_STATUSES.has(d.dealStatus)).map(d => d.id)), [scopedDeals]);

  // People with at least one assignment — only these are shown in this view.
  const assignedPersonIds = useMemo(() => {
    const set = new Set<string>();
    scopedAssignments.forEach(a => { if (a.personId) set.add(a.personId); });
    return set;
  }, [scopedAssignments]);

  // Map raw department names to one of 5 display groups.
  // Anything outside this mapping is hidden from this view.
  const GROUP_ORDER = [
    "Leadership",
    "Delivery Ops and CS",
    "Capability - SEO",
    "Capability - Content",
    "Capability - Creatives",
  ] as const;

  // The 5 VSDs always live under Delivery Ops and CS in this view,
  // even if their raw record sits in Leadership.
  const VSD_NAMES = new Set([
    "sneha iyer",
    "aamir khan",
    "aditya shaw",
    "sumit shekhawat",
    "neema jayadas",
  ]);

  const normalizeDept = (p: Pick<Person, "department" | "name" | "roleTitle">): string | null => {
    if (VSD_NAMES.has(p.name.trim().toLowerCase()) || (p.roleTitle || "").trim().toUpperCase() === "VSD") {
      return "Delivery Ops and CS";
    }
    const d = (p.department || "").trim().toLowerCase();
    if (!d) return null;
    if (d === "leadership") return "Leadership";
    if (d === "delivery ops and cs" || d === "delivery ops & cs") return "Delivery Ops and CS";
    if (d.includes("seo")) return "Capability - SEO";
    if (d.includes("quality") || d.includes("strategy") || d.includes("content")) return "Capability - Content";
    if (d.includes("creative") || d.includes("video")) return "Capability - Creatives";
    return null;
  };

  // True if this person is one of the 5 VSDs (always shown as a group root).
  const isVSDPerson = (p: Person) =>
    VSD_NAMES.has(p.name.trim().toLowerCase()) ||
    (p.roleTitle || "").trim().toUpperCase() === "VSD";

  // The working population for this view: VSDs always included; everyone else
  // must have at least one assignment. Must map to one of the 5 dept groups, not TBH.
  const visiblePeople = useMemo(
    () => people.filter(p => {
      if (p.tbh) return false;
      if (normalizeDept(p) === null) return false;
      if (isVSDPerson(p)) return true;
      return assignedPersonIds.has(p.id);
    }),
    [people, assignedPersonIds]
  );


  const personUtil = useMemo(() => {
    const m: Record<string, { totalPct: number; assigns: StaffingAssignment[]; mrr: number; rev: number; hours: number }> = {};
    scopedAssignments.forEach(a => {
      if (!m[a.personId]) m[a.personId] = { totalPct: 0, assigns: [], mrr: 0, rev: 0, hours: 0 };
      m[a.personId].assigns.push(a);
      const d = dealMap[a.dealId];
      const isActive = activeDealIds.has(a.dealId);
      if (isActive) {
        m[a.personId].totalPct += a.allocationPct;
        m[a.personId].mrr += (d?.mrr || 0) * (a.allocationPct / 100);
        m[a.personId].rev += (d?.totalDealValue || 0) * (a.allocationPct / 100);
        m[a.personId].hours += (a.allocationPct / 100) * 160;
      }
    });
    return m;
  }, [scopedAssignments, dealMap, activeDealIds]);

  const targetFor = (p: Person): number => {
    const t = revenueTargets.find(rt => rt.department === p.department && rt.designation === p.designation);
    return t?.targetDealValuePerPerson || 0;
  };

  // Hierarchy: normalized-department → reporting tree (only assigned people in non-excluded depts)
  const peopleByDept = useMemo(() => {
    const m = new Map<string, Person[]>();
    visiblePeople.forEach(p => {
      const dept = normalizeDept(p)!;
      if (!m.has(dept)) m.set(dept, []);
      m.get(dept)!.push(p);
    });
    return m;
  }, [visiblePeople]);

  // Build a name→Person lookup once to avoid O(P²) scans below.
  const peopleByNameLower = useMemo(() => {
    const m = new Map<string, Person>();
    visiblePeople.forEach(p => { m.set(p.name.toLowerCase(), p); });
    return m;
  }, [visiblePeople]);

  const childrenMap = useMemo(() => {
    const m: Record<string, Person[]> = {};
    visiblePeople.forEach(p => {
      const mgr = p.reportingManager?.trim().toLowerCase();
      if (!mgr) return;
      const mgrPerson = peopleByNameLower.get(mgr);
      if (!mgrPerson) return;
      if (!m[mgrPerson.id]) m[mgrPerson.id] = [];
      m[mgrPerson.id].push(p);
    });
    return m;
  }, [visiblePeople, peopleByNameLower]);

  // Bucket counts (whole portfolio)
  const bucketCounts = useMemo(() => {
    const c: Record<Bucket, number> = { overloaded: 0, nearFull: 0, healthy: 0, underUtil: 0 };
    visiblePeople.forEach(p => {
      const pct = personUtil[p.id]?.totalPct || 0;
      c[getBucket(pct)]++;
    });
    return c;
  }, [visiblePeople, personUtil]);

  const matchSearch = (p: Person) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.designation || "").toLowerCase().includes(q);
  };

  const matchBucket = (p: Person) => {
    if (!bucketFilter) return true;
    if (p.tbh) return false;
    return getBucket(personUtil[p.id]?.totalPct || 0) === bucketFilter;
  };

  // Determine which depts to show + dept aggregates
  const deptSummary = useMemo(() => {
    return Array.from(peopleByDept.entries()).map(([dept, members]) => {
      const visible = members.filter(p => matchSearch(p) && matchBucket(p));
      const active = members.filter(p => !p.tbh);
      const dist: Record<Bucket, number> = { overloaded: 0, nearFull: 0, healthy: 0, underUtil: 0 };
      let totalPct = 0;
      active.forEach(p => {
        const pct = personUtil[p.id]?.totalPct || 0;
        dist[getBucket(pct)]++;
        totalPct += pct;
      });
      const avg = active.length ? Math.round(totalPct / active.length) : 0;
      return { dept, members, visible, active, dist, avg };
    }).filter(d => d.visible.length > 0)
      .sort((a, b) => {
        const ai = GROUP_ORDER.indexOf(a.dept as typeof GROUP_ORDER[number]);
        const bi = GROUP_ORDER.indexOf(b.dept as typeof GROUP_ORDER[number]);
        return ai - bi;
      });
  }, [peopleByDept, search, bucketFilter, personUtil]);

  const toggleDept = (d: string) => setExpandedDept(prev => {
    const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n;
  });
  const togglePerson = (id: string) => setExpandedPerson(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const collapseAll = () => { setExpandedDept(new Set()); setExpandedPerson(new Set()); setAllCollapsed(true); };
  const expandAll = () => {
    setExpandedDept(new Set(GROUP_ORDER));
    // expand every person that has children, so the tree opens fully
    const kidExp = new Set<string>();
    Object.keys(childrenMap).forEach(id => kidExp.add(id));
    setExpandedPerson(kidExp);
    setAllCollapsed(false);
  };
  const toggleAll = () => { allCollapsed ? expandAll() : collapseAll(); };

  // Auto-expand only the "Delivery Ops and CS" department once on first mount.
  // VSDs and other people stay collapsed so the default view shows the people
  // hierarchy without spilling open every per-person deal sub-table.
  React.useEffect(() => {
    if (didAutoExpand) return;
    if (visiblePeople.length === 0) return;
    setExpandedDept(prev => {
      const n = new Set(prev); n.add("Delivery Ops and CS"); return n;
    });
    setAllCollapsed(false);
    setDidAutoExpand(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePeople.length]);

  const startAllocEdit = (a: StaffingAssignment) => {
    setEditingAlloc(a.id);
    setAllocDraft(String(a.allocationPct));
  };

  const saveAllocEdit = (a: StaffingAssignment) => {
    const v = Number(allocDraft);
    if (Number.isNaN(v) || v < 0 || v > 100) {
      toast.error("Allocation must be 0–100");
      return;
    }
    onUpdateAssignment?.(a.id, { allocationPct: v });
    setEditingAlloc(null);
    toast.success("Allocation updated");
  };

  // Color dot per department group (matches screenshot styling)
  const DEPT_DOT: Record<string, string> = {
    "Leadership": "bg-primary",
    "Delivery Ops and CS": "bg-primary",
    "Capability - SEO": "bg-info",
    "Capability - Content": "bg-warning",
    "Capability - Creatives": "bg-positive",
  };

  // Subtle group backgrounds for VSD sub-trees inside Delivery Ops and CS
  const VSD_GROUP_BG: Record<string, string> = {
    "sneha iyer":      "bg-info/[0.06]",
    "aamir khan":      "bg-warning/[0.06]",
    "aditya shaw":     "bg-positive/[0.06]",
    "sumit shekhawat": "bg-primary/[0.05]",
    "neema jayadas":   "bg-destructive/[0.05]",
  };

  // Render person + descendants — but only emit those that pass filters
  const renderPerson = (p: Person, depth: number, visibleSet: Set<string>, rowIdx: { i: number }, groupBg?: string): React.ReactNode => {
    if (!visibleSet.has(p.id)) return null;
    const u = personUtil[p.id];
    const totalPct = u?.totalPct || 0;
    const bucket = getBucket(totalPct);
    const cfg = BUCKET_CONFIG[bucket];
    const hours = Math.round(u?.hours || 0);
    const deals = u?.assigns || [];
    const activeCount = deals.filter(a => activeDealIds.has(a.dealId)).length;
    const target = targetFor(p);
    const revPct = target > 0 ? Math.round((u?.rev || 0) / target * 100) : 0;
    const isExp = expandedPerson.has(p.id);
    const kids = (childrenMap[p.id] || []).filter(k => visibleSet.has(k.id));
    // If this person is a VSD, start a new group bg for descendants
    const myGroupBg = VSD_GROUP_BG[p.name.trim().toLowerCase()] ?? groupBg;
    // VSDs themselves render on plain card; descendants get the subtle tint
    const isVSD = !!VSD_GROUP_BG[p.name.trim().toLowerCase()];
    const rowBg = !isVSD && groupBg
      ? groupBg
      : (rowIdx.i % 2 === 1 ? "bg-secondary/20" : "bg-card");
    rowIdx.i++;
    const noData = !u || (u.assigns.length === 0);

    return (
      <React.Fragment key={p.id}>
        <tr className={cn("border-b border-border/40 hover:bg-secondary/40 cursor-pointer transition-colors", rowBg)} onClick={() => togglePerson(p.id)}>
          <td className="py-2.5 px-3" style={{ paddingLeft: `${12 + depth * 28}px` }}>
            <div className="flex items-center gap-1.5">
              {deals.length > 0
                ? (isExp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />)
                : <span className="w-3.5" />}
              <span className={cn("text-sm",
                p.tbh ? "italic text-muted-foreground" : p.leaving ? "text-destructive line-through" : "text-foreground"
              )}>
                {p.name}{p.tbh && " (TBH)"}
              </span>
            </div>
          </td>
          <td className="py-2.5 px-3 text-sm text-muted-foreground">
            {isVSD ? <span className="font-medium text-foreground">VSD</span> : (p.designation || p.roleTitle)}
          </td>
          <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{noData ? "—" : activeCount}</td>
          <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-foreground">{noData ? "—" : fmtCurrency(u?.mrr)}</td>
          <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-foreground">{noData ? "—" : fmtCurrency(u?.rev)}</td>
          <td className="py-2 px-3">
            {noData ? <span className="text-xs text-muted-foreground">—</span> : (
              <div className="flex items-center gap-1.5" title={`${hours}h / 160h`}>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden min-w-[60px]">
                  <div className={cn("h-full", cfg.bar)} style={{ width: `${Math.min(totalPct, 100)}%` }} />
                </div>
                <span className={cn("text-[10px] font-mono tabular-nums w-16 text-right", cfg.text)}>{hours}h · {Math.round(totalPct)}%</span>
              </div>
            )}
          </td>
        </tr>

        {isExp && deals.length > 0 && (
          <tr>
            <td colSpan={6} className="p-0 bg-accent/5">
              <div className="px-12 py-2 border-y border-border/40">
                <table className="w-full text-caption">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1 pr-4 font-medium uppercase tracking-wider text-[10px]">Deal</th>
                      <th className="text-left py-1 pr-4 font-medium uppercase tracking-wider text-[10px]">Account</th>
                      <th className="text-right py-1 pr-4 font-medium uppercase tracking-wider text-[10px]">Alloc</th>
                      <th className="text-right py-1 pr-4 font-medium uppercase tracking-wider text-[10px]">Hrs</th>
                      <th className="text-right py-1 font-medium uppercase tracking-wider text-[10px]">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map(a => {
                      const d = dealMap[a.dealId];
                      const isActive = activeDealIds.has(a.dealId);
                      const isEditing = editingAlloc === a.id;
                      return (
                        <tr key={a.id} className={cn("border-t border-border/30", !isActive && "opacity-60")}>
                          <td className="py-1.5 pr-4">
                            {d ? <Link to={`/deals/${d.id}`} className="text-primary hover:underline">{d.dealName}</Link> : <span>{a.dealId}</span>}
                          </td>
                          <td className="py-1.5 pr-4 text-muted-foreground">{d?.account}</td>
                          <td className="py-1.5 pr-4 text-right" onClick={e => e.stopPropagation()}>
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  value={allocDraft}
                                  onChange={e => setAllocDraft(e.target.value)}
                                  type="number"
                                  className="h-6 w-16 text-xs"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === "Enter") saveAllocEdit(a);
                                    if (e.key === "Escape") setEditingAlloc(null);
                                  }}
                                  onBlur={() => saveAllocEdit(a)}
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startAllocEdit(a)}
                                className="font-mono tabular-nums text-foreground hover:text-primary"
                              >
                                {a.allocationPct}%
                              </button>
                            )}
                          </td>
                          <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-muted-foreground">{Math.round(a.allocationPct / 100 * 160)}h</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-foreground">{fmtCurrency(d?.mrr)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        )}

        {/* Reports are always visible & indented; only deal allocations toggle on expand. */}
        {kids.map(k => renderPerson(k, depth + 1, visibleSet, rowIdx, myGroupBg))}
      </React.Fragment>
    );
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Filter chips + search + collapse */}
      <div className="flex flex-wrap items-center gap-3">
        {(Object.keys(BUCKET_CONFIG) as Bucket[]).map(b => {
          const cfg = BUCKET_CONFIG[b];
          const active = bucketFilter === b;
          return (
            <button
              key={b}
              onClick={() => setBucketFilter(active ? null : b)}
              className={cn(
                "inline-flex items-center gap-2 px-3 h-8 rounded-full border text-caption transition-colors",
                active ? "border-foreground bg-foreground/5" : "border-border bg-card hover:bg-secondary/30"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
              <span className="text-foreground">{cfg.label}</span>
              <span className="text-muted-foreground font-mono">{bucketCounts[b]}</span>
            </button>
          );
        })}

        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search people..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
          />
        </div>

        {enableBopmFilter && (
          <div className="flex items-center gap-2">
            <label className="text-caption text-muted-foreground">BOPM</label>
            <BopmFilter
              value={bopmFilter}
              onChange={setBopmFilter}
              scopedVsd={bopmFilterScopedVsd ?? undefined}
              className="h-9 w-[200px] text-ui"
            />
          </div>
        )}

        <button
          onClick={toggleAll}
          className="ml-auto h-9 px-3 rounded-lg border border-border text-ui text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >{allCollapsed ? "Expand all" : "Collapse all"}</button>
      </div>

      {/* Departments */}
      <div className="space-y-3">
        {deptSummary.map(({ dept, visible, active, dist, avg }) => {
          const isOpen = expandedDept.has(dept);
          const visibleSet = new Set(visible.map(p => p.id));
          // roots within this dept = visible people whose manager is NOT in visible set
          const VSD_FIXED_ORDER = ["sneha iyer","aamir khan","aditya shaw","sumit shekhawat","neema jayadas"];
          const roots = visible.filter(p => {
            const mgr = p.reportingManager?.trim().toLowerCase();
            if (!mgr) return true;
            const mgrPerson = peopleByNameLower.get(mgr);
            if (!mgrPerson) return true;
            // if manager is in same dept and visible, treat current as a child
            if (normalizeDept(mgrPerson) === dept && visibleSet.has(mgrPerson.id)) return false;
            return true;
          }).sort((a, b) => {
            const ai = VSD_FIXED_ORDER.indexOf(a.name.trim().toLowerCase());
            const bi = VSD_FIXED_ORDER.indexOf(b.name.trim().toLowerCase());
            const aIsVSD = ai !== -1, bIsVSD = bi !== -1;
            if (aIsVSD && bIsVSD) return ai - bi;
            if (aIsVSD) return -1;
            if (bIsVSD) return 1;
            return a.name.localeCompare(b.name);
          });
          const total = dist.overloaded + dist.nearFull + dist.healthy + dist.underUtil || 1;

          return (
            <div key={dept} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggleDept(dept)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors"
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", DEPT_DOT[dept] || "bg-primary")} />
                <span className="text-sm font-medium text-foreground">{dept}</span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="text-caption text-muted-foreground">{active.length} active</span>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-ui">
                    <thead>
                      <tr className="bg-secondary/30 border-b border-border">
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Designation</th>
                        <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Deals</th>
                        <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">MRR</th>
                        <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Total Rev</th>
                        <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => { const rowIdx = { i: 0 }; return roots.map(p => renderPerson(p, 0, visibleSet, rowIdx)); })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {deptSummary.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No people match the current filters.</div>
        )}
      </div>
    </div>
  );
}