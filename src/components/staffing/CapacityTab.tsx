import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";
import { ROLE_SLOTS, ROLE_CATEGORIES } from "@/data/staffingData";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
}

const fmtPct = (n: number) => n === 0 ? "—" : `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;

export function CapacityTab({ deals, people, assignments }: Props) {
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<RoleCategory | "All">("All");

  const personData = useMemo(() => {
    return people.filter(p => !p.tbh).map(p => {
      const pAssignments = assignments.filter(a => a.personId === p.id);
      const totalPct = pAssignments.reduce((s, a) => s + a.allocationPct, 0);
      const dealIds = [...new Set(pAssignments.map(a => a.dealId))];
      const mrrOwned = dealIds.reduce((s, did) => {
        const deal = deals.find(d => d.id === did);
        return s + (deal?.mrr || 0);
      }, 0);
      const dealDetails = pAssignments.map(a => {
        const deal = deals.find(d => d.id === a.dealId);
        const roleLabel = ROLE_SLOTS.find(s => s.roleKey === a.roleKey)?.roleLabel || a.roleKey;
        return { ...a, account: deal?.account || "Unknown", roleLabel };
      });
      return { person: p, totalPct, dealCount: dealIds.length, mrrOwned, dealDetails };
    }).filter(d => categoryFilter === "All" || d.person.roleCategory === categoryFilter)
      .sort((a, b) => b.totalPct - a.totalPct);
  }, [people, assignments, deals, categoryFilter]);

  // Pod summary
  const podSummary = useMemo(() => {
    const pods = new Map<string, { people: number; avgUtil: number; totalMRR: number; overloaded: number }>();
    personData.forEach(pd => {
      const pod = pd.person.pod || "—";
      if (!pods.has(pod)) pods.set(pod, { people: 0, avgUtil: 0, totalMRR: 0, overloaded: 0 });
      const entry = pods.get(pod)!;
      entry.people++;
      entry.avgUtil += pd.totalPct;
      entry.totalMRR += pd.mrrOwned;
      if (pd.totalPct > 100) entry.overloaded++;
    });
    pods.forEach(v => { v.avgUtil = v.people > 0 ? v.avgUtil / v.people : 0; });
    return pods;
  }, [personData]);

  return (
    <div className="space-y-6">
      {/* Pod Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from(podSummary.entries()).slice(0, 12).map(([pod, data]) => (
          <div key={pod} className="data-card !p-3">
            <p className="text-caption font-medium text-muted-foreground uppercase tracking-wider truncate">{pod}</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={cn("text-lg font-semibold font-mono", data.avgUtil > 100 ? "text-destructive" : data.avgUtil > 80 ? "text-warning" : "text-positive")}>{data.avgUtil.toFixed(0)}%</span>
              <span className="text-caption text-muted-foreground">avg</span>
            </div>
            <p className="text-caption text-muted-foreground">{data.people} people</p>
            {data.overloaded > 0 && <p className="text-caption text-destructive font-medium">{data.overloaded} overloaded</p>}
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        <button onClick={() => setCategoryFilter("All")} className={cn(
          "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
          categoryFilter === "All" ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
        )}>All</button>
        {ROLE_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn(
            "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
            categoryFilter === cat ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
          )}>{cat}</button>
        ))}
      </div>

      {/* Person Utilization Table */}
      <div className="data-card p-0 overflow-x-auto">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-8"></th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Name</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Role</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Pod</th>
              <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider"># Deals</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[200px]">BW Used</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Total %</th>
            </tr>
          </thead>
          <tbody>
            {personData.map(({ person, totalPct, dealCount, dealDetails }) => (
              <>
                <tr key={person.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedPerson(expandedPerson === person.id ? null : person.id)}>
                  <td className="py-2 px-3">
                    {expandedPerson === person.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </td>
                  <td className="py-2 px-3 font-medium text-foreground">
                    <span className={cn(person.leaving && "line-through text-muted-foreground")}>{person.name}</span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground text-caption">{person.roleTitle}</td>
                  <td className="py-2 px-3 text-muted-foreground text-caption">{person.pod}</td>
                  <td className="py-2 px-3 text-center font-mono text-foreground">{dealCount}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-sm overflow-hidden">
                        <div className={cn("h-full rounded-sm transition-all", totalPct > 100 ? "bg-destructive" : totalPct > 80 ? "bg-warning" : "bg-positive")}
                          style={{ width: `${Math.min(totalPct, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={cn("font-mono text-caption font-medium", totalPct > 100 ? "text-destructive" : totalPct > 80 ? "text-warning" : "text-positive")}>{fmtPct(totalPct)}</span>
                  </td>
                </tr>
                {expandedPerson === person.id && dealDetails.length > 0 && (
                  <tr key={`${person.id}-detail`}>
                    <td colSpan={7} className="px-8 py-2 bg-secondary/10">
                      <div className="space-y-1">
                        {dealDetails.map(d => (
                          <div key={d.id} className="flex items-center justify-between text-caption py-0.5">
                            <span className="text-muted-foreground">{d.account} — <span className="text-foreground">{d.roleLabel}</span></span>
                            <span className={cn("font-mono", d.allocationPct === 0 ? "text-warning" : "text-foreground")}>{d.allocationPct}%</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
