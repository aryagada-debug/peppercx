import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/csvTargets";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
}

// Group people on a deal by their team capability (role category).
const TEAM_ORDER: RoleCategory[] = [
  "Operations",
  "Content Strategy",
  "Content",
  "SEO",
  "Creative Strategy",
  "Creative Copy",
  "Creative Art",
  "Video",
  "Performance & Growth",
  "Other",
];

export function BopmStaffingTables({ deals, people, assignments }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const personById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  const assignmentsByDeal = useMemo(() => {
    const m = new Map<string, StaffingAssignment[]>();
    for (const a of assignments) {
      if (!m.has(a.dealId)) m.set(a.dealId, []);
      m.get(a.dealId)!.push(a);
    }
    return m;
  }, [assignments]);

  // Build a per-deal "teams summary" string for the collapsed row, e.g. "SEO 3 · Content 2 · Ops 1"
  const dealTeamSummary = (dealId: string) => {
    const aList = assignmentsByDeal.get(dealId) || [];
    const counts = new Map<string, number>();
    for (const a of aList) {
      const p = personById.get(a.personId);
      if (!p) continue;
      const cat = p.roleCategory || "Other";
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `${cat} ${n}`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter(d =>
      (d.account || "").toLowerCase().includes(q) ||
      (d.dealName || "").toLowerCase().includes(q) ||
      (d.dealId || "").toLowerCase().includes(q)
    );
  }, [deals, search]);

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Your deals & staffing</h3>
          <p className="text-[11px] text-muted-foreground">Click any deal to see who is staffed from each team</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search account, deal…"
              className="h-8 pl-7 pr-3 rounded-md border border-border bg-background text-xs w-56 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{filtered.length} deals</span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-8"></th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Deal name</th>
              <th className="px-3 py-2 text-left font-mono">Deal ID</th>
              <th className="px-3 py-2 text-left">Teams staffed</th>
              <th className="px-3 py-2 text-right">People</th>
              <th className="px-3 py-2 text-right">MRR</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const aList = assignmentsByDeal.get(d.id) || [];
              const isOpen = open.has(d.id);
              const summary = dealTeamSummary(d.id);

              // Group assignments by team capability for the expanded view
              const byTeam = new Map<string, StaffingAssignment[]>();
              for (const a of aList) {
                const p = personById.get(a.personId);
                const cat = (p?.roleCategory || "Other") as string;
                if (!byTeam.has(cat)) byTeam.set(cat, []);
                byTeam.get(cat)!.push(a);
              }
              const orderedTeams = TEAM_ORDER.filter(t => byTeam.has(t))
                .concat(Array.from(byTeam.keys()).filter(k => !TEAM_ORDER.includes(k as RoleCategory)) as RoleCategory[]);

              return (
                <>
                  <tr
                    key={d.id}
                    className={cn(
                      "border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors",
                      isOpen && "bg-secondary/20"
                    )}
                    onClick={() => toggle(d.id)}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{d.account}</td>
                    <td className="px-3 py-2.5 text-foreground">{d.dealName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-accent">{d.dealId}</td>
                    <td className="px-3 py-2.5">
                      {summary.length === 0 ? (
                        <span className="text-xs italic text-muted-foreground">No team staffed</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {summary.slice(0, 5).map(s => (
                            <span key={s} className="inline-block px-1.5 py-0.5 rounded bg-secondary text-[10px] text-foreground">
                              {s}
                            </span>
                          ))}
                          {summary.length > 5 && (
                            <span className="text-[10px] text-muted-foreground">+{summary.length - 5}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{aList.length}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatINR(d.mrr || 0)}</td>
                  </tr>

                  {isOpen && (
                    <tr key={`${d.id}-x`}>
                      <td colSpan={7} className="bg-secondary/10 border-t border-border/50 px-6 py-4">
                        {aList.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No one staffed on this deal yet.</p>
                        ) : (
                          <div className="rounded-lg border border-border bg-card overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 text-left w-[160px]">Team</th>
                                  <th className="px-3 py-2 text-left">Person</th>
                                  <th className="px-3 py-2 text-left">Role</th>
                                  <th className="px-3 py-2 text-right w-[100px]">Allocation</th>
                                </tr>
                              </thead>
                              <tbody>
                                {orderedTeams.map(team => {
                                  const rows = byTeam.get(team) || [];
                                  return rows.map((a, idx) => {
                                    const p = personById.get(a.personId);
                                    return (
                                      <tr key={a.id} className="border-t border-border/50">
                                        <td className="px-3 py-1.5 text-muted-foreground">
                                          {idx === 0 ? (
                                            <span className="font-medium text-foreground">{team}</span>
                                          ) : ""}
                                        </td>
                                        <td className="px-3 py-1.5 text-foreground">
                                          {p?.name || "—"}
                                          {p?.tbh && <span className="ml-1 text-[10px] text-amber-600">(TBH)</span>}
                                          {p?.leaving && <span className="ml-1 text-[10px] text-rose-600">(Leaving)</span>}
                                        </td>
                                        <td className="px-3 py-1.5 text-muted-foreground">
                                          {p?.roleTitle || a.roleKey}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                          {a.allocationPct}%
                                        </td>
                                      </tr>
                                    );
                                  });
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">No deals match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
