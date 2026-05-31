import React, { useMemo } from "react";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";
import { ACTIVE_DEAL_STATUSES, isAssignmentExpired } from "@/data/staffingData";
import { useTaxonomyQuery } from "@/hooks/queries/useTaxonomyQuery";
import { groupPeopleByDeptRole } from "@/lib/peopleGrouping";
import { DepartmentCard, type DeptCardData } from "./DepartmentCard";

interface Props {
  people: Person[];
  assignments: StaffingAssignment[];
  deals: Deal[];
  onViewDept: (deptName: string) => void;
}

export function DepartmentCardsGrid({ people, assignments, deals, onViewDept }: Props) {
  const { data: taxonomy } = useTaxonomyQuery();

  const activeDealIds = useMemo(
    () => new Set(deals.filter((d) => ACTIVE_DEAL_STATUSES.has(d.dealStatus)).map((d) => d.id)),
    [deals],
  );

  const utilByPerson = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of assignments) {
      if (!activeDealIds.has(a.dealId) || isAssignmentExpired(a)) continue;
      m[a.personId] = (m[a.personId] || 0) + (a.allocationPct || 0);
    }
    return m;
  }, [assignments, activeDealIds]);

  const cards: DeptCardData[] = useMemo(() => {
    if (!taxonomy) return [];
    const groups = groupPeopleByDeptRole(people, taxonomy);
    return groups.map((g) => {
      const active = g.roleTypes.flatMap((rt) => rt.people).filter((p) => !p.tbh && !p.leaving);
      const tbh = g.roleTypes.flatMap((rt) => rt.people).filter((p) => p.tbh).length;
      const leavers = g.roleTypes.flatMap((rt) => rt.people).filter((p) => p.leaving).length;

      const mix = { overloaded: 0, nearFull: 0, healthy: 0, under: 0 };
      let utilSum = 0;
      for (const p of active) {
        const u = utilByPerson[p.id] || 0;
        utilSum += u;
        if (u > 100) mix.overloaded++;
        else if (u >= 85) mix.nearFull++;
        else if (u >= 30) mix.healthy++;
        else mix.under++;
      }
      const avgUtilPct = active.length ? utilSum / active.length : 0;

      return {
        id: g.department.id,
        name: g.department.name,
        headcount: g.total,
        avgUtilPct,
        mix,
        roles: g.roleTypes.map((rt) => ({ name: rt.roleType.name, count: rt.people.length })),
        tbh,
        leavers,
      };
    });
  }, [taxonomy, people, utilByPerson]);

  if (!cards.length) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm border border-dashed border-border rounded-sm">
        Loading department breakdown…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <DepartmentCard key={c.id} data={c} onViewTable={() => onViewDept(c.name)} />
      ))}
    </div>
  );
}