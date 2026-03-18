import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";
import { ROLE_SLOTS, ROLE_CATEGORIES } from "@/data/staffingData";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
}

const fmtCurrency = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

export function SummaryTab({ deals, people, assignments }: Props) {
  const [expandedVsd, setExpandedVsd] = useState<string | null>(null);
  const [personSearch, setPersonSearch] = useState("");

  // Compute analytics
  const analytics = useMemo(() => {
    const totalMRR = deals.reduce((s, d) => s + (d.mrr || 0), 0);
    const activeTeam = people.filter(p => !p.tbh && !p.leaving).length;
    const activeDeals = deals.filter(d => d.dealStatus !== "Closed" && d.dealStatus !== "Lost").length;
    const leavingPeople = people.filter(p => p.leaving);

    // Deals missing staffing data
    const dealsMissingBOPM = deals.filter(d => {
      const hasBOPM = assignments.some(a => a.dealId === d.id && ["bopm", "senior_bopm", "principal_bopm"].includes(a.roleKey));
      return !hasBOPM && d.staffingStatus !== "No Staffing Needed";
    });
    const dealsZeroAlloc = deals.filter(d => {
      const dealAssignments = assignments.filter(a => a.dealId === d.id);
      return dealAssignments.length > 0 && dealAssignments.every(a => a.allocationPct === 0);
    });
    const dealsMissingMRR = deals.filter(d => !d.mrr || d.mrr === 0);

    // VSD breakdown
    const vsdMap = new Map<string, { deals: Deal[]; staffed: number; gaps: number; totalMRR: number }>();
    deals.forEach(d => {
      const vsd = d.vsd || "Unassigned";
      if (!vsdMap.has(vsd)) vsdMap.set(vsd, { deals: [], staffed: 0, gaps: 0, totalMRR: 0 });
      const entry = vsdMap.get(vsd)!;
      entry.deals.push(d);
      entry.totalMRR += d.mrr || 0;
      const dealAssigns = assignments.filter(a => a.dealId === d.id);
      if (dealAssigns.length > 0 && dealAssigns.some(a => a.allocationPct > 0)) {
        entry.staffed++;
      } else if (d.staffingStatus !== "No Staffing Needed") {
        entry.gaps++;
      }
    });

    return { totalMRR, activeTeam, activeDeals, leavingPeople, dealsMissingBOPM, dealsZeroAlloc, dealsMissingMRR, vsdMap };
  }, [deals, people, assignments]);

  // Person search results
  const personResults = useMemo(() => {
    if (!personSearch.trim()) return [];
    const q = personSearch.toLowerCase();
    return people.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10).map(p => {
      const pAssignments = assignments.filter(a => a.personId === p.id);
      const pDeals = pAssignments.map(a => {
        const deal = deals.find(d => d.id === a.dealId);
        return { ...a, deal };
      }).filter(x => x.deal);
      const totalPct = pAssignments.reduce((s, a) => s + a.allocationPct, 0);
      const missingAlloc = pAssignments.filter(a => a.allocationPct === 0);
      return { person: p, assignments: pDeals, totalPct, missingAlloc };
    });
  }, [personSearch, people, assignments, deals]);

  // Deal completeness for VSD drill-down
  const getDealCompleteness = (deal: Deal) => {
    const da = assignments.filter(a => a.dealId === deal.id);
    const issues: string[] = [];
    if (!da.length) issues.push("No staff assigned");
    if (da.length > 0 && da.every(a => a.allocationPct === 0)) issues.push("All allocations at 0%");
    if (!deal.mrr) issues.push("Missing MRR");
    const hasBOPM = da.some(a => ["bopm", "senior_bopm", "principal_bopm"].includes(a.roleKey));
    if (!hasBOPM && deal.staffingStatus !== "No Staffing Needed") issues.push("No BOPM assigned");
    const status = issues.length === 0 ? "green" : issues.length <= 1 ? "yellow" : "red";
    return { issues, status };
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[
          { label: "Total MRR", value: fmtCurrency(analytics.totalMRR), sub: `${analytics.activeDeals} active deals` },
          { label: "Team Size", value: String(analytics.activeTeam), sub: `${analytics.leavingPeople.length} leaving` },
          { label: "Active Deals", value: String(analytics.activeDeals), sub: `${deals.length} total` },
          { label: "Missing BOPM", value: String(analytics.dealsMissingBOPM.length), sub: "deals without ops", alert: analytics.dealsMissingBOPM.length > 0 },
          { label: "Zero Alloc", value: String(analytics.dealsZeroAlloc.length), sub: "deals at 0%", alert: analytics.dealsZeroAlloc.length > 0 },
        ].map(k => (
          <div key={k.label} className="data-card">
            <p className="metric-label">{k.label}</p>
            <h2 className={cn("metric-value mt-1", k.alert && "text-destructive")}>{k.value}</h2>
            <p className="text-caption text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Staffing Gaps Alert */}
      {(analytics.dealsMissingBOPM.length > 0 || analytics.dealsZeroAlloc.length > 0 || analytics.dealsMissingMRR.length > 0) && (
        <div className="data-card border-warning/30 bg-warning/5">
          <h3 className="text-ui font-semibold text-foreground flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning" /> Staffing & Data Gaps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-caption">
            <div>
              <p className="font-medium text-destructive mb-1">{analytics.dealsMissingBOPM.length} deals without BOPM</p>
              {analytics.dealsMissingBOPM.slice(0, 3).map(d => (
                <p key={d.id} className="text-muted-foreground truncate">{d.account} ({d.dealId})</p>
              ))}
              {analytics.dealsMissingBOPM.length > 3 && <p className="text-muted-foreground">+{analytics.dealsMissingBOPM.length - 3} more</p>}
            </div>
            <div>
              <p className="font-medium text-warning mb-1">{analytics.dealsZeroAlloc.length} deals at 0% allocation</p>
              {analytics.dealsZeroAlloc.slice(0, 3).map(d => (
                <p key={d.id} className="text-muted-foreground truncate">{d.account} ({d.dealId})</p>
              ))}
              {analytics.dealsZeroAlloc.length > 3 && <p className="text-muted-foreground">+{analytics.dealsZeroAlloc.length - 3} more</p>}
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-1">{analytics.dealsMissingMRR.length} deals missing MRR</p>
              {analytics.dealsMissingMRR.slice(0, 3).map(d => (
                <p key={d.id} className="text-muted-foreground truncate">{d.account} ({d.dealId})</p>
              ))}
              {analytics.dealsMissingMRR.length > 3 && <p className="text-muted-foreground">+{analytics.dealsMissingMRR.length - 3} more</p>}
            </div>
          </div>
        </div>
      )}

      {/* Person Search */}
      <div className="data-card">
        <h3 className="text-ui font-semibold text-foreground mb-3">Person-Level Analytics</h3>
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by person name..." value={personSearch} onChange={e => setPersonSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/50 border-0 text-ui text-foreground placeholder:text-muted-foreground focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" />
        </div>
        {personResults.length > 0 && (
          <div className="space-y-3">
            {personResults.map(({ person, assignments: pa, totalPct, missingAlloc }) => (
              <div key={person.id} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-ui font-medium text-foreground">{person.name}</span>
                    <span className="text-caption text-muted-foreground ml-2">{person.roleTitle} • {person.band}</span>
                  </div>
                  <span className={cn("font-mono text-caption font-medium", totalPct > 100 ? "text-destructive" : totalPct > 80 ? "text-warning" : "text-positive")}>{totalPct.toFixed(1)}%</span>
                </div>
                <div className="space-y-1">
                  {pa.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-caption">
                      <span className="text-muted-foreground">{a.deal?.account} — {ROLE_SLOTS.find(s => s.roleKey === a.roleKey)?.roleLabel}</span>
                      <span className={cn("font-mono", a.allocationPct === 0 ? "text-warning" : "text-foreground")}>{a.allocationPct}%</span>
                    </div>
                  ))}
                </div>
                {missingAlloc.length > 0 && (
                  <p className="text-caption text-warning mt-1">⚠ {missingAlloc.length} assignment(s) at 0% allocation</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VSD Breakdown */}
      <div className="data-card">
        <h3 className="text-ui font-semibold text-foreground mb-4">VSD-Level Breakdown</h3>
        <div className="space-y-2">
          {Array.from(analytics.vsdMap.entries())
            .sort((a, b) => b[1].deals.length - a[1].deals.length)
            .map(([vsd, data]) => (
            <div key={vsd} className="border border-border rounded-md">
              <button onClick={() => setExpandedVsd(expandedVsd === vsd ? null : vsd)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3">
                  {expandedVsd === vsd ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-ui font-medium text-foreground">{vsd}</span>
                  <span className="text-caption text-muted-foreground">{data.deals.length} deals</span>
                </div>
                <div className="flex items-center gap-4 text-caption">
                  <span className="text-muted-foreground">MRR: {fmtCurrency(data.totalMRR)}</span>
                  {data.gaps > 0 && <span className="text-destructive font-medium">{data.gaps} gaps</span>}
                  <span className="text-positive">{data.staffed} staffed</span>
                </div>
              </button>
              {expandedVsd === vsd && (
                <div className="border-t border-border px-4 py-2 space-y-1">
                  {data.deals.map(deal => {
                    const { issues, status } = getDealCompleteness(deal);
                    return (
                      <div key={deal.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          {status === "green" ? <CheckCircle className="h-3.5 w-3.5 text-positive" /> :
                           status === "yellow" ? <AlertTriangle className="h-3.5 w-3.5 text-warning" /> :
                           <XCircle className="h-3.5 w-3.5 text-destructive" />}
                          <span className="text-caption text-foreground">{deal.account}</span>
                          <span className="text-caption text-muted-foreground">({deal.dealId})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {issues.map((issue, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive">{issue}</span>
                          ))}
                          {issues.length === 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-positive/10 text-positive">Complete</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
