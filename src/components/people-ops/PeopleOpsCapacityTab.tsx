import { Fragment, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";
import { ACTIVE_DEAL_STATUSES, isAssignmentExpired } from "@/data/staffingData";
import { getPersonRevenueCapacity } from "@/lib/revenueCapacity";
import { formatINR } from "@/lib/csvTargets";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  people: Person[];
  assignments: StaffingAssignment[];
  deals: Deal[];
  /** Full active people roster, used for VSD/Cap-leader capacity sums even when the viewer's scope is narrower. */
  capacityRoster: Person[];
  isAdmin: boolean;
}

type Bucket = "overloaded" | "nearFull" | "healthy" | "under";
function bucketOf(pct: number): Bucket {
  if (pct > 100) return "overloaded";
  if (pct >= 85) return "nearFull";
  if (pct >= 30) return "healthy";
  return "under";
}

const BUCKET_COLOR: Record<Bucket, { text: string; bar: string; bg: string; ring: string }> = {
  overloaded: { text: "text-destructive", bar: "bg-destructive", bg: "bg-destructive/10", ring: "border-destructive/30" },
  nearFull:   { text: "text-amber-600",   bar: "bg-amber-500",   bg: "bg-amber-500/10",   ring: "border-amber-500/30" },
  healthy:    { text: "text-emerald-600", bar: "bg-emerald-500", bg: "bg-emerald-500/10", ring: "border-emerald-500/30" },
  under:      { text: "text-sky-600",     bar: "bg-sky-500",     bg: "bg-sky-500/10",     ring: "border-sky-500/30" },
};

