import { useMemo } from "react";
import { Briefcase, Users, Activity, AlertTriangle } from "lucide-react";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
}

/**
 * Compact capacity snapshot for a BOPM persona.
 * Shows: # of unique deals, # of unique people staffed across them,
 * average allocation per person, and gaps (deals with zero allocation
 * or missing a BOPM).
 */
export function BopmStaffingSummary({ deals, people, assignments }: Props) {
  const stats = useMemo(() => {
    const dealIds = new Set(deals.map(d => d.id));
    const scopedAssign = assignments.filter(a => dealIds.has(a.dealId));

    const personIds = new Set(scopedAssign.map(a => a.personId));
    const peopleOnDeals = people.filter(p => personIds.has(p.id) && !p.tbh && !p.leaving);

    // Sum allocation per person across her deals
    const allocByPerson = new Map<string, number>();
    scopedAssign.forEach(a => {
      allocByPerson.set(a.personId, (allocByPerson.get(a.personId) || 0) + (Number(a.allocationPct) || 0));
    });
    const allocVals = Array.from(allocByPerson.values());
    const avgAlloc = allocVals.length ? Math.round(allocVals.reduce((s, v) => s + v, 0) / allocVals.length) : 0;
    const overAlloc = allocVals.filter(v => v > 100).length;
    const underAlloc = allocVals.filter(v => v > 0 && v < 50).length;

    // Deals with no allocation at all
    const dealsWithAlloc = new Set(scopedAssign.filter(a => (a.allocationPct || 0) > 0).map(a => a.dealId));
    const dealsZeroAlloc = deals.filter(d => !dealsWithAlloc.has(d.id)).length;

    return {
      dealCount: deals.length,
      peopleCount: peopleOnDeals.length,
      avgAlloc,
      overAlloc,
      underAlloc,
      dealsZeroAlloc,
    };
  }, [deals, people, assignments]);

  const cards = [
    { label: "Your deals", value: stats.dealCount, icon: Briefcase, tone: "text-foreground" },
    { label: "People staffed", value: stats.peopleCount, icon: Users, tone: "text-foreground" },
    { label: "Avg allocation / person", value: `${stats.avgAlloc}%`, icon: Activity, tone: "text-foreground" },
    { label: "Capacity flags", value: `${stats.overAlloc + stats.underAlloc + stats.dealsZeroAlloc}`, icon: AlertTriangle,
      tone: (stats.overAlloc + stats.underAlloc + stats.dealsZeroAlloc) > 0 ? "text-warning" : "text-positive",
      hint: `${stats.overAlloc} over · ${stats.underAlloc} under · ${stats.dealsZeroAlloc} no-alloc deals` },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
      {cards.map(c => (
        <div key={c.label} className="rounded-lg border border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <c.icon className="h-3.5 w-3.5" />
            <span className="text-[11px] uppercase tracking-wide font-medium">{c.label}</span>
          </div>
          <div className={`mt-1 text-xl font-semibold tabular-nums ${c.tone}`}>{c.value}</div>
          {c.hint && <div className="text-[10px] text-muted-foreground mt-0.5">{c.hint}</div>}
        </div>
      ))}
    </div>
  );
}