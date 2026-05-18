import { useEffect, useMemo, useState, Fragment } from "react";
import { formatINR } from "@/lib/csvTargets";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, MessageSquare, UserMinus, ChevronRight } from "lucide-react";
import { format, startOfMonth, subMonths, addDays, subDays, differenceInCalendarDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { UtilizationBar, UtilizationLegend } from "@/components/dashboard/UtilizationBar";
import { DealDrawer } from "@/components/dashboard/DealDrawer";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KPISkeleton, AlertsSkeleton, PodTableSkeleton, HeatmapSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { supabase } from "@/integrations/supabase/client";
import type { RGYRow, RGYStatus, KPI, DashboardAlert, PodMember } from "@/types/dashboard";
import { FinanceTargetsCard } from "@/components/targets/FinanceTargetsCard";
import { useUserRole } from "@/hooks/useUserRole";
import { useDealAccess } from "@/hooks/useDealAccess";
import { BopmEmptyState } from "@/components/access/BopmEmptyState";
import { computePortfolioScore, type ScoreOutput } from "@/lib/portfolioScore";
import { PortfolioHealthCard } from "@/components/dashboard/PortfolioHealthCard";
import { DealScorecardTable, type ScorecardRow } from "@/components/dashboard/DealScorecardTable";
import { getOverallCustomerRGY } from "@/lib/overallCustomerRGY";

const ACTIVE_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"];
const RGY_DIMS = ["Internal", "Customer", "Delivery", "Consumption"] as const;

function toRGY(s: string | null | undefined): RGYStatus {
  const v = (s || "").toUpperCase();
  if (v === "R" || v === "Y" || v === "G") return v as RGYStatus;
  return "NA";
}

function currentMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
}

/**
 * Weighted Overall Customer RGY for one deal — replaces the old worst-wins rollup.
 * Accepts a dim map keyed by any case (Customer / customer / etc.). See
 * src/lib/overallCustomerRGY.ts for the weighting table.
 */
function worstStatus(dims: Record<string, RGYStatus | string | null | undefined>): RGYStatus {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(dims)) normalized[k.toLowerCase()] = (v as string) || "";
  return (getOverallCustomerRGY(normalized) || "NA") as RGYStatus;
}

interface RgyCounts { total: number; r: number; y: number; g: number; na: number }
interface BopmRollup extends RgyCounts { bopm: string }
interface VsdRollup extends RgyCounts { vsd: string; bopms: BopmRollup[] }

const emptyCounts = (): RgyCounts => ({ total: 0, r: 0, y: 0, g: 0, na: 0 });
const addStatus = (c: RgyCounts, s: RGYStatus) => {
  c.total += 1;
  if (s === "R") c.r += 1;
  else if (s === "Y") c.y += 1;
  else if (s === "G") c.g += 1;
  else c.na += 1;
};

export default function Dashboard() {
  useCurrencyVersion();
  const { role } = useUserRole();
  // Capability Lead mirrors the VSD dashboard (team-scoped via useDealAccess);
  // Capability IC mirrors the BOPM dashboard. Both fall through to the legacy
  // dashboard which already adapts to BOPM/VSD personas.
  return <LegacyDashboard />;
}

