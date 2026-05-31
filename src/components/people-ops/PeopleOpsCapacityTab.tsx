import { useMemo, useState } from "react";
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

const ROLE_FILTERS: { key: string; label: string; match: (p: Person) => boolean }[] = [
  { key: "all", label: "All Roles", match: () => true },
  { key: "senior_bopm", label: "Senior BOPM", match: (p) => p.designation === "Senior BOPM" },
  { key: "vsd", label: "VSD", match: (p) => p.designation === "VSD" },
  { key: "seo_growth_lead", label: "SEO Growth Lead", match: (p) => p.designation === "SEO Growth Lead" },
  { key: "content_lead", label: "Content Lead", match: (p) => p.designation === "Content Lead" },
  {
    key: "cap_leader",
    label: "Capability Leader",
    match: (p) => p.designation === "SEO Capability Leader" || p.designation === "Content Capability Leader",
  },
];

export function PeopleOpsCapacityTab({ people, assignments, deals, capacityRoster, isAdmin }: Props) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [vsdFilter, setVsdFilter] = useState("all");
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
        const splits: { dealId: string; dealName: string; pct: number; mrrContribution: number; region?: string; vsd?: string }[] = [];
        for (const a of assignments) {
          if (a.personId !== p.id) continue;
          if (!activeDealIds.has(a.dealId) || isAssignmentExpired(a)) continue;
          const pct = a.allocationPct || 0;
          bwPct += pct;
          const d = dealById.get(a.dealId);
          const dealMrr = d?.mrr || 0;
          const mrrContribution = (dealMrr * pct) / 100;
          mrrActual += mrrContribution;
          if (d) splits.push({ dealId: d.id, dealName: d.dealName || d.account, pct, mrrContribution, vsd: d.vsd });
        }
        splits.sort((a, b) => b.pct - a.pct);
        const capacity = getPersonRevenueCapacity(p, capacityRoster);
        const fillPct = capacity > 0 ? (mrrActual / capacity) * 100 : null;
        return { person: p, bwPct, dealCount: splits.length, mrrActual, capacity, fillPct, splits };
      });
  }, [people, assignments, dealById, activeDealIds, capacityRoster]);

  const buckets = useMemo(() => {
    const out = { overloaded: 0, nearFull: 0, healthy: 0, under: 0 };
    for (const r of rows) {
      if (r.dealCount === 0 && r.bwPct === 0) continue;
      out[bucketOf(r.bwPct)]++;
    }
    return out;
  }, [rows]);

  const leadOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const p of people) {
      const mgr = (p.reportingManager || "").trim();
      if (mgr) set.set(mgr.toLowerCase(), mgr);
    }
    return Array.from(set.values()).sort();
  }, [people]);

  const vsdOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) {
      if (d.vsd) set.add(d.vsd);
    }
    return Array.from(set).sort();
  }, [deals]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const def = ROLE_FILTERS.find((rf) => rf.key === roleFilter) || ROLE_FILTERS[0];
      if (!def.match(r.person)) return false;
      if (leadFilter !== "all" && (r.person.reportingManager || "").toLowerCase() !== leadFilter) return false;
      if (vsdFilter !== "all" && !r.splits.some((s) => (s.vsd || "") === vsdFilter)) return false;
      // Drop people with no allocation entirely when the user is browsing All Roles to mirror the reference layout.
      if (roleFilter === "all" && r.dealCount === 0) return false;
      return true;
    });
  }, [rows, roleFilter, leadFilter, vsdFilter]);

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
        <div className="flex flex-wrap gap-1">
          {ROLE_FILTERS.map((rf) => (
            <button
              key={rf.key}
              onClick={() => setRoleFilter(rf.key)}
              className={cn(
                "px-3 py-1 text-xs rounded-sm border transition-colors",
                roleFilter === rf.key
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-transparent border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {rf.label}
            </button>
          ))}
        </div>
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
              <th className="px-3 py-2 font-medium text-right">MRR Fill %</th>
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
              const fillColor = fillBucket ? BUCKET_COLOR[fillBucket as Bucket].text : "text-muted-foreground";
              const isOpen = expanded === r.person.id;
              return (
                <>
                  <tr
                    key={r.person.id}
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
                    <td className={cn("px-3 py-2 text-right tabular-nums text-xs font-medium", fillColor)}>
                      {r.fillPct == null ? "—" : `${Math.round(r.fillPct)}%`}
                    </td>
                  </tr>
                  {isOpen && r.splits.map((s) => (
                    <tr key={`${r.person.id}-${s.dealId}`} className="border-t border-border/50 bg-muted/10">
                      <td></td>
                      <td className="px-3 py-1.5 pl-8 text-xs text-foreground">{s.dealName}</td>
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
                </>
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
                  <th className="px-3 py-2 font-medium text-right">Fill %</th>
                </tr>
              </thead>
              <tbody>
                {vsdRollup.map((v) => {
                  const avg = v.people ? v.bwSum / v.people : 0;
                  const fill = v.capacity > 0 ? (v.mrr / v.capacity) * 100 : null;
                  const fillBucket = fill == null ? null : fill >= 100 ? "healthy" : fill >= 60 ? "nearFull" : "overloaded";
                  const fillColor = fillBucket ? BUCKET_COLOR[fillBucket as Bucket].text : "text-muted-foreground";
                  return (
                    <tr key={v.vsd} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{v.vsd}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{v.people}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{Math.round(avg)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatINR(v.mrr)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {v.capacity > 0 ? formatINR(v.capacity) : "—"}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums text-xs font-medium", fillColor)}>
                        {fill == null ? "—" : `${Math.round(fill)}%`}
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