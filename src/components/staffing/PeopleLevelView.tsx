import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";

const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

interface Props {
  people: Person[];
  deals: Deal[];
  assignments: StaffingAssignment[];
}

function getUtilBucket(pct: number): { label: string; color: string; bg: string } {
  if (pct > 100) return { label: "Overloaded", color: "text-destructive", bg: "bg-[hsl(var(--danger-bg))]" };
  if (pct >= 85) return { label: "Near Full", color: "text-warning", bg: "bg-[hsl(var(--warning-bg))]" };
  if (pct >= 30) return { label: "Healthy", color: "text-positive", bg: "bg-[hsl(var(--success-bg))]" };
  return { label: "Under-utilised", color: "text-info", bg: "bg-accent" };
}

export function PeopleLevelView({ people, deals, assignments }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const dealMap = useMemo(() => {
    const m: Record<string, Deal> = {};
    deals.forEach(d => { m[d.id] = d; });
    return m;
  }, [deals]);

  const personUtils = useMemo(() => {
    const m: Record<string, { totalPct: number; dealAssigns: StaffingAssignment[] }> = {};
    assignments.forEach(a => {
      if (!m[a.personId]) m[a.personId] = { totalPct: 0, dealAssigns: [] };
      m[a.personId].totalPct += a.allocationPct;
      m[a.personId].dealAssigns.push(a);
    });
    return m;
  }, [assignments]);

  // Build hierarchy: group by reporting manager
  const hierarchy = useMemo(() => {
    const managerMap: Record<string, Person[]> = {};
    const roots: Person[] = [];
    people.forEach(p => {
      const mgr = p.reportingManager?.trim();
      if (!mgr) { roots.push(p); return; }
      const mgrPerson = people.find(m => m.name.toLowerCase() === mgr.toLowerCase());
      if (mgrPerson) {
        if (!managerMap[mgrPerson.id]) managerMap[mgrPerson.id] = [];
        managerMap[mgrPerson.id].push(p);
      } else {
        roots.push(p);
      }
    });
    return { roots, managerMap };
  }, [people]);

  // Summary cards
  const buckets = useMemo(() => {
    const b = { overloaded: 0, nearFull: 0, healthy: 0, underUtil: 0 };
    people.filter(p => !p.tbh).forEach(p => {
      const pct = personUtils[p.id]?.totalPct || 0;
      if (pct > 100) b.overloaded++;
      else if (pct >= 85) b.nearFull++;
      else if (pct >= 30) b.healthy++;
      else b.underUtil++;
    });
    return b;
  }, [people, personUtils]);

  const filtered = useMemo(() => {
    if (!search) return hierarchy.roots;
    const q = search.toLowerCase();
    return people.filter(p => p.name.toLowerCase().includes(q));
  }, [hierarchy.roots, people, search]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderPerson = (p: Person, depth: number) => {
    const util = personUtils[p.id];
    const totalPct = util?.totalPct || 0;
    const bucket = getUtilBucket(totalPct);
    const children = hierarchy.managerMap[p.id] || [];
    const isExp = expanded.has(p.id);
    const hasChildren = children.length > 0;
    const dealCount = util?.dealAssigns.length || 0;

    return (
      <div key={p.id}>
        <div className={cn("flex items-center gap-2 py-2 px-3 hover:bg-accent/10 transition-colors border-b border-border/30", depth > 0 && "ml-6")} style={{ paddingLeft: `${12 + depth * 24}px` }}>
          {hasChildren ? (
            <button onClick={() => toggle(p.id)} className="flex-shrink-0">
              {isExp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ) : <span className="w-3.5" />}

          <div className="flex-1 min-w-0 flex items-center gap-3">
            <span className={cn("text-ui font-medium", p.tbh ? "text-muted-foreground italic" : p.leaving ? "text-destructive line-through" : "text-foreground")}>
              {p.name} {p.tbh && "(TBH)"}
            </span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent text-accent-foreground">{p.roleCategory}</span>
            <span className="text-caption text-muted-foreground">{p.roleTitle}</span>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <span className="text-caption text-muted-foreground">{p.pod}</span>
            <span className="text-caption text-muted-foreground">{p.region}</span>
            <span className="text-caption text-muted-foreground font-mono">{dealCount} deals</span>
            
            <div className="w-20 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", totalPct > 100 ? "bg-destructive" : totalPct >= 85 ? "bg-warning" : totalPct >= 30 ? "bg-positive" : "bg-info")} style={{ width: `${Math.min(totalPct, 100)}%` }} />
              </div>
              <span className={cn("text-caption font-mono font-medium tabular-nums w-8 text-right", bucket.color)}>{totalPct}%</span>
            </div>

            {p.leaving && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[hsl(var(--danger-bg))] text-destructive">Leaving</span>}
            {p.tbh && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[hsl(var(--warning-bg))] text-warning">TBH</span>}
          </div>
        </div>

        {/* Expanded deal assignments */}
        {isExp && util?.dealAssigns && (
          <div className="bg-accent/5 border-b border-border" style={{ paddingLeft: `${36 + depth * 24}px` }}>
            {util.dealAssigns.map(a => {
              const d = dealMap[a.dealId];
              return (
                <div key={a.id} className="flex items-center gap-3 py-1.5 px-3 text-caption">
                  <span className="text-foreground">{d?.dealName || a.dealId}</span>
                  <span className="text-muted-foreground">{d?.account}</span>
                  <span className="ml-auto font-mono tabular-nums text-foreground">{a.allocationPct}%</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{fmtCurrency(d?.mrr)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Children */}
        {isExp && children.map(c => renderPerson(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Overloaded", value: buckets.overloaded, color: "text-destructive", bg: "bg-[hsl(var(--danger-bg))]" },
          { label: "Near Full", value: buckets.nearFull, color: "text-warning", bg: "bg-[hsl(var(--warning-bg))]" },
          { label: "Healthy", value: buckets.healthy, color: "text-positive", bg: "bg-[hsl(var(--success-bg))]" },
          { label: "Under-utilised", value: buckets.underUtil, color: "text-info", bg: "bg-accent" },
        ].map(b => (
          <div key={b.label} className={cn("data-card", b.bg)}>
            <p className="metric-label">{b.label}</p>
            <p className={cn("text-xl font-bold font-mono mt-1", b.color)}>{b.value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" placeholder="Search people..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" />
      </div>

      <div className="data-card !p-0 overflow-hidden">
        {filtered.map(p => renderPerson(p, 0))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">No people found.</div>
        )}
      </div>
    </div>
  );
}
