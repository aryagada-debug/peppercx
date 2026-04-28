import React, { useState, useMemo } from "react";
import { formatINR } from "@/lib/csvTargets";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Search, Users, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import type { Deal, Person, StaffingAssignment, RevenueCapacityTarget } from "@/data/staffingData";

const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);

const fmtCurrency = (n: number | undefined) => {
  return formatINR(Number(n) || 0);
};

const statusBadge = (status: string) => {
  const cls = status === "Active Deal" ? "text-positive bg-[hsl(var(--success-bg))]"
    : status === "Deal Churned / Lost" ? "text-destructive bg-destructive/10"
    : status === "Deal Disputed" ? "text-warning bg-warning/10"
    : status === "New Deal in SLA/PO" ? "text-info bg-accent"
    : "text-muted-foreground bg-secondary";
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap", cls)}>{status}</span>;
};

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  revenueTargets?: RevenueCapacityTarget[];
}

export function DealLevelView({ deals, people, assignments, revenueTargets = [] }: Props) {
  const [search, setSearch] = useState("");
  const [expandedPods, setExpandedPods] = useState<Set<string>>(new Set());
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);

  const personMap = useMemo(() => {
    const m: Record<string, Person> = {};
    people.forEach(p => { m[p.id] = p; });
    return m;
  }, [people]);

  // Filter active vs closed
  const statusFiltered = useMemo(() => {
    if (showClosed) return deals;
    return deals.filter(d => ACTIVE_STATUSES.has(d.dealStatus));
  }, [deals, showClosed]);

  const filtered = useMemo(() => {
    if (!search) return statusFiltered;
    const q = search.toLowerCase();
    return statusFiltered.filter(d => d.dealName.toLowerCase().includes(q) || d.account.toLowerCase().includes(q) || (d.vsd || "").toLowerCase().includes(q));
  }, [statusFiltered, search]);

  // Group by pod → VSD
  const podGroups = useMemo(() => {
    const map = new Map<string, { vsd: string; deals: Deal[] }[]>();
    filtered.forEach(d => {
      const pod = d.pod || "Unassigned";
      if (!map.has(pod)) map.set(pod, []);
      const podEntry = map.get(pod)!;
      const vsd = d.vsd || "Unassigned";
      let vsdGroup = podEntry.find(g => g.vsd === vsd);
      if (!vsdGroup) { vsdGroup = { vsd, deals: [] }; podEntry.push(vsdGroup); }
      vsdGroup.deals.push(d);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : a[0].localeCompare(b[0]));
  }, [filtered]);

  // KPIs
  const kpis = useMemo(() => {
    const totalMRR = filtered.reduce((s, d) => s + (d.mrr || 0), 0);
    const teamIds = new Set<string>();
    filtered.forEach(d => {
      assignments.filter(a => a.dealId === d.id).forEach(a => teamIds.add(a.personId));
    });
    const noTeam = filtered.filter(d => !assignments.some(a => a.dealId === d.id)).length;
    return { totalMRR, uniquePeople: teamIds.size, dealsNoTeam: noTeam };
  }, [filtered, assignments]);

  const togglePod = (pod: string) => {
    setExpandedPods(prev => {
      const next = new Set(prev);
      next.has(pod) ? next.delete(pod) : next.add(pod);
      return next;
    });
  };

  const toggleDeal = (id: string) => {
    setExpandedDeals(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="data-card">
          <p className="metric-label">Deals</p>
          <p className="text-xl font-semibold font-mono mt-1 text-foreground">{filtered.length}</p>
        </div>
        <div className="data-card">
          <p className="metric-label">Total MRR</p>
          <p className="text-xl font-semibold font-mono mt-1 text-foreground">{fmtCurrency(kpis.totalMRR)}</p>
        </div>
        <div className="data-card">
          <p className="metric-label">Unique People</p>
          <p className="text-xl font-semibold font-mono mt-1 text-foreground">{kpis.uniquePeople}</p>
        </div>
        <div className={cn("data-card", kpis.dealsNoTeam > 0 && "border-warning/30")}>
          <p className="metric-label">Unstaffed Deals</p>
          <p className={cn("text-xl font-semibold font-mono mt-1", kpis.dealsNoTeam > 0 ? "text-destructive" : "text-foreground")}>{kpis.dealsNoTeam}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search deals, accounts, VSDs..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" />
        </div>
        <label className="flex items-center gap-2 text-ui text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="rounded border-border" />
          Show closed/completed
        </label>
      </div>

      {/* Pod-grouped view */}
      <div className="space-y-3">
        {podGroups.map(([pod, vsdGroups]) => {
          const podMRR = vsdGroups.reduce((s, g) => s + g.deals.reduce((s2, d) => s2 + (d.mrr || 0), 0), 0);
          const podDeals = vsdGroups.reduce((s, g) => s + g.deals.length, 0);
          const isPodExpanded = expandedPods.has(pod);

          return (
            <div key={pod} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Pod header */}
              <button
                onClick={() => togglePod(pod)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isPodExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-semibold text-foreground">{pod}</span>
                  <span className="text-caption text-muted-foreground">{podDeals} deals</span>
                </div>
                <div className="flex items-center gap-4 text-caption">
                  <span className="font-mono text-foreground">{fmtCurrency(podMRR)}</span>
                  <span className="text-muted-foreground">{vsdGroups.length} VSD{vsdGroups.length !== 1 ? "s" : ""}</span>
                </div>
              </button>

              {isPodExpanded && (
                <div className="border-t border-border">
                  {vsdGroups.map(({ vsd, deals: vsdDeals }) => {
                    const vsdMRR = vsdDeals.reduce((s, d) => s + (d.mrr || 0), 0);
                    return (
                      <div key={vsd}>
                        <div className="flex items-center gap-3 px-6 py-2 bg-secondary/20 border-b border-border/50">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-foreground">{vsd}</span>
                          <span className="text-[10px] text-muted-foreground">{vsdDeals.length} deals • {fmtCurrency(vsdMRR)}</span>
                        </div>
                        <table className="w-full text-ui">
                          <tbody>
                            {vsdDeals.map(deal => {
                              const isExp = expandedDeals.has(deal.id);
                              const dealAssigns = assignments.filter(a => a.dealId === deal.id);
                              const teamCount = new Set(dealAssigns.map(a => a.personId)).size;
                              const hasGap = teamCount === 0;

                              return (
                                <React.Fragment key={deal.id}>
                                  <tr
                                    className={cn("border-b border-border/30 hover:bg-accent/10 cursor-pointer transition-colors", isExp && "bg-accent/5")}
                                    onClick={() => toggleDeal(deal.id)}
                                  >
                                    <td className="py-2 px-6 w-8">
                                      {isExp ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                    </td>
                                    <td className="py-2 px-2">
                                      <Link to={`/deals/${deal.id}`} className="text-primary hover:underline text-xs font-medium" onClick={e => e.stopPropagation()}>
                                        {deal.dealName}
                                      </Link>
                                      <span className="block text-[10px] text-muted-foreground">{deal.account}</span>
                                    </td>
                                    <td className="py-2 px-2">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent text-accent-foreground">{deal.dealType}</span>
                                    </td>
                                    <td className="py-2 px-2">{statusBadge(deal.dealStatus)}</td>
                                    <td className="py-2 px-2 text-right font-mono tabular-nums text-xs">{fmtCurrency(deal.mrr)}</td>
                                    <td className="py-2 px-2 text-right">
                                      <span className={cn("text-xs font-mono", hasGap ? "text-destructive" : "text-muted-foreground")}>
                                        {teamCount} {hasGap && "⚠"}
                                      </span>
                                    </td>
                                  </tr>
                                  {isExp && (
                                    <tr>
                                      <td colSpan={6} className="p-0">
                                        <div className="bg-accent/5 border-b border-border px-10 py-2">
                                          {dealAssigns.length > 0 ? (
                                            <div className="space-y-1">
                                              {dealAssigns.map(a => {
                                                const p = personMap[a.personId];
                                                if (!p) return null;
                                                return (
                                                  <div key={a.id} className="flex items-center gap-3 py-0.5 text-xs">
                                                    <span className="text-foreground font-medium w-40">{p.name}</span>
                                                    <span className="text-muted-foreground w-28">{p.roleTitle || p.designation}</span>
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent text-accent-foreground">{p.roleCategory}</span>
                                                    <div className="flex-1 flex items-center gap-1.5">
                                                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                        <div className={cn("h-full rounded-full", a.allocationPct > 80 ? "bg-warning" : "bg-positive")} style={{ width: `${Math.min(a.allocationPct, 100)}%` }} />
                                                      </div>
                                                      <span className="font-mono tabular-nums text-muted-foreground text-[10px]">{a.allocationPct}%</span>
                                                    </div>
                                                    {(a.startDate || a.endDate) && (
                                                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                                        {a.startDate || "—"} → {a.endDate || "—"}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          ) : (
                                            <p className="text-xs text-muted-foreground py-1">No team members assigned</p>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {podGroups.length === 0 && (
        <div className="data-card text-center py-8">
          <p className="text-muted-foreground">No deals found.</p>
        </div>
      )}
    </div>
  );
}


