import React, { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { cn } from "@/lib/utils";
import { AlertTriangle, Flag, Clock, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TeamCountDrillDialog } from "./TeamCountDrillDialog";
import { VSDDrillDialog } from "./VSDDrillDialog";

const DIMENSIONS = [
  { key: "customer", label: "Customer" },
  { key: "internal", label: "Internal" },
  { key: "content", label: "Content" },
  { key: "seo", label: "SEO" },
  { key: "supply", label: "Supply" },
  { key: "copy", label: "Copy" },
  { key: "design", label: "Design" },
  { key: "video", label: "Video" },
];

const SERVICE_LINES = ["content", "seo", "supply", "copy", "design", "video"];

const COLORS = { R: "#ef4444", Y: "#f59e0b", G: "#22c55e", NA: "#94a3b8" };
const RED_AGING_THRESHOLD = 10; // days — Red issues older than this are surfaced to the top

const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);

const statusBadgeStyles: Record<string, string> = {
  "Active Deal": "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  "Deal Disputed": "bg-amber-500/15 text-amber-700 border-amber-500/30",
  "New Deal in SLA/PO": "bg-blue-500/15 text-blue-700 border-blue-500/30",
  "Deal Completed Successfully": "bg-muted text-muted-foreground border-border",
  "Deal Churned / Lost": "bg-red-500/15 text-red-700 border-red-500/30",
};

const statusShortLabels: Record<string, string> = {
  "Active Deal": "Active",
  "Deal Disputed": "Disputed",
  "New Deal in SLA/PO": "New/SLA",
  "Deal Completed Successfully": "Completed",
  "Deal Churned / Lost": "Churned",
};

interface DealWithRGY {
  id: string;
  deal_id: string;
  deal_name: string;
  account: string;
  deal_status: string;
  vsd: string;
  pod?: string;
  [key: string]: any;
}

interface RGYIssue {
  deal_id: string;          // FK to staffing_deals.id
  deal_id_code: string;     // human deal_id code
  deal_name: string;
  pc_code: string;
  account: string;
  pod: string;
  deal_status: string;
  issue_details: string;
  issue_status: string;
  action_plan: string;
  discussed_action_plan: string;
  red_dimensions: string[];
  worst: "R" | "Y" | "G" | null;
  issue_date: string | null;
  created_at: string;
}

interface Props {
  deals: DealWithRGY[];
  filteredDeals: DealWithRGY[];
  issues: RGYIssue[];
  activePod: string;
}

function getWorstRGY(deal: DealWithRGY): "R" | "Y" | "G" | null {
  const vals = DIMENSIONS.map((d) => deal[d.key] as string);
  if (vals.includes("R")) return "R";
  if (vals.includes("Y")) return "Y";
  if (vals.every((v) => v === "NA" || !v)) return null;
  return "G";
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
}

const CORE_VSDS_LIST = ["Neema Jayadas", "Sumit Shekhawat", "Aamir Khan", "Sneha Iyer", "Aditya Shaw"];
const VSD_SHORT: Record<string, string> = {
  "Neema Jayadas": "Neema",
  "Sumit Shekhawat": "Sumit",
  "Aamir Khan": "Aamir",
  "Sneha Iyer": "Sneha",
  "Aditya Shaw": "Aditya",
};

