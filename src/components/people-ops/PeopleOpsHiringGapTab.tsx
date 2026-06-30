import { useMemo, useState } from "react";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";
import { ACTIVE_DEAL_STATUSES, isAssignmentExpired } from "@/data/staffingData";
import { formatINR } from "@/lib/csvTargets";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  people: Person[];
  assignments: StaffingAssignment[];
  deals: Deal[];
  capacityRoster: Person[];
  isAdmin: boolean;
}

const DRIVER_ROLES: { key: string; label: string; designations: string[] }[] = [
  { key: "senior_bopm",     label: "Senior BOPM",     designations: ["Senior BOPM"] },
  { key: "seo_growth_lead", label: "SEO Growth Lead", designations: ["SEO Growth Lead"] },
  { key: "content_lead",    label: "Content Lead",    designations: ["Content Lead"] },
];

// Approx required FTEs per active deal (1 of each driver role per deal).
// Mirrors the reference app's simplified bandwidth model until staffing_bandwidth_rules wiring is added here.
const REQUIRED_PER_DEAL_PCT = 100;

export function PeopleOpsHiringGapTab({ people, assignments, deals, isAdmin }: Props) {
  const [vsdFilter, setVsdFilter] = useState("all");

  const vsdOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) if (d.vsd) set.add(d.vsd);
    return Array.from(set).sort();
  }, [deals]);

  const scopedDeals = useMemo(
    () => deals.filter((d) => vsdFilter === "all" || d.vsd === vsdFilter),
    [deals, vsdFilter],
  );
  const activeDeals = useMemo(
    () => scopedDeals.filter((d) => ACTIVE_DEAL_STATUSES.has(d.dealStatus)),
    [scopedDeals],
  );
  const activeDealIds = useMemo(() => new Set(activeDeals.map((d) => d.id)), [activeDeals]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const leavingPeople = people.filter((p) => p.leaving && !p.tbh);
  const tbhPeople = people.filter((p) => p.tbh);

  const dealHasLeaving = (dealId: string) =>
    assignments.some((a) => a.dealId === dealId && !isAssignmentExpired(a) && personById.get(a.personId)?.leaving);
  const replacementDeals = activeDeals.filter((d) => dealHasLeaving(d.id));

  const fteGap = useMemo(() => {
    return DRIVER_ROLES.map((role) => {
      const required = activeDeals.length * REQUIRED_PER_DEAL_PCT;
      let current = 0;
      for (const a of assignments) {
        if (!activeDealIds.has(a.dealId) || isAssignmentExpired(a)) continue;
        const p = personById.get(a.personId);
        if (!p || p.leaving || p.tbh) continue;
        if (role.designations.includes((p.designation || "").trim())) {
          current += a.allocationPct || 0;
        }
      }
      const gap = Math.max(0, Math.ceil(required / 100) - Math.ceil(current / 100));
      return { ...role, required, current, gap };
    });
  }, [activeDeals, activeDealIds, assignments, personById]);

  const unstaffed = useMemo(() => {
    return activeDeals.filter((d) => {
      if (!d.mrr) return false;
      const liveAssignees = assignments.filter(
        (a) => a.dealId === d.id && !isAssignmentExpired(a) && !personById.get(a.personId)?.leaving && !personById.get(a.personId)?.tbh,
      );
      const hasDriver = liveAssignees.some((a) => {
        const p = personById.get(a.personId);
        return p && DRIVER_ROLES.some((r) => r.designations.includes((p.designation || "").trim()));
      });
      return !hasDriver;
    });
  }, [activeDeals, assignments, personById]);

  return (
    <div className="space-y-6">
      {/* VSD filter */}
      {isAdmin && vsdOptions.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">VSD:</label>
          <select
            value={vsdFilter}
            onChange={(e) => setVsdFilter(e.target.value)}
            className="text-xs bg-background border border-border rounded-sm px-2 py-1"
          >
            <option value="all">All VSD</option>
            {vsdOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}

      {/* Leaving + TBH cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={`Leaving (${leavingPeople.length})`} tone="destructive">
          {leavingPeople.length === 0 && <p className="text-xs text-muted-foreground">No one leaving.</p>}
          {leavingPeople.map((p) => {
            const impacted = assignments.filter(
              (a) => a.personId === p.id && !isAssignmentExpired(a) && activeDealIds.has(a.dealId),
            ).length;
            return (
              <div key={p.id} className="flex items-center gap-2 py-1 text-xs">
                <span className="text-foreground">{p.name}</span>
                <Badge variant="outline" className="text-[10px]">{p.designation || p.roleTitle}</Badge>
                <span className="ml-auto text-destructive tabular-nums">{impacted} deals</span>
              </div>
            );
          })}
        </Card>
        <Card title={`TBH placeholders (${tbhPeople.length})`} tone="info">
          {tbhPeople.length === 0 && <p className="text-xs text-muted-foreground">No TBH placeholders.</p>}
          {tbhPeople.map((p) => {
            const placed = assignments.filter(
              (a) => a.personId === p.id && !isAssignmentExpired(a) && activeDealIds.has(a.dealId),
            ).length;
            return (
              <div key={p.id} className="flex items-center gap-2 py-1 text-xs">
                <span className="text-sky-600">{p.name}</span>
                <Badge variant="outline" className="text-[10px]">{p.designation || p.roleTitle}</Badge>
                <span className="ml-auto text-sky-600 tabular-nums">{placed} deals</span>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Replacement-needed */}
      {replacementDeals.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">Replacement-needed deals</h4>
          <div className="flex flex-wrap gap-2">
            {replacementDeals.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 border border-amber-500/30 bg-amber-500/10 rounded-sm text-xs">
                <span className="text-foreground">{d.dealName || d.account}</span>
                {isAdmin && d.mrr ? <span className="text-emerald-600 tabular-nums">{formatINR(d.mrr)}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FTE Gap Analysis */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">FTE Gap Analysis</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {fteGap.map((g) => (
            <div key={g.key} className="border border-border rounded-sm p-4">
              <div className="text-xs font-medium text-foreground mb-3">{g.label}</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Current BW</p>
                  <p className="text-lg font-medium tabular-nums">{Math.round(g.current)}%</p>
                  <p className="text-[10px] text-muted-foreground">{Math.ceil(g.current / 100)} FTE</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Required BW</p>
                  <p className="text-lg font-medium tabular-nums">{Math.round(g.required)}%</p>
                  <p className="text-[10px] text-muted-foreground">{Math.ceil(g.required / 100)} FTE</p>
                </div>
              </div>
              <div className={cn(
                "flex items-center justify-center gap-1.5 text-xs font-medium py-1 rounded-sm",
                g.gap > 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600",
              )}>
                {g.gap > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {g.gap > 0 ? `${g.gap} FTE gap` : "Sufficient"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unstaffed active deals */}
      {unstaffed.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-destructive uppercase tracking-wide mb-2">Unstaffed active deals</h4>
          <div className="flex flex-wrap gap-2">
            {unstaffed.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 border border-destructive/30 bg-destructive/10 rounded-sm text-xs">
                <span className="text-foreground">{d.dealName || d.account}</span>
                {isAdmin && d.mrr ? <span className="text-emerald-600 tabular-nums">{formatINR(d.mrr)}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hiring Plan (TBH placeholders) */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Prioritised hiring plan</h4>
        {tbhPeople.length === 0 ? (
          <p className="text-xs text-muted-foreground">No open TBH roles. Add a TBH placeholder from the People tab to plan a new hire.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Designation</th>
                  <th className="px-3 py-2 font-medium">Region</th>
                  <th className="px-3 py-2 font-medium">Reporting Manager</th>
                  <th className="px-3 py-2 font-medium">VSD / Pod</th>
                </tr>
              </thead>
              <tbody>
                {tbhPeople.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground text-xs">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{p.designation || p.roleTitle}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{p.region}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{p.reportingManager || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{p.pod || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">Edit TBH placeholders from the People tab.</p>
      </div>
    </div>
  );
}

function Card({ title, tone, children }: { title: string; tone: "destructive" | "info"; children: React.ReactNode }) {
  const klass = tone === "destructive"
    ? "border-destructive/30 bg-destructive/5"
    : "border-sky-500/30 bg-sky-500/5";
  const titleClass = tone === "destructive" ? "text-destructive" : "text-sky-600";
  return (
    <div className={cn("border rounded-sm p-4", klass)}>
      <div className={cn("text-xs font-medium uppercase tracking-wide mb-3", titleClass)}>{title}</div>
      {children}
    </div>
  );
}