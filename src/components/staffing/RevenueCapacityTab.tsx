import { useMemo, useState } from "react";
import { formatINR } from "@/lib/csvTargets";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Deal, Person, StaffingAssignment, RevenueCapacityTarget } from "@/data/staffingData";
import { DEPARTMENTS } from "@/data/staffingData";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  targets: RevenueCapacityTarget[];
  onUpdateTargets: (targets: RevenueCapacityTarget[]) => void;
}

const fmtCurrency = (n: number) => {
  return formatINR(Number(n) || 0);
};

interface DesignationRow {
  department: string;
  designation: string;
  headcount: number;
  totalDealValue: number;
  avgPerPerson: number;
  targetPerPerson: number;
  delta: number;
  deltaPct: number;
  personDetails: { person: Person; totalDealValue: number; dealCount: number }[];
}

interface LeaderRollup {
  leader: Person;
  department: string;
  totalActual: number;
  totalTarget: number;
  delta: number;
  reportCount: number;
}

export function RevenueCapacityTab({ deals, people, assignments, targets, onUpdateTargets }: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [expandedDesig, setExpandedDesig] = useState<string | null>(null);

  // Compute deal value per person
  const personDealValues = useMemo(() => {
    const map = new Map<string, { totalDealValue: number; dealCount: number }>();
    people.forEach(p => {
      const pAssignments = assignments.filter(a => a.personId === p.id);
      const dealIds = [...new Set(pAssignments.map(a => a.dealId))];
      const totalDealValue = dealIds.reduce((s, did) => {
        const deal = deals.find(d => d.id === did);
        return s + (deal?.totalDealValue || (deal?.mrr ? deal.mrr * 12 : 0));
      }, 0);
      map.set(p.id, { totalDealValue, dealCount: dealIds.length });
    });
    return map;
  }, [people, assignments, deals]);

  // Group by department → designation
  const departmentData = useMemo(() => {
    const deptMap = new Map<string, Map<string, DesignationRow>>();
    
    people.filter(p => !p.tbh && !p.leaving && p.department && p.designation).forEach(p => {
      const dept = p.department!;
      const desig = p.designation!;
      if (!deptMap.has(dept)) deptMap.set(dept, new Map());
      const desigMap = deptMap.get(dept)!;
      
      if (!desigMap.has(desig)) {
        const target = targets.find(t => t.department === dept && t.designation === desig);
        desigMap.set(desig, {
          department: dept,
          designation: desig,
          headcount: 0,
          totalDealValue: 0,
          avgPerPerson: 0,
          targetPerPerson: target?.targetDealValuePerPerson || 0,
          delta: 0,
          deltaPct: 0,
          personDetails: [],
        });
      }
      
      const row = desigMap.get(desig)!;
      const pv = personDealValues.get(p.id) || { totalDealValue: 0, dealCount: 0 };
      row.headcount++;
      row.totalDealValue += pv.totalDealValue;
      row.personDetails.push({ person: p, ...pv });
    });

    // Compute averages and deltas
    deptMap.forEach(desigMap => {
      desigMap.forEach(row => {
        row.avgPerPerson = row.headcount > 0 ? row.totalDealValue / row.headcount : 0;
        row.delta = row.avgPerPerson - row.targetPerPerson;
        row.deltaPct = row.targetPerPerson > 0 ? (row.delta / row.targetPerPerson) * 100 : 0;
        row.personDetails.sort((a, b) => b.totalDealValue - a.totalDealValue);
      });
    });

    return deptMap;
  }, [people, assignments, deals, targets, personDealValues]);

  // Leader roll-ups: find people with reports and sum their team's actual vs target
  const leaderRollups = useMemo(() => {
    const rollups: LeaderRollup[] = [];
    const nameToId = new Map<string, Person>();
    people.forEach(p => { if (!p.tbh) nameToId.set(p.name, p); });

    // Find people who have direct reports
    const managersWithReports = new Set<string>();
    people.forEach(p => {
      if (p.reportingManager && nameToId.has(p.reportingManager)) {
        managersWithReports.add(p.reportingManager);
      }
    });

    // For each manager, collect all reports (recursive) and sum
    const getReportIds = (managerName: string, visited = new Set<string>()): string[] => {
      if (visited.has(managerName)) return [];
      visited.add(managerName);
      const directReports = people.filter(p => p.reportingManager === managerName && !p.tbh);
      const ids: string[] = [];
      directReports.forEach(r => {
        ids.push(r.id);
        ids.push(...getReportIds(r.name, visited));
      });
      return ids;
    };

    managersWithReports.forEach(mgrName => {
      const mgr = nameToId.get(mgrName);
      if (!mgr || !mgr.department) return;
      const reportIds = getReportIds(mgrName);
      if (reportIds.length < 2) return; // Only show leaders with meaningful teams

      let totalActual = 0;
      let totalTarget = 0;
      reportIds.forEach(rid => {
        const p = people.find(pp => pp.id === rid);
        if (!p || !p.designation || !p.department) return;
        const pv = personDealValues.get(rid);
        totalActual += pv?.totalDealValue || 0;
        const target = targets.find(t => t.department === p.department && t.designation === p.designation);
        totalTarget += target?.targetDealValuePerPerson || 0;
      });

      // Add self
      const selfPv = personDealValues.get(mgr.id);
      totalActual += selfPv?.totalDealValue || 0;
      const selfTarget = targets.find(t => t.department === mgr.department && t.designation === mgr.designation);
      totalTarget += selfTarget?.targetDealValuePerPerson || 0;

      rollups.push({
        leader: mgr,
        department: mgr.department || "",
        totalActual,
        totalTarget,
        delta: totalActual - totalTarget,
        reportCount: reportIds.length,
      });
    });

    return rollups.sort((a, b) => b.reportCount - a.reportCount).slice(0, 15);
  }, [people, targets, personDealValues]);

  const updateTarget = (dept: string, desig: string, value: number) => {
    const existing = targets.find(t => t.department === dept && t.designation === desig);
    if (existing) {
      onUpdateTargets(targets.map(t => (t.department === dept && t.designation === desig) ? { ...t, targetDealValuePerPerson: value } : t));
    } else {
      onUpdateTargets([...targets, { department: dept, designation: desig, targetDealValuePerPerson: value }]);
    }
    setEditingKey(null);
  };

  return (
    <div className="space-y-6">
      {/* Leader Roll-up Summary */}
      <div className="data-card">
        <h3 className="text-ui font-semibold text-foreground mb-3">Leader Roll-up Summary</h3>
        <p className="text-caption text-muted-foreground mb-4">Total actual vs target revenue capacity across each leader's team.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {leaderRollups.map(lr => (
            <div key={lr.leader.id} className="border border-border rounded-lg p-3 bg-secondary/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-ui font-medium text-foreground">{lr.leader.name}</span>
                <span className="text-caption text-muted-foreground">{lr.reportCount} reports</span>
              </div>
              <p className="text-caption text-muted-foreground">{lr.leader.designation}</p>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="text-caption text-muted-foreground">Actual</p>
                  <p className="font-mono text-ui text-foreground">{fmtCurrency(lr.totalActual)}</p>
                </div>
                <div className="text-right">
                  <p className="text-caption text-muted-foreground">Target</p>
                  <p className="font-mono text-ui text-foreground">{fmtCurrency(lr.totalTarget)}</p>
                </div>
                <div className="text-right">
                  <p className="text-caption text-muted-foreground">Delta</p>
                  <p className={cn("font-mono text-ui font-medium", lr.delta > 0 ? "text-positive" : lr.delta < 0 ? "text-destructive" : "text-muted-foreground")}>
                    {lr.delta > 0 ? "+" : ""}{fmtCurrency(lr.delta)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Department → Designation Table */}
      <div className="data-card">
        <div className="mb-4">
          <h3 className="text-ui font-semibold text-foreground">Revenue Capacity by Designation</h3>
          <p className="text-caption text-muted-foreground mt-1">Click target values to edit. Grouped by department with per-designation inputs.</p>
        </div>

        <div className="space-y-4">
          {Array.from(departmentData.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dept, desigMap]) => {
              const isDeptExpanded = expandedDept === dept || expandedDept === null;
              const deptRows = Array.from(desigMap.values()).sort((a, b) => b.headcount - a.headcount);
              const deptTotal = deptRows.reduce((s, r) => s + r.totalDealValue, 0);
              const deptHeadcount = deptRows.reduce((s, r) => s + r.headcount, 0);

              return (
                <div key={dept} className="border border-border rounded-lg overflow-hidden">
                  {/* Department header */}
                  <button onClick={() => setExpandedDept(expandedDept === dept ? "___none___" : dept)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-secondary/20 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-2">
                      {isDeptExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-ui font-semibold text-foreground">{dept}</span>
                      <span className="text-caption text-muted-foreground">{deptHeadcount} people</span>
                    </div>
                    <span className="font-mono text-ui text-foreground">{fmtCurrency(deptTotal)}</span>
                  </button>

                  {isDeptExpanded && (
                    <table className="w-full text-ui">
                      <thead>
                        <tr className="border-b border-border bg-secondary/10">
                          <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider w-8"></th>
                          <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Designation</th>
                          <th className="text-center py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider w-20">HC</th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Total DV</th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Actual/Person</th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Target/Person</th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deptRows.map(row => {
                          const key = `${row.department}|${row.designation}`;
                          const isDesigExpanded = expandedDesig === key;
                          return (
                            <>
                              <tr key={key} className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                                onClick={() => setExpandedDesig(isDesigExpanded ? null : key)}>
                                <td className="py-2 px-4">
                                  {isDesigExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                </td>
                                <td className="py-2 px-4 font-medium text-foreground">{row.designation}</td>
                                <td className="py-2 px-4 text-center font-mono text-foreground">{row.headcount}</td>
                                <td className="py-2 px-4 text-right font-mono text-foreground">{fmtCurrency(row.totalDealValue)}</td>
                                <td className="py-2 px-4 text-right font-mono text-foreground">{fmtCurrency(row.avgPerPerson)}</td>
                                <td className="py-2 px-4 text-right" onClick={e => e.stopPropagation()}>
                                  {editingKey === key ? (
                                    <input type="number" className="w-24 h-7 px-2 rounded border border-accent bg-card text-ui text-foreground text-right font-mono"
                                      value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                                      onBlur={() => updateTarget(row.department, row.designation, parseFloat(editValue) || 0)}
                                      onKeyDown={e => { if (e.key === "Enter") updateTarget(row.department, row.designation, parseFloat(editValue) || 0); if (e.key === "Escape") setEditingKey(null); }} />
                                  ) : (
                                    <span onClick={() => { setEditingKey(key); setEditValue(String(row.targetPerPerson)); }}
                                      className="cursor-pointer font-mono text-accent hover:text-accent/80">{fmtCurrency(row.targetPerPerson)}</span>
                                  )}
                                </td>
                                <td className="py-2 px-4 text-right">
                                  <span className={cn("font-mono font-medium",
                                    row.delta > 0 ? "text-positive" : row.delta < 0 ? "text-destructive" : "text-muted-foreground"
                                  )}>
                                    {row.delta > 0 ? "+" : ""}{fmtCurrency(row.delta)}
                                  </span>
                                </td>
                              </tr>
                              {isDesigExpanded && (
                                <tr key={`${key}-detail`}>
                                  <td colSpan={7} className="px-8 py-2 bg-secondary/10">
                                    <div className="space-y-1">
                                      {row.personDetails.map(pd => {
                                        const personDelta = pd.totalDealValue - row.targetPerPerson;
                                        return (
                                          <div key={pd.person.id} className="flex items-center justify-between text-caption py-0.5">
                                            <div>
                                              <span className="text-foreground font-medium">{pd.person.name}</span>
                                              <span className="text-muted-foreground ml-2">{pd.person.band} • {pd.dealCount} deals</span>
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
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
