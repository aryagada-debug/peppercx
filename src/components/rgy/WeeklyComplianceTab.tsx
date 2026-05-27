import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Download, Search, CheckCircle2, Clock, AlertTriangle, Eye, X, ChevronDown } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRgyWeeklyCompliance, type ComplianceRow } from "@/hooks/useRgyWeeklyCompliance";
import { weekRange, shiftWeek, statusLabel, statusToneClass, type ComplianceStatus } from "@/lib/rgyCompliance";
import { logRGYReviewedNoChange } from "@/lib/rgyHistory";
import { supabase } from "@/integrations/supabase/client";

type SegmentKind =
  | "none"
  | "all"
  | "compliant"
  | "partial"
  | "missing"
  | "reviewed"
  | "vsd-person"
  | "bopm-person"
  | "stale";

interface Segment {
  kind: SegmentKind;
  vsd?: string;
  bopm?: string;
  staleIds?: Set<string>;
}

function rowState(r: ComplianceRow): "compliant" | "partial" | "missing" {
  const vsdOk = r.vsdStatus !== "pending";
  const bopmOk = r.bopmStatus !== "pending";
  if (vsdOk && bopmOk) return "compliant";
  if (vsdOk || bopmOk) return "partial";
  return "missing";
}

function matchesSegment(r: ComplianceRow, seg: Segment): boolean {
  switch (seg.kind) {
    case "none": return false;
    case "all": return true;
    case "compliant":
    case "partial":
    case "missing":
      return rowState(r) === seg.kind;
    case "reviewed":
      return r.vsdStatus === "reviewed" || r.bopmStatus === "reviewed";
    case "vsd-person": return !!seg.vsd && r.vsd === seg.vsd;
    case "bopm-person": {
      if (!seg.bopm) return false;
      const t = seg.bopm.trim().toLowerCase();
      return r.bopm.toLowerCase().split(",").map(s => s.trim()).includes(t);
    }
    case "stale": return !!seg.staleIds && seg.staleIds.has(r.dealId);
    default: return false;
  }
}

function segmentLabel(seg: Segment): string {
  switch (seg.kind) {
    case "all": return "All active deals";
    case "compliant": return "Fully compliant";
    case "partial": return "Partial compliance";
    case "missing": return "Not updated";
    case "reviewed": return "Reviewed — no change";
    case "vsd-person": return `VSD: ${seg.vsd}`;
    case "bopm-person": return `BOPM: ${seg.bopm}`;
    case "stale": return "Longest without update";
    default: return "";
  }
}

function StatusPill({ s }: { s: ComplianceStatus }) {
  const Icon = s === "updated" ? CheckCircle2 : s === "reviewed" ? Eye : Clock;
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", statusToneClass(s))}>
      <Icon className="h-3 w-3" />
      {statusLabel(s)}
    </Badge>
  );
}