function LegacyDashboard() {
  const [selectedDeal, setSelectedDeal] = useState<RGYRow | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [overallAttainment, setOverallAttainment] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [pod, setPod] = useState<PodMember[]>([]);
  const [rgyRows, setRgyRows] = useState<RGYRow[]>([]);
  const [vsdRollup, setVsdRollup] = useState<VsdRollup[]>([]);
  const [expandedVsd, setExpandedVsd] = useState<Set<string>>(new Set());
  const [currentScore, setCurrentScore] = useState<ScoreOutput | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [scorecardRows, setScorecardRows] = useState<ScorecardRow[]>([]);
  const { role } = useUserRole();
  const { visibleDealIds, loading: accessLoading } = useDealAccess();
  const isBopmPersona = role === "user" || role === "capability_member";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const monthStart = startOfMonth(new Date(`${selectedMonth}-01T00:00:00`));
      const monthIso = format(monthStart, "yyyy-MM-dd");
      const prevMonthStart = subMonths(monthStart, 1);
      const prevMonthIso = format(prevMonthStart, "yyyy-MM-dd");
      const monday = currentMonday();
      const mondayIso = format(monday, "yyyy-MM-dd");
      const overdueCutoff = format(subDays(new Date(), 35), "yyyy-MM-dd");
      const prevOverdueCutoff = format(subDays(new Date(), 65), "yyyy-MM-dd");
      const prevWeekCutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

      const [
        { data: deals },
        { data: rev },
        { data: rgyAll },
        { data: pendingMbrs },
        { data: inact },
        { data: assigns },
        { data: people },
        { data: alloc },
        { data: prevRev },
        { data: prevPendingMbrs },
      ] = await Promise.all([
        supabase.from("staffing_deals")
          .select("id, deal_name, account, mrr, total_deal_value, deal_status, vsd, principal_bopm, senior_bopm, bopm, end_date, slack_channel_id")
          .in("deal_status", ACTIVE_STATUSES),
        supabase.from("deal_revenue_monthly")
          .select("deal_id, mrr, actuals")
          .eq("month", monthIso),
        supabase.from("deal_rgy_weekly")
          .select("deal_id, week_start, internal, customer, delivery, consumption, content, seo, supply, copy, design, video")
          .order("week_start", { ascending: false })
          .limit(2000),
        supabase.from("mbr_entries")
          .select("deal_id, status, week_start")
          .eq("status", "Pending")
          .lt("week_start", overdueCutoff),
        supabase.from("slack_inactivity_nudges")
          .select("deal_id, channel_id, week_start")
          .gte("week_start", sevenDaysAgo),
        supabase.from("staffing_assignments").select("deal_id, person_id"),
        supabase.from("staffing_people").select("id, name, role_title, designation, tbh"),
        supabase.from("staffing_weekly_allocations")
          .select("person_id, deal_id, allocation_pct")
          .eq("week_start", mondayIso),
        supabase.from("deal_revenue_monthly")
          .select("deal_id, mrr, actuals")
          .eq("month", prevMonthIso),
        supabase.from("mbr_entries")
          .select("deal_id, status, week_start")
          .eq("status", "Pending")
          .lt("week_start", prevOverdueCutoff),
      ]);

      // Fetch all MBR entries (any status) for active deals to detect deals
      // that have NO MBR mapping at all. We treat those as "non-compliant" too.
      const { data: anyMbrs } = await supabase
        .from("mbr_entries")
        .select("deal_id");

      if (cancelled) return;

      let dealList = deals || [];
      if (isBopmPersona && !accessLoading) {
        dealList = dealList.filter((d: any) => visibleDealIds.has(d.id));
      }
      const activeIds = new Set(dealList.map((d: any) => d.id));

      // ---- KPIs ----
      const totalMRR = dealList.reduce((s: number, d: any) => s + (Number(d.mrr) || 0), 0);
      const totalTCV = dealList.reduce((s: number, d: any) => s + (Number(d.total_deal_value) || 0), 0);
      const monthMRRTarget = (rev || []).filter((r: any) => activeIds.has(r.deal_id))
        .reduce((s: number, r: any) => s + (Number(r.mrr) || 0), 0);
      const monthActuals = (rev || []).filter((r: any) => activeIds.has(r.deal_id))
        .reduce((s: number, r: any) => s + (Number(r.actuals) || 0), 0);
      const attainment = monthMRRTarget > 0 ? Math.round((monthActuals / monthMRRTarget) * 100) : 0;

      setKpis([
        { id: "k1", label: "Active Deals", value: String(dealList.length), suffix: "deals" },
        { id: "k2", label: "Total MRR", value: formatINR(totalMRR) },
        { id: "k3", label: "Total Deal Value", value: formatINR(totalTCV) },
      ]);
      setOverallAttainment(monthMRRTarget > 0 ? attainment : null);

      // ---- Latest RGY per deal ----
      const latestRgy = new Map<string, any>();
      for (const r of (rgyAll || [])) {
        if (!activeIds.has(r.deal_id)) continue;
        if (!latestRgy.has(r.deal_id)) latestRgy.set(r.deal_id, r);
      }
      const dealById = new Map<string, any>(dealList.map((d: any) => [d.id, d]));
      const rgyRowsBuilt: RGYRow[] = [];
      let redCount = 0;
      for (const [deal_id, r] of latestRgy) {
        const d = dealById.get(deal_id);
        if (!d) continue;
        const dims: Record<string, RGYStatus> = {
          Internal: toRGY(r.internal),
          Customer: toRGY(r.customer),
          Delivery: toRGY(r.delivery),
          Consumption: toRGY(r.consumption),
        };
        const extraDims: Record<string, RGYStatus> = {
          Content: toRGY((r as any).content),
          SEO: toRGY((r as any).seo),
          Supply: toRGY((r as any).supply),
          Copy: toRGY((r as any).copy),
          Design: toRGY((r as any).design),
          Video: toRGY((r as any).video),
        };
        if (Object.values({ ...dims, ...extraDims }).some(v => v === "R")) redCount++;
        rgyRowsBuilt.push({
          id: deal_id,
          deal: d.deal_name || deal_id,
          client: d.account || "—",
          bopm: d.principal_bopm || d.senior_bopm || d.bopm || "—",
          dimensions: { ...dims, ...extraDims },
        });
      }
      // Sort by # of red/yellow desc
      rgyRowsBuilt.sort((a, b) => {
        const score = (row: RGYRow) =>
          Object.values(row.dimensions).reduce((s, v) => s + (v === "R" ? 2 : v === "Y" ? 1 : 0), 0);
        return score(b) - score(a);
      });
      setRgyRows(rgyRowsBuilt);

      // ---- VSD → BOPM rollup ----
      const dealStatusById = new Map<string, RGYStatus>();
      for (const row of rgyRowsBuilt) {
        dealStatusById.set(row.id, worstStatus(row.dimensions));
      }
      const byVsd = new Map<string, { counts: RgyCounts; byBopm: Map<string, RgyCounts> }>();
      for (const d of dealList) {
        const vsd = (d.vsd || "").trim() || "Unassigned";
        const bopm = (d.principal_bopm || d.senior_bopm || d.bopm || "").trim() || "Unassigned";
        const status = dealStatusById.get(d.id) || "NA";
        if (!byVsd.has(vsd)) byVsd.set(vsd, { counts: emptyCounts(), byBopm: new Map() });
        const node = byVsd.get(vsd)!;
        addStatus(node.counts, status);
        if (!node.byBopm.has(bopm)) node.byBopm.set(bopm, emptyCounts());
        addStatus(node.byBopm.get(bopm)!, status);
      }
      const rollup: VsdRollup[] = Array.from(byVsd.entries())
        .map(([vsd, { counts, byBopm }]) => ({
          vsd,
          ...counts,
          bopms: Array.from(byBopm.entries())
            .map(([bopm, c]) => ({ bopm, ...c }))
            .sort((a, b) => b.r - a.r || b.y - a.y || b.total - a.total),
        }))
        .sort((a, b) => b.r - a.r || b.y - a.y || b.total - a.total);
      setVsdRollup(rollup);

      // ---- Alerts ----
      const dealsWithAnyMbr = new Set((anyMbrs || []).map((m: any) => m.deal_id));
      const overduePendingCount = (pendingMbrs || []).filter((m: any) => activeIds.has(m.deal_id)).length;
      const missingMbrCount = dealList.filter((d: any) => !dealsWithAnyMbr.has(d.id)).length;
      // Total MBR non-compliance: deals with overdue pending MBR + deals with no MBR mapped at all.
      const overdueMbrCount = overduePendingCount + missingMbrCount;
      const inactiveChannels = new Set((inact || []).map((i: any) => i.channel_id)).size;
      const noSlackChannelCount = dealList.filter((d: any) => !d.slack_channel_id).length;
      const staffedDeals = new Set((assigns || []).map((a: any) => a.deal_id));
      const unstaffedCount = dealList.filter((d: any) => !staffedDeals.has(d.id)).length;

      const builtAlerts: DashboardAlert[] = [];
      if (redCount > 0) builtAlerts.push({ id: "a1", icon: AlertTriangle, severity: "destructive",
        text: `${redCount} deal${redCount === 1 ? "" : "s"} have a Red RGY status`, actionLabel: "View →", actionHref: "/rgy-health" });
      if (overdueMbrCount > 0) builtAlerts.push({ id: "a2", icon: Clock, severity: "warning",
        text: `${overdueMbrCount} MBR${overdueMbrCount === 1 ? "" : "s"} overdue (>35 days)`, actionLabel: "View →", actionHref: "/mbr-tracker" });
      if (inactiveChannels > 0) builtAlerts.push({ id: "a3", icon: MessageSquare, severity: "warning",
        text: `${inactiveChannels} Slack channel${inactiveChannels === 1 ? "" : "s"} inactive in last 7 days`, actionLabel: "View →", actionHref: "/slack-health" });
      if (unstaffedCount > 0) builtAlerts.push({ id: "a4", icon: UserMinus, severity: "destructive",
        text: `${unstaffedCount} active deal${unstaffedCount === 1 ? "" : "s"} unstaffed`, actionLabel: "View →", actionHref: "/staffing" });
      setAlerts(builtAlerts);

      // ---- Pod Utilization (top by allocation this week) ----
      const peopleMap = new Map<string, any>((people || []).filter((p: any) => !p.tbh).map((p: any) => [p.id, p]));
      const allocByPerson = new Map<string, { pct: number; deals: Set<string> }>();
      for (const a of (alloc || [])) {
        if (!peopleMap.has(a.person_id)) continue;
        const cur = allocByPerson.get(a.person_id) || { pct: 0, deals: new Set<string>() };
        cur.pct += Number(a.allocation_pct) || 0;
        if (a.deal_id) cur.deals.add(a.deal_id);
        allocByPerson.set(a.person_id, cur);
      }
      const podBuilt: PodMember[] = Array.from(allocByPerson.entries())
        .map(([pid, v]) => {
          const p = peopleMap.get(pid)!;
          return {
            id: pid,
            name: p.name,
            role: p.designation || p.role_title || "—",
            utilization: Math.round(v.pct),
            deals: v.deals.size,
          };
        })
        .sort((a, b) => b.utilization - a.utilization)
        .slice(0, 8);
      setPod(podBuilt);

      // ---- Composite Portfolio Health Score ----
      const allStatuses: RGYStatus[] = rgyRowsBuilt.map(r => worstStatus(r.dimensions));
      const totalDeals = dealList.length;
      const score = computePortfolioScore({
        rgyStatuses: allStatuses,
        attainmentPct: attainment,
        overdueMbrCount: overdueMbrCount,
        unstaffedCount: unstaffedCount + noSlackChannelCount,
        totalDeals,
      });
      setCurrentScore(score);

      // Previous period score — reuse RGY history filtered to ~30+ days ago,
      // and previous month's revenue / overdue MBR snapshot.
      const prevLatestRgy = new Map<string, any>();
      for (const r of (rgyAll || [])) {
        if (!activeIds.has(r.deal_id)) continue;
        if (r.week_start > prevWeekCutoff) continue; // only weeks BEFORE 30 days ago
        if (!prevLatestRgy.has(r.deal_id)) prevLatestRgy.set(r.deal_id, r);
      }
      const prevStatuses: RGYStatus[] = [];
      for (const r of prevLatestRgy.values()) {
        const dims: Record<string, RGYStatus> = {
          Internal: toRGY(r.internal),
          Customer: toRGY(r.customer),
          Delivery: toRGY(r.delivery),
          Consumption: toRGY(r.consumption),
          Content: toRGY((r as any).content),
          SEO: toRGY((r as any).seo),
          Supply: toRGY((r as any).supply),
          Copy: toRGY((r as any).copy),
          Design: toRGY((r as any).design),
          Video: toRGY((r as any).video),
        };
        prevStatuses.push(worstStatus(dims));
      }
      const prevTarget = (prevRev || []).filter((r: any) => activeIds.has(r.deal_id))
        .reduce((s: number, r: any) => s + (Number(r.mrr) || 0), 0);
      const prevActuals = (prevRev || []).filter((r: any) => activeIds.has(r.deal_id))
        .reduce((s: number, r: any) => s + (Number(r.actuals) || 0), 0);
      const prevAttain = prevTarget > 0 ? Math.round((prevActuals / prevTarget) * 100) : attainment;
      const prevOverdue = (prevPendingMbrs || []).filter((m: any) => activeIds.has(m.deal_id)).length + missingMbrCount;
      if (prevStatuses.length > 0 || (prevRev || []).length > 0) {
        const prev = computePortfolioScore({
          rgyStatuses: prevStatuses.length > 0 ? prevStatuses : allStatuses,
          attainmentPct: prevAttain,
          overdueMbrCount: prevOverdue,
          unstaffedCount: unstaffedCount + noSlackChannelCount,
          totalDeals,
        });
        setPreviousScore(prev.score);
      } else {
        setPreviousScore(null);
      }

      // ---- Per-deal scorecard ----
      const revByDeal = new Map<string, any>((rev || []).map((r: any) => [r.deal_id, r]));
      const today = new Date();
      const cards: ScorecardRow[] = rgyRowsBuilt.map(row => {
        const deal = dealById.get(row.id);
        const dims = row.dimensions;
        const dimVals = Object.values(dims);
        const total = Math.max(1, dimVals.length);
        const greens = dimVals.filter(v => v === "G").length;
        const yellows = dimVals.filter(v => v === "Y").length;
        const reds = dimVals.filter(v => v === "R").length;
        const satisfactionPct = Math.round(((greens + yellows * 0.5) / total) * 100);
        const status = worstStatus(dims);
        const dealHealthScore = Math.round(
          (greens / total) * 100 * 0.7 + (1 - reds / total) * 100 * 0.3,
        );
        const letter =
          dealHealthScore >= 90 ? "A" :
          dealHealthScore >= 80 ? "B" :
          dealHealthScore >= 70 ? "C" :
          dealHealthScore >= 60 ? "D" : "F";
        const band: "Healthy" | "Watch" | "Critical" =
          dealHealthScore >= 80 ? "Healthy" : dealHealthScore >= 65 ? "Watch" : "Critical";

        const mrrTarget = Number(revByDeal.get(row.id)?.mrr) || Number(deal?.mrr) || 0;
        const actuals = Number(revByDeal.get(row.id)?.actuals) || 0;
        const progressPct = mrrTarget > 0 ? Math.round((actuals / mrrTarget) * 100) : 0;
        const budgetPct = mrrTarget > 0 ? Math.round((actuals / mrrTarget) * 100) : 0;

        const endDate = deal?.end_date ? String(deal.end_date) : null;
        const daysRemaining = endDate ? differenceInCalendarDays(new Date(endDate), today) : null;

        return {
          id: row.id,
          deal: row.deal,
          client: row.client,
          healthScore: dealHealthScore,
          letter,
          band,
          progressPct,
          budgetPct,
          satisfactionPct,
          daysRemaining,
          endDate,
        };
      });
      setScorecardRows(cards);

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedMonth, isBopmPersona, accessLoading, visibleDealIds]);

  const openDeal = (deal: RGYRow) => setSelectedDeal(deal);

  const toggleVsd = (vsd: string) => {
    setExpandedVsd(prev => {
      const next = new Set(prev);
      if (next.has(vsd)) next.delete(vsd); else next.add(vsd);
      return next;
    });
  };

  return (
    <AppLayout onSearchSelectDeal={openDeal}>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-subhead font-semibold tracking-tight text-foreground">Portfolio Overview</h1>
              {!isBopmPersona && alerts.length > 0 && <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>}
            </div>
            <p className="text-ui text-muted-foreground mt-1">{isBopmPersona ? "Your tagged & staffed deals" : "Live portfolio data"}</p>
          </div>
          <DateRangeSelector value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* KPI Row */}
        <div className="mb-8">
          {loading ? <KPISkeleton /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kpis.map((kpi) => <MetricCard key={kpi.id} {...kpi} />)}
            </div>
          )}
        </div>

        {isBopmPersona && !loading && !accessLoading && visibleDealIds.size === 0 && (
          <div className="mb-8"><BopmEmptyState section="Your dashboard" /></div>
        )}

        {/* Finance Targets */}
        <div className="mb-8 space-y-4">
          <FinanceTargetsCard monthYYYYMM={selectedMonth} dealIdScope={isBopmPersona ? visibleDealIds : undefined} overallAttainmentPct={overallAttainment} />
        </div>

        {/* Composite health (BOPM only) */}
        {isBopmPersona && currentScore && !loading && (
          <div className="mb-6">
            <PortfolioHealthCard
              current={currentScore}
              previousScore={previousScore}
              periodLabel={format(new Date(`${selectedMonth}-01T00:00:00`), "MMM yyyy")}
              comparisonLabel="vs prior 30d"
            />
          </div>
        )}

        {/* Per-deal scorecard (BOPM only) */}
        {isBopmPersona && !loading && (
          <div className="data-card mb-8">
            <div className="flex items-center justify-between mb-4">
              <p className="metric-label">Per-deal scorecard</p>
              <span className="text-caption text-muted-foreground">Sorted worst → best by grade</span>
            </div>
            <DealScorecardTable
              rows={scorecardRows}
              onRowClick={(id) => {
                const row = rgyRows.find(r => r.id === id);
                if (row) openDeal(row);
              }}
            />
          </div>
        )}

        <div className={cn("grid grid-cols-1 gap-4 mb-8", !isBopmPersona && "lg:grid-cols-3")}>
          {/* Alerts (admins only) */}
          {!isBopmPersona && (
            <div className="data-card col-span-1">
              <p className="metric-label mb-4">Alerts</p>
              {loading ? <AlertsSkeleton /> : alerts.length === 0 ? (
                <p className="text-ui text-muted-foreground">All clear — no active alerts.</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-2.5">
                      <alert.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${alert.severity === "destructive" ? "text-destructive" : "text-warning"}`} />
                      <span className="text-ui text-foreground flex-1">{alert.text}</span>
                      <Link to={alert.actionHref} className="text-ui text-primary hover:underline whitespace-nowrap">{alert.actionLabel}</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pod Utilization */}
          <div className={cn("data-card col-span-1", !isBopmPersona && "lg:col-span-2")}>
            <p className="metric-label mb-4">Top Utilization (this week)</p>
            {loading ? <PodTableSkeleton /> : pod.length === 0 ? (
              <p className="text-ui text-muted-foreground">No allocations recorded for this week.</p>
            ) : (
              <>
                <table className="w-full text-ui" aria-label="Pod Utilization">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Name</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Role</th>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deals</th>
                      <th className="text-left py-2 font-medium text-muted-foreground text-caption uppercase tracking-wider">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pod.map((m) => (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium text-foreground">{m.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{m.role}</td>
                        <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">{m.deals}</td>
                        <td className="py-2"><UtilizationBar value={m.utilization} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <UtilizationLegend />
              </>
            )}
          </div>
        </div>

        {/* RGY Health by VSD */}
        <div className="data-card">
          <p className="metric-label mb-4">RGY Health by VSD</p>
          {loading ? <HeatmapSkeleton /> : vsdRollup.length === 0 ? (
            <p className="text-ui text-muted-foreground">No active deals to summarise.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-ui">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider w-8" />
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">VSD</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deals</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">R</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Y</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">G</th>
                    <th className="text-right py-2 font-medium text-muted-foreground text-caption uppercase tracking-wider">N/A</th>
                  </tr>
                </thead>
                <tbody>
                  {vsdRollup.map(v => {
                    const open = expandedVsd.has(v.vsd);
                    return (
                      <Fragment key={v.vsd}>
                        <tr
                          className="border-b border-border/50 cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => toggleVsd(v.vsd)}
                        >
                          <td className="py-2 pl-2">
                            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
                          </td>
                          <td className="py-2 pr-4 font-medium text-foreground">{v.vsd}</td>
                          <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">{v.total}</td>
                          <td className="py-2 pr-4 text-right font-mono tabular-nums">
                            <span className={cn("inline-block min-w-[2ch] px-1.5 rounded", v.r > 0 ? "bg-destructive/15 text-destructive font-semibold" : "text-muted-foreground")}>{v.r}</span>
                          </td>
                          <td className="py-2 pr-4 text-right font-mono tabular-nums">
                            <span className={cn("inline-block min-w-[2ch] px-1.5 rounded", v.y > 0 ? "bg-warning/15 text-warning font-semibold" : "text-muted-foreground")}>{v.y}</span>
                          </td>
                          <td className="py-2 pr-4 text-right font-mono tabular-nums">
                            <span className={cn("inline-block min-w-[2ch] px-1.5 rounded", v.g > 0 ? "bg-positive/15 text-positive font-semibold" : "text-muted-foreground")}>{v.g}</span>
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">{v.na}</td>
                        </tr>
                        {open && v.bopms.map(b => (
                          <tr key={`${v.vsd}::${b.bopm}`} className="border-b border-border/30 bg-muted/20">
                            <td />
                            <td className="py-1.5 pr-4 pl-6 text-foreground/80 text-caption">{b.bopm}</td>
                            <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-foreground/80 text-caption">{b.total}</td>
                            <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-caption">
                              <span className={cn(b.r > 0 ? "text-destructive font-medium" : "text-muted-foreground")}>{b.r}</span>
                            </td>
                            <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-caption">
                              <span className={cn(b.y > 0 ? "text-warning font-medium" : "text-muted-foreground")}>{b.y}</span>
                            </td>
                            <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-caption">
                              <span className={cn(b.g > 0 ? "text-positive font-medium" : "text-muted-foreground")}>{b.g}</span>
                            </td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground text-caption">{b.na}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DealDrawer deal={selectedDeal} open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)} />
    </AppLayout>
  );
}
