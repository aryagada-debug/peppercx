import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, Search, CheckCircle2, Clock, AlertTriangle, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRgyWeeklyCompliance, type ComplianceRow } from "@/hooks/useRgyWeeklyCompliance";
import { weekRange, shiftWeek, statusLabel, statusToneClass, type ComplianceStatus } from "@/lib/rgyCompliance";
import { logRGYReviewedNoChange } from "@/lib/rgyHistory";

type StateFilter = "all" | "compliant" | "partial" | "missing";

function rowState(r: ComplianceRow): StateFilter {
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

export function WeeklyComplianceTab() {
  const [weekStart, setWeekStart] = useState(() => weekRange().start);
  const { rows, loading } = useRgyWeeklyCompliance(weekStart);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [vsdFilter, setVsdFilter] = useState<string>("all");

  const vsdOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.vsd && s.add(r.vsd));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (vsdFilter !== "all" && r.vsd !== vsdFilter) return false;
      if (stateFilter !== "all" && rowState(r) !== stateFilter) return false;
      if (q && !(`${r.dealId} ${r.account} ${r.dealName} ${r.vsd} ${r.bopm}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, search, stateFilter, vsdFilter]);

  const kpis = useMemo(() => {
    let compliant = 0, partial = 0, missing = 0, reviewed = 0;
    for (const r of rows) {
      const s = rowState(r);
      if (s === "compliant") compliant++;
      else if (s === "partial") partial++;
      else missing++;
      if (r.vsdStatus === "reviewed" || r.bopmStatus === "reviewed") reviewed++;
    }
    return { total: rows.length, compliant, partial, missing, reviewed };
  }, [rows]);

  const weekEnd = new Date(weekStart + "T00:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const isCurrentWeek = weekStart === weekRange().start;

  const handleMarkReviewed = async (dealId: string) => {
    await logRGYReviewedNoChange({ dealId, weekStart });
    toast.success("Marked as reviewed — no change");
  };

  const exportCsv = () => {
    const headers = ["Deal ID","Account","Deal","Pod","VSD","BOPM","VSD Status","VSD Updated By","VSD Updated At","BOPM Status","BOPM Updated By","BOPM Updated At"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
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
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KpiBox label="Active Deals" value={kpis.total} />
        <KpiBox label="Fully Compliant" value={kpis.compliant} tone="positive" />
        <KpiBox label="Partial" value={kpis.partial} tone="warning" />
        <KpiBox label="Not Updated" value={kpis.missing} tone="destructive" />
        <KpiBox label="Reviewed (no change)" value={kpis.reviewed} tone="info" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deal / account / person" className="h-8 pl-7 text-xs" />
        </div>
        <Select value={stateFilter} onValueChange={v => setStateFilter(v as StateFilter)}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="compliant">Fully compliant</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="missing">Not updated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vsdFilter} onValueChange={setVsdFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VSDs</SelectItem>
            {vsdOptions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} of {rows.length} deals</div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
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
      </div>
    </div>
  );
}

function KpiBox({ label, value, tone }: { label: string; value: number; tone?: "positive" | "warning" | "destructive" | "info" }) {
  const toneCls =
    tone === "positive" ? "text-emerald-700 dark:text-emerald-400" :
    tone === "warning" ? "text-amber-700 dark:text-amber-400" :
    tone === "destructive" ? "text-red-700 dark:text-red-400" :
    tone === "info" ? "text-blue-700 dark:text-blue-400" :
    "text-foreground";
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-medium mt-0.5", toneCls)}>{value}</div>
    </div>
  );
}