export function RGYInsightsTab({ deals, filteredDeals, issues, activePod }: Props) {
  const [teamDrill, setTeamDrill] = useState<{ team: string; severity: "R" | "Y" } | null>(null);
  const [vsdDrill, setVsdDrill] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiWindow, setAiWindow] = useState<"week" | "month">("week");

  // ── KPIs ──
  const kpis = useMemo(() => {
    let red = 0, yellow = 0, green = 0, churned = 0;
    filteredDeals.forEach((d) => {
      if (d.deal_status === "Deal Churned / Lost") { churned++; return; }
      const w = getWorstRGY(d);
      if (w === "R") red++;
      else if (w === "Y") yellow++;
      else if (w === "G") green++;
    });

    // Avg days open across active issues (in current POD scope)
    const podIssues = issues.filter((i) =>
      activePod === "All" ? true : i.pod === activePod,
    );
    const openDays = podIssues
      .filter((i) => i.issue_status === "Open" || i.issue_status === "In Progress")
      .map((i) => daysSince(i.issue_date || i.created_at));
    const avgDaysOpen = openDays.length > 0
      ? Math.round(openDays.reduce((a, b) => a + b, 0) / openDays.length)
      : 0;

    return { total: filteredDeals.length, red, yellow, green, churned, avgDaysOpen };
  }, [filteredDeals, issues, activePod]);

  // ── Health donut ──
  const donutData = useMemo(() => [
    { name: "Red", value: kpis.red, fill: COLORS.R },
    { name: "Yellow", value: kpis.yellow, fill: COLORS.Y },
    { name: "Green", value: kpis.green, fill: COLORS.G },
  ].filter((d) => d.value > 0), [kpis]);

  // ── Per-team Red / Yellow counts ──
  const teamHealth = useMemo(
    () =>
      DIMENSIONS.map((dim) => ({
        team: dim.label,
        key: dim.key,
        Red: filteredDeals.filter((d) => d[dim.key] === "R").length,
        Yellow: filteredDeals.filter((d) => d[dim.key] === "Y").length,
        Green: filteredDeals.filter((d) => d[dim.key] === "G").length,
      })),
    [filteredDeals],
  );

  // Drill data for team-count
  const teamDrillDeals = useMemo(() => {
    if (!teamDrill) return [];
    const dim = DIMENSIONS.find((d) => d.label === teamDrill.team);
    if (!dim) return [];
    return filteredDeals
      .filter((d) => d[dim.key] === teamDrill.severity)
      .map((d) => {
        const issue = issues.find((i) => i.deal_id === d.id);
        return {
          id: d.id,
          deal_id: d.deal_id,
          deal_name: d.deal_name,
          account: d.account,
          rgy_value: teamDrill.severity,
          issue_details: issue?.issue_details || "",
        };
      });
  }, [teamDrill, filteredDeals, issues]);

  // ── Heatmap: Account, Deal Name, Deal ID + dimensions ──
  const heatmapData = useMemo(() => {
    return filteredDeals
      .filter(
        (d) =>
          ACTIVE_STATUSES.has(d.deal_status) &&
          DIMENSIONS.some((dim) => {
            const v = d[dim.key] as string;
            return v && v !== "NA";
          }),
      )
      .map((deal) => {
        const redCount = DIMENSIONS.filter((d) => deal[d.key] === "R").length;
        const yellowCount = DIMENSIONS.filter((d) => deal[d.key] === "Y").length;
        return { deal, redCount, yellowCount };
      })
      .sort((a, b) => b.redCount - a.redCount || b.yellowCount - a.yellowCount);
  }, [filteredDeals]);

  // ── VSD Comparison: ALWAYS uses ALL deals (ignore POD filter) ──
  const vsdComparison = useMemo(() => {
    const map = new Map<string, { vsd: string; vsdFull: string; Red: number; Yellow: number; Green: number; total: number }>();
    CORE_VSDS_LIST.forEach((v) =>
      map.set(v, { vsd: VSD_SHORT[v] || v, vsdFull: v, Red: 0, Yellow: 0, Green: 0, total: 0 }),
    );
    deals.forEach((deal) => {
      const v = deal.vsd || "";
      if (!map.has(v)) return;
      // Only count active deals
      if (!ACTIVE_STATUSES.has(deal.deal_status)) return;
      const entry = map.get(v)!;
      const w = getWorstRGY(deal);
      if (w === "R") entry.Red++;
      else if (w === "Y") entry.Yellow++;
      else if (w === "G") entry.Green++;
      entry.total = entry.Red + entry.Yellow + entry.Green;
    });
    return Array.from(map.values());
  }, [deals]);

  const vsdDrillDeals = useMemo(() => {
    if (!vsdDrill) return [];
    return deals
      .filter((d) => d.vsd === vsdDrill && ACTIVE_STATUSES.has(d.deal_status))
      .map((d) => ({
        id: d.id,
        deal_id: d.deal_id,
        deal_name: d.deal_name,
        account: d.account,
        worst: getWorstRGY(d),
      }));
  }, [vsdDrill, deals]);

  // ── Active Issues — POD-filtered, with timeline + flags ──
  const activeIssues = useMemo(() => {
    const filtered = issues
      .filter((i) => i.issue_status === "Open" || i.issue_status === "In Progress")
      .filter((i) => (activePod === "All" ? true : i.pod === activePod))
      .map((i) => {
        const days = daysSince(i.issue_date || i.created_at);
        const flagged =
          (i.worst === "R" && days > 10) ||
          (i.worst === "Y" && days > 15);
        const agedRed = i.worst === "R" && days > RED_AGING_THRESHOLD;
        return { ...i, days, flagged, agedRed };
      });
    // Sort: aged Red first, then other Red, then Yellow — older first within each group
    const rank = (i: typeof filtered[number]) => {
      if (i.agedRed) return 0;
      if (i.worst === "R") return 1;
      if (i.worst === "Y") return 2;
      return 3;
    };
    return filtered.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return b.days - a.days;
    });
  }, [issues, activePod]);

  // ── Aging issues (top 8 oldest open) ──
  const agingIssues = useMemo(() => activeIssues.slice(0, 8), [activeIssues]);

  // ── AI summary trigger ──
  const generateSummary = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const snapshot = {
        window: aiWindow,
        kpis,
        teamHealth,
        vsdComparison: vsdComparison.map(v => ({ vsd: v.vsdFull, R: v.Red, Y: v.Yellow, G: v.Green })),
        topAgedRedIssues: activeIssues
          .filter(i => i.worst === "R")
          .slice(0, 10)
          .map(i => ({ deal: i.deal_name, days: i.days, dims: i.red_dimensions, details: i.issue_details?.slice(0, 200) })),
      };
      const { data, error } = await supabase.functions.invoke("rgy-movement-summary", {
        body: { window: aiWindow, snapshot },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAiSummary((data as any)?.summary || "");
    } catch (e: any) {
      setAiError(e?.message || "Failed to generate summary");
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-generate once on mount / when window changes
  useEffect(() => {
    generateSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiWindow, activePod]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { label: "Total Deals", value: kpis.total, color: "" },
          { label: "Red / Hot-Red", value: kpis.red, color: "text-red-600" },
          { label: "Yellow", value: kpis.yellow, color: "text-amber-600" },
          { label: "Green", value: kpis.green, color: "text-emerald-600" },
          { label: "Churned", value: kpis.churned, color: "text-muted-foreground" },
          { label: "Avg Days Open", value: kpis.avgDaysOpen, color: "text-foreground" },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-lg p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* AI Movement Summary */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Movement Summary
          </h3>
          <div className="flex items-center gap-1">
            <div className="flex bg-secondary rounded-md p-0.5">
              {(["week", "month"] as const).map(w => (
                <button
                  key={w}
                  onClick={() => setAiWindow(w)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] rounded font-medium transition-colors",
                    aiWindow === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {w === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={generateSummary} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </div>
        {aiError ? (
          <p className="text-xs text-destructive">{aiError}</p>
        ) : aiLoading && !aiSummary ? (
          <p className="text-xs text-muted-foreground italic">Generating summary…</p>
        ) : (
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{aiSummary || "—"}</p>
        )}
      </div>

      {/* VSD Comparison — moved to top */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">VSD Portfolio Health Comparison</h3>
          <span className="text-[10px] text-muted-foreground">All Pods · Click bar to drill in</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Stacked R / Y / G deal count per VSD across active deals</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={vsdComparison} margin={{ left: 10, bottom: 5, top: 10 }} barSize={50}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="vsd" tick={{ fontSize: 12, fontWeight: 500 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} label={{ value: "Deal Count", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
            <RechartsTooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              formatter={(value: number, name: string) => [`${value} deals`, name]}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar dataKey="Red" stackId="vsd" fill={COLORS.R} cursor="pointer" onClick={(d: any) => setVsdDrill(d.vsdFull)}>
              <LabelList dataKey="Red" position="center" fill="#fff" fontSize={11} fontWeight={600} formatter={(v: number) => (v > 0 ? v : "")} />
            </Bar>
            <Bar dataKey="Yellow" stackId="vsd" fill={COLORS.Y} cursor="pointer" onClick={(d: any) => setVsdDrill(d.vsdFull)}>
              <LabelList dataKey="Yellow" position="center" fill="#1f2937" fontSize={11} fontWeight={600} formatter={(v: number) => (v > 0 ? v : "")} />
            </Bar>
            <Bar dataKey="Green" stackId="vsd" fill={COLORS.G} radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => setVsdDrill(d.vsdFull)}>
              <LabelList dataKey="Green" position="center" fill="#fff" fontSize={11} fontWeight={600} formatter={(v: number) => (v > 0 ? v : "")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: Active Issues (POD-filtered) + Health Donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Active issues & action plans
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">
              {activePod === "All" ? "All Pods" : activePod} · {activeIssues.length} open
            </span>
          </h3>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {activeIssues.length === 0 && <p className="text-xs text-muted-foreground">No open issues</p>}
            {activeIssues.map((issue, i) => {
              const maxBadges = 4;
              const visibleDims = issue.red_dimensions.slice(0, maxBadges);
              const overflowCount = issue.red_dimensions.length - maxBadges;

              return (
                <div key={i} className={cn(
                  "border-b border-border/50 pb-3 last:border-0 last:pb-0",
                  issue.flagged && "bg-red-500/5 -mx-2 px-2 rounded",
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 font-medium border shrink-0",
                            statusBadgeStyles[issue.deal_status] || "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {statusShortLabels[issue.deal_status] || issue.deal_status || "—"}
                        </Badge>
                        <Link
                          to={`/deals/${issue.deal_id}?tab=Tasks`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          {issue.deal_name}
                        </Link>
                        <span className="text-[11px] text-muted-foreground font-mono">{issue.deal_id_code}</span>
                        {/* Timeline + flag */}
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {issue.days}d since marked {issue.worst === "R" ? "Red" : issue.worst === "Y" ? "Yellow" : ""}
                        </span>
                        {issue.flagged && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-700 border border-red-500/30">
                            <Flag className="h-3 w-3" />
                            {issue.worst === "R" ? "10+ days" : "15+ days"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">{issue.issue_details}</p>
                      {issue.action_plan && (
                        <p className="text-xs text-muted-foreground italic mt-1">{issue.action_plan}</p>
                      )}
                    </div>
                    {issue.red_dimensions.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end max-w-[200px]">
                        {visibleDims.map((dim) => (
                          <span key={dim} className="px-2 py-0.5 rounded text-[10px] font-medium text-red-700 bg-red-500/10 border border-red-500/20 whitespace-nowrap">
                            {dim}
                          </span>
                        ))}
                        {overflowCount > 0 && (
                          <span className="text-[10px] font-medium text-red-600">+{overflowCount}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Health Donut + Aging Issues */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Health Distribution (Worst RGY)</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width={220} height={180}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 ml-4">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span>{d.name}: <strong>{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              Aging Issues (oldest first)
            </h3>
            <div className="space-y-1">
              {agingIssues.length === 0 && <p className="text-xs text-muted-foreground py-2">No aging open issues.</p>}
              {agingIssues.map((i) => (
                <div key={`${i.deal_id}-${i.created_at}`} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="truncate flex-1 text-foreground">{i.deal_name}</span>
                  <span className={cn(
                    "font-semibold tabular-nums",
                    i.flagged ? "text-red-600" : i.worst === "R" ? "text-red-500" : "text-amber-600",
                  )}>
                    {i.days}d
                  </span>
                  {i.flagged && <Flag className="h-3 w-3 text-red-500" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Health Breakdown (Red / Yellow / Green per dimension) */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-1">Team Health Breakdown</h3>
        <p className="text-[11px] text-muted-foreground mb-2">
          Stacked R / Y / G deal count per team. Click a Red or Yellow segment to drill into the deals.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={teamHealth} margin={{ left: 10, bottom: 5 }} barSize={42}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="team" tick={{ fontSize: 11 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <RechartsTooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              formatter={(value: number, name: string) => [`${value} deals`, name]}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar
              dataKey="Red"
              stackId="health"
              fill={COLORS.R}
              cursor="pointer"
              onClick={(d: any) => d.Red > 0 && setTeamDrill({ team: d.team, severity: "R" })}
            />
            <Bar
              dataKey="Yellow"
              stackId="health"
              fill={COLORS.Y}
              cursor="pointer"
              onClick={(d: any) => d.Yellow > 0 && setTeamDrill({ team: d.team, severity: "Y" })}
            />
            <Bar
              dataKey="Green"
              stackId="health"
              fill={COLORS.G}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap: Account, Deal Name, Deal ID + 8 dimensions */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Full Account × Dimension Heatmap</h3>
        {heatmapData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No active accounts with RGY data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Account</th>
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Deal Name</th>
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Deal ID</th>
                  {DIMENSIONS.map((d) => (
                    <th key={d.key} className="text-center py-1.5 px-1 font-medium text-muted-foreground whitespace-nowrap">{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map(({ deal }) => (
                  <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="py-1 px-2 truncate max-w-[140px] text-muted-foreground" title={deal.account}>{deal.account}</td>
                    <td className="py-1 px-2 font-medium truncate max-w-[160px]" title={deal.deal_name}>{deal.deal_name}</td>
                    <td className="py-1 px-2 font-mono text-[11px] text-muted-foreground">{deal.deal_id || "—"}</td>
                    {DIMENSIONS.map((dim) => {
                      const v = deal[dim.key] as string;
                      const bg = v === "R" ? "bg-red-500/20" : v === "Y" ? "bg-amber-500/20" : v === "G" ? "bg-emerald-500/20" : "";
                      const textColor = v === "R" ? "text-red-700" : v === "Y" ? "text-amber-700" : v === "G" ? "text-emerald-700" : "text-muted-foreground";
                      return (
                        <td key={dim.key} className={cn("text-center py-1 px-1 font-semibold", bg, textColor)}>
                          {v === "NA" ? "—" : v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VSD Comparison — ALWAYS all 5 VSDs, ignores POD filter */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">VSD Portfolio Health Comparison</h3>
          <span className="text-[10px] text-muted-foreground">All Pods · Click bar to drill in</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Stacked R / Y / G deal count per VSD across active deals</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={vsdComparison} margin={{ left: 10, bottom: 5 }} barSize={50}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="vsd" tick={{ fontSize: 12, fontWeight: 500 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} label={{ value: "Deal Count", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
            <RechartsTooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              formatter={(value: number, name: string) => [`${value} deals`, name]}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar dataKey="Red" stackId="vsd" fill={COLORS.R} cursor="pointer" onClick={(d: any) => setVsdDrill(d.vsdFull)} />
            <Bar dataKey="Yellow" stackId="vsd" fill={COLORS.Y} cursor="pointer" onClick={(d: any) => setVsdDrill(d.vsdFull)} />
            <Bar dataKey="Green" stackId="vsd" fill={COLORS.G} radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => setVsdDrill(d.vsdFull)} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Drill dialogs */}
      {teamDrill && (
        <TeamCountDrillDialog
          open
          onClose={() => setTeamDrill(null)}
          team={teamDrill.team}
          severity={teamDrill.severity}
          deals={teamDrillDeals}
        />
      )}
      {vsdDrill && (
        <VSDDrillDialog
          open
          onClose={() => setVsdDrill(null)}
          vsd={vsdDrill}
          deals={vsdDrillDeals}
        />
      )}
    </div>
  );
}
