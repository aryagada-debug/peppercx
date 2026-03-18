import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Deal, Person, StaffingAssignment, RevenueCapacityTarget, RoleCategory } from "@/data/staffingData";
import { ROLE_CATEGORIES, ROLE_SLOTS } from "@/data/staffingData";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  targets: RevenueCapacityTarget[];
  onUpdateTargets: (targets: RevenueCapacityTarget[]) => void;
}

const fmtCurrency = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

export function RevenueCapacityTab({ deals, people, assignments, targets, onUpdateTargets }: Props) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const analysis = useMemo(() => {
    return ROLE_CATEGORIES.map(cat => {
      const catPeople = people.filter(p => p.roleCategory === cat && !p.tbh && !p.leaving);
      const target = targets.find(t => t.roleCategory === cat);
      const targetPerPerson = target?.targetDealValuePerPerson || 0;

      // Compute actual deal value per person
      const personDetails = catPeople.map(p => {
        const pAssignments = assignments.filter(a => a.personId === p.id);
        const dealIds = [...new Set(pAssignments.map(a => a.dealId))];
        const totalDealValue = dealIds.reduce((s, did) => {
          const deal = deals.find(d => d.id === did);
          return s + (deal?.totalDealValue || deal?.mrr ? (deal?.mrr || 0) * 12 : 0);
        }, 0);
        return { person: p, totalDealValue, dealCount: dealIds.length };
      });

      const totalDealValue = personDetails.reduce((s, pd) => s + pd.totalDealValue, 0);
      const avgPerPerson = catPeople.length > 0 ? totalDealValue / catPeople.length : 0;
      const delta = avgPerPerson - targetPerPerson;
      const deltaPct = targetPerPerson > 0 ? (delta / targetPerPerson) * 100 : 0;

      return { category: cat, headcount: catPeople.length, totalDealValue, avgPerPerson, targetPerPerson, delta, deltaPct, personDetails };
    }).filter(a => a.headcount > 0);
  }, [people, assignments, deals, targets]);

  const updateTarget = (cat: RoleCategory, value: number) => {
    const existing = targets.find(t => t.roleCategory === cat);
    if (existing) {
      onUpdateTargets(targets.map(t => t.roleCategory === cat ? { ...t, targetDealValuePerPerson: value } : t));
    } else {
      onUpdateTargets([...targets, { roleCategory: cat, targetDealValuePerPerson: value }]);
    }
    setEditingCategory(null);
  };

  return (
    <div className="space-y-6">
      <div className="data-card">
        <div className="mb-4">
          <h3 className="text-ui font-semibold text-foreground">Revenue Capacity by Role</h3>
          <p className="text-caption text-muted-foreground mt-1">Set target deal value per person for each role category and see the delta vs actuals.</p>
        </div>

        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-8"></th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Role Category</th>
              <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Headcount</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Total Deal Value</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Actual / Person</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Target / Person</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Delta</th>
            </tr>
          </thead>
          <tbody>
            {analysis.map(a => (
              <>
                <tr key={a.category} className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                  onClick={() => setExpandedCategory(expandedCategory === a.category ? null : a.category)}>
                  <td className="py-2.5 px-3">
                    {expandedCategory === a.category ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-foreground">{a.category}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-foreground">{a.headcount}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-foreground">{fmtCurrency(a.totalDealValue)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-foreground">{fmtCurrency(a.avgPerPerson)}</td>
                  <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                    {editingCategory === a.category ? (
                      <input type="number" className="w-24 h-7 px-2 rounded border border-accent bg-card text-ui text-foreground text-right font-mono"
                        value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                        onBlur={() => updateTarget(a.category as RoleCategory, parseFloat(editValue) || 0)}
                        onKeyDown={e => { if (e.key === "Enter") updateTarget(a.category as RoleCategory, parseFloat(editValue) || 0); if (e.key === "Escape") setEditingCategory(null); }} />
                    ) : (
                      <span onClick={() => { setEditingCategory(a.category); setEditValue(String(a.targetPerPerson)); }}
                        className="cursor-pointer font-mono text-accent hover:text-accent/80">{fmtCurrency(a.targetPerPerson)}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={cn("font-mono font-medium",
                      a.delta > 0 ? "text-positive" : a.delta < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {a.delta > 0 ? "+" : ""}{fmtCurrency(a.delta)} ({a.deltaPct > 0 ? "+" : ""}{a.deltaPct.toFixed(0)}%)
                    </span>
                  </td>
                </tr>
                {expandedCategory === a.category && (
                  <tr key={`${a.category}-detail`}>
                    <td colSpan={7} className="px-8 py-2 bg-secondary/10">
                      <div className="space-y-1">
                        {a.personDetails.sort((x, y) => y.totalDealValue - x.totalDealValue).map(pd => {
                          const personDelta = pd.totalDealValue - a.targetPerPerson;
                          return (
                            <div key={pd.person.id} className="flex items-center justify-between text-caption py-0.5">
                              <div>
                                <span className="text-foreground font-medium">{pd.person.name}</span>
                                <span className="text-muted-foreground ml-2">{pd.person.roleTitle} • {pd.dealCount} deals</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-mono text-foreground">{fmtCurrency(pd.totalDealValue)}</span>
                                <span className={cn("font-mono font-medium min-w-[80px] text-right",
                                  personDelta > 0 ? "text-positive" : personDelta < 0 ? "text-destructive" : "text-muted-foreground"
                                )}>
                                  {personDelta > 0 ? "+" : ""}{fmtCurrency(personDelta)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
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
