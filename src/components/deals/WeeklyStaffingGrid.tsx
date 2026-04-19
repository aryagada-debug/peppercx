import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWeeklyStaffing, getMonday, fmtISODate, generateWeeks } from "@/hooks/useWeeklyStaffing";
import type { Person, StaffingAssignment } from "@/data/staffingData";

interface Props {
  dealId: string;
  dealPeople: Person[];
  dealAssignments: StaffingAssignment[];
}

const WEEKS_PER_PAGE = 12;

function formatWeekLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function WeeklyStaffingGrid({ dealId, dealPeople, dealAssignments }: Props) {
  const { rows, loading, upsertCell, getCell } = useWeeklyStaffing(dealId);

  // Page anchor — Monday of "today" minus offset weeks
  const [anchorOffset, setAnchorOffset] = useState(0); // 0 = current page starts ~6 weeks ago
  const todayMonday = useMemo(() => getMonday(new Date()), []);

  const weeks = useMemo(() => {
    // Show 6 weeks before today + 6 weeks after by default, paginated
    const start = new Date(todayMonday);
    start.setUTCDate(start.getUTCDate() + (anchorOffset * WEEKS_PER_PAGE - 6) * 7);
    return generateWeeks(start, WEEKS_PER_PAGE);
  }, [todayMonday, anchorOffset]);

  // Group weeks by month for the secondary header
  const monthGroups = useMemo(() => {
    const groups: { key: string; weeks: string[] }[] = [];
    for (const w of weeks) {
      const k = monthKey(w);
      const last = groups[groups.length - 1];
      if (last && last.key === k) last.weeks.push(w);
      else groups.push({ key: k, weeks: [w] });
    }
    return groups;
  }, [weeks]);

  const todayIso = fmtISODate(todayMonday);

  // Quick lookups for monthly totals per person
  const monthlyHoursByPerson = useMemo(() => {
    const map = new Map<string, Map<string, number>>(); // personId -> monthKey -> hours
    for (const r of rows) {
      const k = monthKey(r.week_start);
      if (!map.has(r.person_id)) map.set(r.person_id, new Map());
      const inner = map.get(r.person_id)!;
      const hours = (r.allocation_pct / 100) * 40;
      inner.set(k, (inner.get(k) || 0) + hours);
    }
    return map;
  }, [rows]);

  if (!dealPeople.length) {
    return (
      <div className="bg-card border border-border rounded-xl text-center py-8 px-5">
        <p className="text-muted-foreground">Add team members above to start tracking weekly allocations.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header / pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Weekly Allocation Grid</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Edit allocation % per person per week. Hours = % × 40h/week.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setAnchorOffset(o => o - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 min-w-[120px] text-center">
            {formatWeekLabel(weeks[0])} – {formatWeekLabel(weeks[weeks.length - 1])}
          </span>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setAnchorOffset(o => o + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setAnchorOffset(0)}>
            Today
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            {/* Month group row */}
            <tr className="border-b border-border bg-secondary/20">
              <th className="text-left py-1.5 px-3 sticky left-0 bg-secondary/30 z-10 border-r border-border min-w-[180px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Person</span>
              </th>
              {monthGroups.map(g => (
                <th key={g.key} colSpan={g.weeks.length} className="text-center py-1.5 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-l border-border">
                  {monthLabel(g.key)}
                </th>
              ))}
              <th className="bg-secondary/30 border-l border-border min-w-[80px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Hrs</span>
              </th>
            </tr>
            {/* Week row */}
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left py-1.5 px-3 sticky left-0 bg-secondary/30 z-10 border-r border-border" />
              {weeks.map(w => (
                <th
                  key={w}
                  className={cn(
                    "text-center py-1.5 px-1 text-[10px] font-mono text-muted-foreground border-l border-border min-w-[56px]",
                    w === todayIso && "bg-primary/10 text-primary font-semibold"
                  )}
                  title={w}
                >
                  {formatWeekLabel(w).split(" ")[1]}
                </th>
              ))}
              <th className="bg-secondary/30 border-l border-border" />
            </tr>
          </thead>
          <tbody>
            {dealPeople.map(p => {
              const monthlyMap = monthlyHoursByPerson.get(p.id) || new Map<string, number>();
              const totalHrs = Array.from(monthlyMap.values()).reduce((a, b) => a + b, 0);
              return (
                <tr key={p.id} className="border-b border-border/50 hover:bg-accent/5">
                  <td className="py-1.5 px-3 sticky left-0 bg-card z-10 border-r border-border">
                    <div className="text-xs font-medium text-foreground truncate max-w-[170px]">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[170px]">{p.roleTitle || p.designation}</div>
                  </td>
                  {weeks.map(w => {
                    const cell = getCell(p.id, w);
                    const pct = cell?.allocation_pct ?? 0;
                    return (
                      <td
                        key={w}
                        className={cn(
                          "p-0 border-l border-border text-center align-middle",
                          w === todayIso && "bg-primary/5"
                        )}
                      >
                        <AllocationInput
                          value={pct}
                          onSave={(v) => upsertCell(p.id, w, { allocation_pct: v })}
                        />
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-xs text-foreground border-l border-border bg-secondary/10">
                    {totalHrs.toFixed(0)}h
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Monthly totals footer */}
          <tfoot>
            <tr className="bg-secondary/30 border-t-2 border-border font-semibold">
              <td className="py-1.5 px-3 sticky left-0 bg-secondary/30 z-10 border-r border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                Total %
              </td>
              {weeks.map(w => {
                const sumPct = dealPeople.reduce((acc, p) => acc + (getCell(p.id, w)?.allocation_pct ?? 0), 0);
                return (
                  <td key={w} className="text-center py-1.5 px-1 text-[10px] font-mono tabular-nums text-muted-foreground border-l border-border">
                    {sumPct > 0 ? `${sumPct}%` : "—"}
                  </td>
                );
              })}
              <td className="border-l border-border" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Editable allocation cell ───
function AllocationInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <Input
        type="number"
        min={0}
        max={100}
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const v = Math.max(0, Math.min(100, Number(draft) || 0));
          if (v !== value) onSave(v);
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
        }}
        className="h-7 w-14 mx-auto text-xs text-center px-1 font-mono tabular-nums"
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className={cn(
        "w-full h-7 text-xs font-mono tabular-nums hover:bg-accent/30 transition-colors",
        value === 0 && "text-muted-foreground/50",
        value > 0 && value < 50 && "text-foreground",
        value >= 50 && value < 100 && "text-warning font-medium",
        value >= 100 && "text-destructive font-semibold"
      )}
    >
      {value > 0 ? `${value}%` : "—"}
    </button>
  );
}