export function WeeklyComplianceTab() {
  const [weekStart, setWeekStart] = useState(() => weekRange().start);
  const { rows, loading } = useRgyWeeklyCompliance(weekStart);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>({ kind: "none" });
  const drillRef = useRef<HTMLDivElement | null>(null);

  const insights = useMemo(() => {
    let compliant = 0, partial = 0, missing = 0, reviewed = 0;
    let vsdUpdated = 0, bopmUpdated = 0;
    const vsdPending = new Map<string, number>();
    const podStats = new Map<string, { total: number; compliant: number }>();
    for (const r of rows) {
      const s = rowState(r);
      if (s === "compliant") compliant++;
      else if (s === "partial") partial++;
      else missing++;
      if (r.vsdStatus === "reviewed" || r.bopmStatus === "reviewed") reviewed++;
      if (r.vsdStatus !== "pending") vsdUpdated++;
      else if (r.vsd) vsdPending.set(r.vsd, (vsdPending.get(r.vsd) || 0) + 1);
      if (r.bopmStatus !== "pending") bopmUpdated++;
      const pod = r.pod || "Unassigned";
      const ps = podStats.get(pod) || { total: 0, compliant: 0 };
      ps.total++;
      if (s === "compliant") ps.compliant++;
      podStats.set(pod, ps);
    }
    const total = rows.length;
    const topOffenders = Array.from(vsdPending.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([vsd, count]) => ({ vsd, count }));
    const worstPods = Array.from(podStats.entries())
      .filter(([, v]) => v.total >= 2)
      .map(([pod, v]) => ({ pod, total: v.total, rate: v.total ? v.compliant / v.total : 0 }))
      .sort((a, b) => a.rate - b.rate).slice(0, 5);
    return {
      total, compliant, partial, missing, reviewed,
      vsdUpdated, vsdPending: total - vsdUpdated,
      bopmUpdated, bopmPending: total - bopmUpdated,
      complianceRate: total ? compliant / total : 0,
      topOffenders, worstPods,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (segment.kind === "none") return [] as ComplianceRow[];
    return rows.filter(r => {
      if (!matchesSegment(r, segment)) return false;
      if (q && !(`${r.dealId} ${r.account} ${r.dealName} ${r.vsd} ${r.bopm}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, search, segment]);

  const openSegment = (seg: Segment) => {
    setSegment(seg);
    setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const weekEnd = new Date(weekStart + "T00:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const isCurrentWeek = weekStart === weekRange().start;

  const handleMarkReviewed = async (dealId: string) => {
    await logRGYReviewedNoChange({ dealId, weekStart });
    toast.success("Marked as reviewed — no change");
  };

  const exportCsv = () => {
    const data = segment.kind === "none" ? rows : filtered;
    const headers = ["Deal ID","Account","Deal","Pod","VSD","BOPM","VSD Status","VSD Updated By","VSD Updated At","BOPM Status","BOPM Updated By","BOPM Updated At"];
    const lines = [headers.join(",")];
    for (const r of data) {
      lines.push([
        r.dealId, r.account, r.dealName, r.pod, r.vsd, r.bopm,
        statusLabel(r.vsdStatus), r.vsdLastBy, r.vsdLastAt || "",
        statusLabel(r.bopmStatus), r.bopmLastBy, r.bopmLastAt || "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rgy-compliance-${weekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Week selector + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart(shiftWeek(weekStart, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium px-2">
            Week of {format(new Date(weekStart + "T00:00:00Z"), "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
            {isCurrentWeek && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">(current)</span>}
          </div>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart(shiftWeek(weekStart, 1))} disabled={isCurrentWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setWeekStart(weekRange().start)}>
              Jump to current
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export {segment.kind === "none" ? "all" : "segment"}
        </Button>
      </div>

      {/* Headline insights */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InsightCard
            label="Compliance rate"
            value={`${Math.round(insights.complianceRate * 100)}%`}
            sub={`${insights.compliant} of ${insights.total} deals updated by both VSD and BOPM`}
            tone="positive"
            progress={insights.complianceRate}
            onClick={() => openSegment({ kind: "compliant" })}
            active={segment.kind === "compliant"}
          />
          <InsightCard
            label="At-risk deals"
            value={String(insights.missing)}
            sub={insights.missing === 0 ? "Every active deal has activity this week" : "No VSD or BOPM activity yet this week"}
            tone={insights.missing > 0 ? "destructive" : "muted"}
            onClick={() => openSegment({ kind: "missing" })}
            active={segment.kind === "missing"}
          />
          <InsightCard
            label="Reviewed — no change"
            value={String(insights.reviewed)}
            sub="Intentionally left unchanged this week"
            tone="info"
            onClick={() => openSegment({ kind: "reviewed" })}
            active={segment.kind === "reviewed"}
          />
        </div>
      )}

      {/* Breakdown strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <BreakdownTile label="VSD updated" count={insights.vsdUpdated} total={insights.total} tone="positive"
          onClick={() => openSegment({ kind: "vsd-updated" })} active={segment.kind === "vsd-updated"} />
        <BreakdownTile label="VSD pending" count={insights.vsdPending} total={insights.total} tone="warning"
          onClick={() => openSegment({ kind: "vsd-pending" })} active={segment.kind === "vsd-pending"} />
        <BreakdownTile label="BOPM updated" count={insights.bopmUpdated} total={insights.total} tone="positive"
          onClick={() => openSegment({ kind: "bopm-updated" })} active={segment.kind === "bopm-updated"} />
        <BreakdownTile label="BOPM pending" count={insights.bopmPending} total={insights.total} tone="warning"
          onClick={() => openSegment({ kind: "bopm-pending" })} active={segment.kind === "bopm-pending"} />
      </div>

      {/* Top offenders */}
      {(insights.topOffenders.length > 0 || insights.worstPods.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.topOffenders.length > 0 && (
            <OffenderList
              title="VSDs with most pending deals"
              items={insights.topOffenders.map(o => ({
                key: o.vsd,
                label: o.vsd,
                badge: `${o.count} pending`,
                onClick: () => openSegment({ kind: "vsd-person", vsd: o.vsd }),
              }))}
            />
          )}
          {insights.worstPods.length > 0 && (
            <OffenderList
              title="Pods with lowest compliance"
              items={insights.worstPods.map(p => ({
                key: p.pod,
                label: p.pod || "Unassigned",
                badge: `${Math.round(p.rate * 100)}% · ${p.total} deals`,
                onClick: () => openSegment({ kind: "pod", pod: p.pod }),
              }))}
            />
          )}
        </div>
      )}

      {/* Drill-down panel */}
      <div ref={drillRef} className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">Drill-down:</span>
            {segment.kind === "none" ? (
              <span className="text-muted-foreground italic">No segment selected</span>
            ) : (
              <>
                <Badge variant="secondary" className="gap-1 font-normal">
                  {segmentLabel(segment)}
                  <button onClick={() => setSegment({ kind: "none" })} className="ml-0.5 hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
                <span className="text-muted-foreground">· {filtered.length} deal{filtered.length === 1 ? "" : "s"}</span>
              </>
            )}
          </div>
          {segment.kind !== "none" && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openSegment({ kind: "all" })}>
              Show all
            </Button>
          )}
        </div>

        {segment.kind === "none" ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            <ChevronDown className="h-5 w-5 mx-auto mb-2 opacity-50" />
            Click a metric above to see the deals behind it.
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-border">
              <div className="relative max-w-sm">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search within segment" className="h-8 pl-7 text-xs" />
              </div>
            </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Deal</th>
                <th className="px-3 py-2">VSD</th>
                <th className="px-3 py-2">VSD Status</th>
                <th className="px-3 py-2">BOPM</th>
                <th className="px-3 py-2">BOPM Status</th>
                <th className="px-3 py-2">Last Activity</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td colSpan={7} className="px-3 py-2"><Skeleton className="h-6 w-full" /></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No deals match the current filters.</td></tr>
              )}
              {!loading && filtered.map(r => {
                const lastAt = [r.vsdLastAt, r.bopmLastAt].filter(Boolean).sort().pop();
                return (
                  <tr key={r.dealId} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-3 py-2 align-top">
                      <Link to={`/deals/${r.dealId}`} className="font-medium text-primary hover:underline">{r.account || r.dealId}</Link>
                      <div className="text-[10px] text-muted-foreground">{r.dealName} · {r.dealId}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{r.vsd || "—"}</td>
                    <td className="px-3 py-2 align-top">
                      <StatusPill s={r.vsdStatus} />
                      {r.vsdLastBy && <div className="text-[10px] text-muted-foreground mt-1">by {r.vsdLastBy}</div>}
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{r.bopm || "—"}</td>
                    <td className="px-3 py-2 align-top">
                      <StatusPill s={r.bopmStatus} />
                      {r.bopmLastBy && <div className="text-[10px] text-muted-foreground mt-1">by {r.bopmLastBy}</div>}
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">
                      {lastAt ? format(new Date(lastAt), "MMM d, HH:mm") : <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" />No activity</span>}
                      {r.otherEditors.length > 0 && (
                        <div className="text-[10px]">+ {r.otherEditors.length} other editor{r.otherEditors.length > 1 ? "s" : ""}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      {isCurrentWeek && (
                        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => handleMarkReviewed(r.dealId)}>
                          Mark reviewed
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

function toneText(tone?: "positive" | "warning" | "destructive" | "info" | "muted") {
  return tone === "positive" ? "text-emerald-700 dark:text-emerald-400"
    : tone === "warning" ? "text-amber-700 dark:text-amber-400"
    : tone === "destructive" ? "text-red-700 dark:text-red-400"
    : tone === "info" ? "text-blue-700 dark:text-blue-400"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
}

function toneBar(tone?: "positive" | "warning" | "destructive" | "info" | "muted") {
  return tone === "positive" ? "bg-emerald-500"
    : tone === "warning" ? "bg-amber-500"
    : tone === "destructive" ? "bg-red-500"
    : tone === "info" ? "bg-blue-500"
    : "bg-muted-foreground";
}

function InsightCard({ label, value, sub, tone, progress, onClick, active }: {
  label: string; value: string; sub: string;
  tone?: "positive" | "warning" | "destructive" | "info" | "muted";
  progress?: number; onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left border rounded-lg p-4 bg-card hover:bg-secondary/30 transition-colors",
        active ? "border-primary ring-1 ring-primary/30" : "border-border"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-3xl font-medium mt-1", toneText(tone))}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className={cn("h-full transition-all", toneBar(tone))} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </button>
  );
}

function BreakdownTile({ label, count, total, tone, onClick, active }: {
  label: string; count: number; total: number;
  tone?: "positive" | "warning" | "destructive" | "info" | "muted";
  onClick?: () => void; active?: boolean;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left border rounded-lg p-3 bg-card hover:bg-secondary/30 transition-colors",
        active ? "border-primary ring-1 ring-primary/30" : "border-border"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className={cn("text-lg font-medium", toneText(tone))}>{count}</span>
        <span className="text-[10px] text-muted-foreground">/ {total} · {pct}%</span>
      </div>
    </button>
  );
}

function OffenderList({ title, items }: {
  title: string;
  items: { key: string; label: string; badge: string; onClick: () => void }[];
}) {
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="px-3 py-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="divide-y divide-border">
        {items.map(it => (
          <button key={it.key} onClick={it.onClick}
            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/30 transition-colors text-left">
            <span className="truncate font-medium">{it.label}</span>
            <Badge variant="outline" className="font-normal text-[10px]">{it.badge}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}