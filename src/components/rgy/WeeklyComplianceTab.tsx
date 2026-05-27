import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Download, Search, CheckCircle2, Clock, AlertTriangle, Eye, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRgyWeeklyCompliance, type ComplianceRow } from "@/hooks/useRgyWeeklyCompliance";
import { weekRange, shiftWeek, statusLabel, statusToneClass, type ComplianceStatus } from "@/lib/rgyCompliance";
import { logRGYReviewedNoChange } from "@/lib/rgyHistory";

function rowState(r: ComplianceRow): "compliant" | "partial" | "missing" {
  const vsdOk = r.vsdStatus !== "pending";
  const bopmOk = r.bopmStatus !== "pending";
  if (vsdOk && bopmOk) return "compliant";
  if (vsdOk || bopmOk) return "partial";
  return "missing";
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

interface WeeklyComplianceTabProps {
  /** Optional map of dealId → overall RGY status, used to show R/Y/G counts per VSD. */
  rgyByDealId?: Record<string, "R" | "Y" | "G" | null>;
}

export function WeeklyComplianceTab({ rgyByDealId }: WeeklyComplianceTabProps = {}) {
  const [weekStart, setWeekStart] = useState(() => weekRange().start);
  const { rows, loading } = useRgyWeeklyCompliance(weekStart);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Group deals by VSD, only keep VSDs with at least one pending deal
  const vsdGroups = useMemo(() => {
    const map = new Map<string, ComplianceRow[]>();
    for (const r of rows) {
      const v = r.vsd || "Unassigned";
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(r);
    }
    return Array.from(map.entries())
      .map(([vsd, deals]) => {
        const pending = deals.filter(d => d.vsdStatus === "pending").length;
        const total = deals.length;
        const compliant = deals.filter(d => rowState(d) === "compliant").length;
        // RGY rollup for this VSD
        let red = 0, yellow = 0, green = 0;
        if (rgyByDealId) {
          for (const d of deals) {
            const w = rgyByDealId[d.dealId];
            if (w === "R") red++;
            else if (w === "Y") yellow++;
            else if (w === "G") green++;
          }
        }
        const rgyTotal = red + yellow + green;
        // Score: weighted health score (G=1, Y=0.5, R=0) blended with weekly compliance
        const healthScore = rgyTotal ? (green + yellow * 0.5) / rgyTotal : null;
        const complianceScore = total ? compliant / total : 0;
        const score = healthScore === null
          ? complianceScore
          : 0.6 * healthScore + 0.4 * complianceScore;
        // BOPM compliance within this VSD
        const bopmMap = new Map<string, { total: number; updated: number }>();
        for (const d of deals) {
          const names = d.bopm ? d.bopm.split(",").map(s => s.trim()).filter(Boolean) : [];
          const updatedThis = d.bopmStatus !== "pending";
          for (const n of names) {
            const b = bopmMap.get(n) || { total: 0, updated: 0 };
            b.total++;
            if (updatedThis) b.updated++;
            bopmMap.set(n, b);
          }
        }
        const bopms = Array.from(bopmMap.entries())
          .map(([bopm, v]) => ({ bopm, total: v.total, updated: v.updated, rate: v.total ? v.updated / v.total : 0 }))
          .sort((a, b) => a.rate - b.rate || b.total - a.total);
        return { vsd, deals, pending, total, compliant, rate: complianceScore, bopms, red, yellow, green, score };
      })
      .filter(g => g.pending > 0)
      .sort((a, b) => b.pending - a.pending || a.rate - b.rate);
  }, [rows, rgyByDealId]);

  const toggle = (vsd: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(vsd)) next.delete(vsd); else next.add(vsd);
      return next;
    });
  };

  const weekEnd = new Date(weekStart + "T00:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const isCurrentWeek = weekStart === weekRange().start;

  const handleMarkReviewed = async (dealId: string) => {
    await logRGYReviewedNoChange({ dealId, weekStart });
    toast.success("Marked as reviewed — no change");
  };

  const exportCsv = () => {
    const data = rows;
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
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals" className="h-8 pl-7 text-xs w-48" />
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* VSDs with pending deals — collapsible drill-down per VSD */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : vsdGroups.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
          All VSDs have updated their deals this week.
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
            VSDs with pending deals
          </div>
          <div className="divide-y divide-border">
            {vsdGroups.map(g => {
              const isOpen = expanded.has(g.vsd);
              const q = search.trim().toLowerCase();
              const visibleDeals = q
                ? g.deals.filter(r => `${r.dealId} ${r.account} ${r.dealName} ${r.bopm}`.toLowerCase().includes(q))
                : g.deals;
              return (
                <div key={g.vsd}>
                  <button
                    onClick={() => toggle(g.vsd)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-xs hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="font-medium truncate">{g.vsd}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="font-normal text-[10px]">{g.pending} pending</Badge>
                      {(g.red + g.yellow + g.green) > 0 && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-normal text-[10px] text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50">R {g.red}</Badge>
                          <Badge variant="outline" className="font-normal text-[10px] text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50">Y {g.yellow}</Badge>
                          <Badge variant="outline" className="font-normal text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50">G {g.green}</Badge>
                        </div>
                      )}
                      <Badge variant="outline" className="font-normal text-[10px] gap-1">
                        <span className="text-muted-foreground">Score</span>
                        <span className={cn(
                          "font-medium",
                          g.score >= 0.75 ? "text-emerald-600 dark:text-emerald-400"
                            : g.score >= 0.5 ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                        )}>{Math.round(g.score * 100)}</span>
                      </Badge>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="bg-secondary/10 border-t border-border">
                      {/* BOPMs for this VSD */}
                      {g.bopms.length > 0 && (
                        <div className="px-3 py-2 border-b border-border">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">P / Sr BOPMs in this VSD</div>
                          <div className="flex flex-wrap gap-1.5">
                            {g.bopms.map(b => (
                              <Badge key={b.bopm} variant="outline" className="font-normal text-[10px] gap-1">
                                <span className="font-medium">{b.bopm}</span>
                                <span className="text-muted-foreground">· {Math.round(b.rate * 100)}% ({b.updated}/{b.total})</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Deals table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-secondary/30">
                            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                              <th className="px-3 py-2">Deal</th>
                              <th className="px-3 py-2">VSD Status</th>
                              <th className="px-3 py-2">BOPM</th>
                              <th className="px-3 py-2">BOPM Status</th>
                              <th className="px-3 py-2">Last Activity</th>
                              <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleDeals.length === 0 && (
                              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No deals match the search.</td></tr>
                            )}
                            {visibleDeals.map(r => {
                              const lastAt = [r.vsdLastAt, r.bopmLastAt].filter(Boolean).sort().pop();
                              return (
                                <tr key={r.dealId} className="border-t border-border hover:bg-secondary/30">
                                  <td className="px-3 py-2 align-top">
                                    <Link to={`/deals/${r.dealId}`} className="font-medium text-primary hover:underline">{r.account || r.dealId}</Link>
                                    <div className="text-[10px] text-muted-foreground">{r.dealName} · {r.dealId}</div>
                                  </td>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
