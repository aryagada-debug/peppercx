import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Download, Search, CheckCircle2, Clock, AlertTriangle, Eye, X, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRgyWeeklyCompliance, type ComplianceRow } from "@/hooks/useRgyWeeklyCompliance";
import { weekRange, shiftWeek, statusLabel, statusToneClass, type ComplianceStatus } from "@/lib/rgyCompliance";
import { logRGYReviewedNoChange } from "@/lib/rgyHistory";

type SegmentKind =
  | "none"
  | "all"
  | "compliant"
  | "partial"
  | "missing"
  | "reviewed"
  | "vsd-person"
  | "bopm-person";

interface Segment {
  kind: SegmentKind;
  vsd?: string;
  bopm?: string;
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
    // VSD aggregation: total deals and pending count per VSD
    const vsdStats = new Map<string, { total: number; pending: number }>();
    // BOPM aggregation by person (split principal_bopm + senior_bopm)
    const bopmStats = new Map<string, { total: number; updated: number }>();
    for (const r of rows) {
      const s = rowState(r);
      if (s === "compliant") compliant++;
      else if (s === "partial") partial++;
      else missing++;
      if (r.vsdStatus === "reviewed" || r.bopmStatus === "reviewed") reviewed++;

      if (r.vsd) {
        const v = vsdStats.get(r.vsd) || { total: 0, pending: 0 };
        v.total++;
        if (r.vsdStatus === "pending") v.pending++;
        vsdStats.set(r.vsd, v);
      }

      // BOPM names live in r.bopm as a comma-separated list
      const bopmNames = r.bopm
        ? r.bopm.split(",").map(s => s.trim()).filter(Boolean)
        : [];
      const bopmUpdatedThisDeal = r.bopmStatus !== "pending";
      for (const name of bopmNames) {
        const b = bopmStats.get(name) || { total: 0, updated: 0 };
        b.total++;
        if (bopmUpdatedThisDeal) b.updated++;
        bopmStats.set(name, b);
      }
    }
    const total = rows.length;
    const vsdPending = Array.from(vsdStats.entries())
      .filter(([, v]) => v.pending > 0)
      .map(([vsd, v]) => ({
        vsd,
        pending: v.pending,
        total: v.total,
        rate: v.total ? (v.total - v.pending) / v.total : 0,
      }))
      .sort((a, b) => b.pending - a.pending || a.rate - b.rate)
      .slice(0, 6);
    const bopmCompliance = Array.from(bopmStats.entries())
      .filter(([, v]) => v.total >= 1)
      .map(([bopm, v]) => ({
        bopm,
        total: v.total,
        updated: v.updated,
        rate: v.total ? v.updated / v.total : 0,
      }))
      .sort((a, b) => a.rate - b.rate || b.total - a.total)
      .slice(0, 6);
    return {
      total, compliant, partial, missing, reviewed,
      complianceRate: total ? compliant / total : 0,
      vsdPending, bopmCompliance,
    };
  }, [rows]);

  // ── Deals not updated the longest (all-time across active deals) ──
  const [staleDeals, setStaleDeals] = useState<{ dealId: string; lastAt: string | null }[]>([]);
  useEffect(() => {
    if (rows.length === 0) { setStaleDeals([]); return; }
    let cancelled = false;
    (async () => {
      const dealIds = rows.map(r => r.dealId);
      // Fetch most recent note per deal (excluding sentinel review rows? keep them — they count as activity)
      const { data } = await supabase
        .from("deal_rgy_notes")
        .select("deal_id, created_at")
        .in("deal_id", dealIds)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (cancelled) return;
      const lastByDeal = new Map<string, string>();
      for (const n of (data || []) as { deal_id: string; created_at: string }[]) {
        if (!lastByDeal.has(n.deal_id)) lastByDeal.set(n.deal_id, n.created_at);
      }
      const merged = rows.map(r => ({
        dealId: r.dealId,
        lastAt: lastByDeal.get(r.dealId) || null,
      }));
      merged.sort((a, b) => {
        if (!a.lastAt && !b.lastAt) return 0;
        if (!a.lastAt) return -1;
        if (!b.lastAt) return 1;
        return a.lastAt.localeCompare(b.lastAt);
      });
      setStaleDeals(merged.slice(0, 6));
    })();
    return () => { cancelled = true; };
  }, [rows]);

  const rowById = useMemo(() => {
    const m = new Map<string, ComplianceRow>();
    rows.forEach(r => m.set(r.dealId, r));
    return m;
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

      {/* Offender lists */}
      {(insights.vsdPending.length > 0 || insights.bopmCompliance.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.vsdPending.length > 0 && (
            <OffenderList
              title="VSDs with pending deals"
              items={insights.vsdPending.map(o => ({
                key: o.vsd,
                label: o.vsd,
                badge: `${o.pending} pending · ${Math.round(o.rate * 100)}% compliant`,
                onClick: () => openSegment({ kind: "vsd-person", vsd: o.vsd }),
              }))}
            />
          )}
          {insights.bopmCompliance.length > 0 && (
            <OffenderList
              title="P / Sr BOPMs by compliance %"
              items={insights.bopmCompliance.map(b => ({
                key: b.bopm,
                label: b.bopm,
                badge: `${Math.round(b.rate * 100)}% · ${b.updated}/${b.total} deals`,
                onClick: () => openSegment({ kind: "bopm-person", bopm: b.bopm }),
              }))}
            />
          )}
        </div>
      )}

      {/* Deals not updated the longest */}
      {staleDeals.length > 0 && (
        <div className="border border-border rounded-lg bg-card">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Deals not updated the longest</div>
            <button
              className="text-[11px] text-primary hover:underline"
              onClick={() => openSegment({ kind: "stale", staleIds: new Set(staleDeals.map(s => s.dealId)) })}
            >
              View all in drill-down
            </button>
          </div>
          <div className="divide-y divide-border">
            {staleDeals.map(s => {
              const r = rowById.get(s.dealId);
              const age = s.lastAt ? formatDistanceToNowStrict(new Date(s.lastAt), { addSuffix: false }) : "Never updated";
              return (
                <div key={s.dealId} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/30">
                  <div className="min-w-0 flex-1">
                    <Link to={`/deals/${s.dealId}`} className="font-medium text-primary hover:underline truncate block">
                      {r?.account || s.dealId}
                    </Link>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {r?.dealName} · VSD: {r?.vsd || "—"}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    "font-normal text-[10px] gap-1 shrink-0",
                    !s.lastAt || (Date.now() - new Date(s.lastAt).getTime()) / (1000 * 60 * 60 * 24) > 14
                      ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  )}>
                    <Clock className="h-3 w-3" />
                    {age === "Never updated" ? "Never" : `${age} ago`}
                  </Badge>
                </div>
              );
            })}
          </div>
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