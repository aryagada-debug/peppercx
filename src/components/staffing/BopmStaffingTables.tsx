import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/csvTargets";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";

const MONTH_HOURS = 160;
const WEEKS_PER_MONTH = 4.33;

function pctToMonthlyHours(pct: number) {
  return (pct / 100) * MONTH_HOURS;
}
function pctToWeeklyHours(pct: number) {
  return pctToMonthlyHours(pct) / WEEKS_PER_MONTH;
}
function bandwidthTone(pct: number) {
  if (pct < 60) return "text-rose-600 bg-rose-50";
  if (pct <= 85) return "text-emerald-600 bg-emerald-50";
  return "text-amber-600 bg-amber-50";
}

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
}

export function BopmStaffingTables({ deals, people, assignments }: Props) {
  const personById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const dealById = useMemo(() => new Map(deals.map(d => [d.id, d])), [deals]);
  const assignmentsByDeal = useMemo(() => {
    const m = new Map<string, StaffingAssignment[]>();
    for (const a of assignments) {
      if (!m.has(a.dealId)) m.set(a.dealId, []);
      m.get(a.dealId)!.push(a);
    }
    return m;
  }, [assignments]);
  const assignmentsByPerson = useMemo(() => {
    const m = new Map<string, StaffingAssignment[]>();
    for (const a of assignments) {
      if (!m.has(a.personId)) m.set(a.personId, []);
      m.get(a.personId)!.push(a);
    }
    return m;
  }, [assignments]);

  return (
    <div className="space-y-6">
      <DealsTable
        deals={deals}
        personById={personById}
        assignmentsByDeal={assignmentsByDeal}
      />
      <PeopleTable
        people={Array.from(new Set(assignments.map(a => a.personId)))
          .map(id => personById.get(id)).filter(Boolean) as Person[]}
        dealById={dealById}
        assignmentsByPerson={assignmentsByPerson}
      />
    </div>
  );
}

function DealsTable({
  deals, personById, assignmentsByDeal,
}: {
  deals: Deal[];
  personById: Map<string, Person>;
  assignmentsByDeal: Map<string, StaffingAssignment[]>;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Your deals</h3>
          <p className="text-[11px] text-muted-foreground">Bandwidth and revenue capacity per deal · 160h/month baseline</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{deals.length} deals</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-8"></th>
              <th className="px-3 py-2 text-left">Deal</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-right">People</th>
              <th className="px-3 py-2 text-right">Weekly hrs</th>
              <th className="px-3 py-2 text-right">Bandwidth used</th>
              <th className="px-3 py-2 text-right">Revenue handled</th>
            </tr>
          </thead>
          <tbody>
            {deals.map(d => {
              const aList = assignmentsByDeal.get(d.id) || [];
              const monthly = aList.reduce((s, a) => s + pctToMonthlyHours(a.allocationPct), 0);
              const weekly = monthly / WEEKS_PER_MONTH;
              const bw = aList.reduce((s, a) => s + a.allocationPct, 0); // already %
              const mrr = d.mrr || 0;
              return (
                <>
                  <tr key={d.id} className="border-t border-border hover:bg-secondary/30 cursor-pointer" onClick={() => toggle(d.id)}>
                    <td className="px-3 py-2 text-muted-foreground">
                      {open.has(d.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">{d.dealName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.account}</td>
                    <td className="px-3 py-2 text-right font-mono">{aList.length}</td>
                    <td className="px-3 py-2 text-right font-mono">{weekly.toFixed(1)}h</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn("inline-block px-2 py-0.5 rounded font-mono text-xs", bandwidthTone(bw))}>
                        {bw.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatINR(mrr)}</td>
                  </tr>
                  {open.has(d.id) && aList.map(a => {
                    const p = personById.get(a.personId);
                    if (!p) return null;
                    const wHrs = pctToWeeklyHours(a.allocationPct);
                    const personRev = (a.allocationPct / 100) * mrr;
                    return (
                      <tr key={a.id} className="bg-secondary/20 border-t border-border/50 text-xs">
                        <td></td>
                        <td className="px-3 py-1.5 pl-8 text-muted-foreground">{a.roleKey}</td>
                        <td className="px-3 py-1.5 text-foreground">{p.name}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{wHrs.toFixed(1)}h</td>
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{a.allocationPct}%</td>
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{formatINR(personRev)}</td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
            {deals.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">No deals in your scope.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PeopleTable({
  people, dealById, assignmentsByPerson,
}: {
  people: Person[];
  dealById: Map<string, Deal>;
  assignmentsByPerson: Map<string, StaffingAssignment[]>;
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Your people</h3>
          <p className="text-[11px] text-muted-foreground">Allocation across all your deals · 160h/month baseline</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{people.length} people</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Person</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-right">Deals</th>
              <th className="px-3 py-2 text-right">Hrs/week</th>
              <th className="px-3 py-2 text-right">Bandwidth</th>
              <th className="px-3 py-2 text-right">Revenue handled</th>
            </tr>
          </thead>
          <tbody>
            {people.map(p => {
              const aList = assignmentsByPerson.get(p.id) || [];
              const totalPct = aList.reduce((s, a) => s + a.allocationPct, 0);
              const weekly = pctToWeeklyHours(totalPct);
              const revenue = aList.reduce((s, a) => {
                const d = dealById.get(a.dealId); if (!d) return s;
                return s + (a.allocationPct / 100) * (d.mrr || 0);
              }, 0);
              return (
                <tr key={p.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.roleTitle || p.roleCategory}</td>
                  <td className="px-3 py-2 text-right font-mono">{aList.length}</td>
                  <td className="px-3 py-2 text-right font-mono">{weekly.toFixed(1)}h</td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn("inline-block px-2 py-0.5 rounded font-mono text-xs", bandwidthTone(totalPct))}>
                      {totalPct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatINR(revenue)}</td>
                </tr>
              );
            })}
            {people.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-xs">No people staffed yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}