export function PeopleOpsCapacityTab({ people, assignments, deals, capacityRoster, isAdmin }: Props) {
  const [deptFilter, setDeptFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [vsdFilter, setVsdFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeDealIds = useMemo(
    () => new Set(deals.filter((d) => ACTIVE_DEAL_STATUSES.has(d.dealStatus)).map((d) => d.id)),
    [deals],
  );
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);

  const rows = useMemo(() => {
    return people
      .filter((p) => !p.tbh)
      .map((p) => {
        let bwPct = 0;
        let mrrActual = 0;
        const splits: { dealId: string; dealName: string; account: string; pct: number; mrrContribution: number; region?: string; vsd?: string }[] = [];
        const countedDeals = new Set<string>();
        for (const a of assignments) {
          if (a.personId !== p.id) continue;
          if (!activeDealIds.has(a.dealId) || isAssignmentExpired(a)) continue;
          const pct = a.allocationPct || 0;
          bwPct += pct;
          const d = dealById.get(a.dealId);
          const dealMrr = d?.mrr || 0;
          // Actual MRR = sum of full deal MRR for every deal the person is tagged into
          // (no allocation-% weighting). Dedupe in case of multiple role rows on the same deal.
          if (d && !countedDeals.has(d.id)) {
            mrrActual += dealMrr;
            countedDeals.add(d.id);
          }
          if (d) splits.push({ dealId: d.id, dealName: d.dealName || d.account, account: d.account, pct, mrrContribution: dealMrr, vsd: d.vsd });
        }
        splits.sort((a, b) => b.pct - a.pct);
        const capacity = getPersonRevenueCapacity(p, capacityRoster);
        const fillPct = capacity > 0 ? (mrrActual / capacity) * 100 : null;
        return { person: p, bwPct, dealCount: splits.length, mrrActual, capacity, fillPct, splits };
      });
  }, [people, assignments, dealById, activeDealIds, capacityRoster]);

  const leadOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const p of people) {
      const mgr = (p.reportingManager || "").trim();
      if (mgr) set.set(mgr.toLowerCase(), mgr);
    }
    return Array.from(set.values()).sort();
  }, [people]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      const d = (p.department || "").trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [people]);

  const roleTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      if (deptFilter !== "all" && (p.department || "") !== deptFilter) continue;
      const r = (p.designation || p.roleTitle || "").trim();
      if (r) set.add(r);
    }
    return Array.from(set).sort();
  }, [people, deptFilter]);

  const vsdOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) {
      if (d.vsd) set.add(d.vsd);
    }
    return Array.from(set).sort();
  }, [deals]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      const r = (p.region || "").trim();
      if (r) set.add(r);
    }
    return Array.from(set).sort();
  }, [people]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (deptFilter !== "all" && (r.person.department || "") !== deptFilter) return false;
      if (roleFilter !== "all" && (r.person.designation || r.person.roleTitle || "") !== roleFilter) return false;
      if (leadFilter !== "all" && (r.person.reportingManager || "").toLowerCase() !== leadFilter) return false;
      if (vsdFilter !== "all" && !r.splits.some((s) => (s.vsd || "") === vsdFilter)) return false;
      if (regionFilter !== "all" && (r.person.region || "") !== regionFilter) return false;
      // When no role/department filter is set, hide people with no allocation to mirror the reference layout.
      if (roleFilter === "all" && deptFilter === "all" && r.dealCount === 0) return false;
      return true;
    });
  }, [rows, deptFilter, roleFilter, leadFilter, vsdFilter, regionFilter]);

  const buckets = useMemo(() => {
    const out = { overloaded: 0, nearFull: 0, healthy: 0, under: 0 };
    for (const r of filtered) {
      if (r.dealCount === 0 && r.bwPct === 0) continue;
      out[bucketOf(r.bwPct)]++;
    }
    return out;
  }, [filtered]);

  const vsdRollup = useMemo(() => {
    const map = new Map<string, { vsd: string; people: number; bwSum: number; mrr: number; capacity: number }>();
    for (const r of rows) {
      const key = r.person.pod || "Unassigned";
      const cur = map.get(key) || { vsd: key, people: 0, bwSum: 0, mrr: 0, capacity: 0 };
      cur.people++;
      cur.bwSum += r.bwPct;
      cur.mrr += r.mrrActual;
      cur.capacity += r.capacity;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.capacity - a.capacity);
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SumCard label="> 100% Overloaded" count={buckets.overloaded} bucket="overloaded" />
        <SumCard label="85–100% Near Full" count={buckets.nearFull} bucket="nearFull" />
        <SumCard label="30–85% Healthy" count={buckets.healthy} bucket="healthy" />
        <SumCard label="< 30% Under-utilised" count={buckets.under} bucket="under" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">Department:</label>
        <select
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setRoleFilter("all"); }}
          className="text-xs bg-background border border-border rounded-sm px-2 py-1"
        >
          <option value="all">All Departments</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">Role Type:</label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-xs bg-background border border-border rounded-sm px-2 py-1"
        >
          <option value="all">All Role Types</option>
          {roleTypeOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="h-5 w-px bg-border mx-1" />
        <label className="text-xs text-muted-foreground">Lead:</label>
        <select
          value={leadFilter}
          onChange={(e) => setLeadFilter(e.target.value)}
          className="text-xs bg-background border border-border rounded-sm px-2 py-1"
        >
          <option value="all">All Leads</option>
          {leadOptions.map((m) => (
            <option key={m} value={m.toLowerCase()}>{m}</option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">Region:</label>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="text-xs bg-background border border-border rounded-sm px-2 py-1"
        >
          <option value="all">All Regions</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {isAdmin && (
          <>
            <label className="text-xs text-muted-foreground">VSD:</label>
            <select
              value={vsdFilter}
              onChange={(e) => setVsdFilter(e.target.value)}
              className="text-xs bg-background border border-border rounded-sm px-2 py-1"
            >
              <option value="all">All VSD</option>
              {vsdOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {rows.length} people
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Designation</th>
              <th className="px-3 py-2 font-medium">Region</th>
              <th className="px-3 py-2 font-medium">Manager</th>
              <th className="px-3 py-2 font-medium">BW Used</th>
              <th className="px-3 py-2 font-medium text-right"># Deals</th>
              <th className="px-3 py-2 font-medium text-right">MRR (Actual)</th>
              <th className="px-3 py-2 font-medium text-right">MRR Capacity</th>
              <th className="px-3 py-2 font-medium text-right">Revenue Utilisation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No people match these filters.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const b = BUCKET_COLOR[bucketOf(r.bwPct)];
              const fillBucket = r.fillPct == null ? null : r.fillPct >= 100 ? "healthy" : r.fillPct >= 60 ? "nearFull" : "overloaded";
              const fillStyle = fillBucket ? BUCKET_COLOR[fillBucket as Bucket] : null;
              const isOpen = expanded === r.person.id;
              return (
                <Fragment key={r.person.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.person.id)}
                    className="border-t border-border cursor-pointer hover:bg-muted/30"
                  >
                    <td className="px-2 py-2 text-muted-foreground">
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-foreground">{r.person.name}</span>
                      {r.person.leaving && <Badge variant="destructive" className="ml-2 text-[10px]">LEAVING</Badge>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.person.designation || r.person.roleTitle}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.person.region}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.person.reportingManager || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", b.bar)} style={{ width: `${Math.min(r.bwPct, 100)}%` }} />
                        </div>
                        <span className={cn("text-xs font-medium tabular-nums", b.text)}>{Math.round(r.bwPct)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{r.dealCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatINR(r.mrrActual)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                      {r.capacity > 0 ? formatINR(r.capacity) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.fillPct == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="inline-flex items-center gap-2 justify-end">
                          <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", fillStyle?.bar)}
                              style={{ width: `${Math.min(r.fillPct, 100)}%` }}
                            />
                          </div>
                          <span className={cn("text-xs font-medium tabular-nums", fillStyle?.text)}>
                            {Math.round(r.fillPct)}%
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                  {isOpen && r.splits.map((s) => (
                    <tr key={`${r.person.id}-${s.dealId}`} className="border-t border-border/50 bg-muted/10">
                      <td></td>
                      <td className="px-3 py-1.5 pl-8 text-xs text-foreground">
                        <span>{s.account}</span>
                        {s.dealName && s.dealName !== s.account && (
                          <span className="text-muted-foreground"> — {s.dealName}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-[10px] text-muted-foreground" colSpan={3}>
                        {s.vsd ? `VSD: ${s.vsd}` : ""}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-xs text-primary tabular-nums">{Math.round(s.pct)}%</span>
                      </td>
                      <td></td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{formatINR(s.mrrContribution)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* VSD-level rollup */}
      {vsdRollup.length > 0 && (
        <div>
          <h3 className="text-base font-medium text-foreground mb-3">VSD-Level Capacity</h3>
          <div className="overflow-x-auto border border-border rounded-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">VSD / Pod</th>
                  <th className="px-3 py-2 font-medium text-right">People</th>
                  <th className="px-3 py-2 font-medium text-right">Avg BW</th>
                  <th className="px-3 py-2 font-medium text-right">MRR (Actual)</th>
                  <th className="px-3 py-2 font-medium text-right">MRR Capacity</th>
                  <th className="px-3 py-2 font-medium text-right">Revenue Util.</th>
                </tr>
              </thead>
              <tbody>
                {vsdRollup.map((v) => {
                  const avg = v.people ? v.bwSum / v.people : 0;
                  const fill = v.capacity > 0 ? (v.mrr / v.capacity) * 100 : null;
                  const fillBucket = fill == null ? null : fill >= 100 ? "healthy" : fill >= 60 ? "nearFull" : "overloaded";
                  const fillStyle = fillBucket ? BUCKET_COLOR[fillBucket as Bucket] : null;
                  return (
                    <tr key={v.vsd} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{v.vsd}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{v.people}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{Math.round(avg)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatINR(v.mrr)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {v.capacity > 0 ? formatINR(v.capacity) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {fill == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="inline-flex items-center gap-2 justify-end">
                            <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", fillStyle?.bar)}
                                style={{ width: `${Math.min(fill, 100)}%` }}
                              />
                            </div>
                            <span className={cn("text-xs font-medium tabular-nums", fillStyle?.text)}>
                              {Math.round(fill)}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SumCard({ label, count, bucket }: { label: string; count: number; bucket: Bucket }) {
  const c = BUCKET_COLOR[bucket];
  return (
    <div className={cn("rounded-sm border px-4 py-3", c.ring, c.bg)}>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium", c.text)}>{label}</span>
        <span className={cn("text-2xl font-medium tabular-nums", c.text)}>{count}</span>
      </div>
    </div>
  );
}