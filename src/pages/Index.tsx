import { useEffect, useMemo, useState, Fragment } from "react";
import { formatINR } from "@/lib/csvTargets";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, MessageSquare, UserMinus, ChevronRight } from "lucide-react";
import { format, startOfMonth, addDays, subDays } from "date-fns";
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

const ACTIVE_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"];
const RGY_DIMS = ["Internal", "Customer", "Delivery", "Consumption"] as const;

function toRGY(s: string | null | undefined): RGYStatus {
  const v = (s || "").toUpperCase();
  if (v === "R" || v === "Y" || v === "G") return v as RGYStatus;
  return "NA";
}

function formatINR(n: number) {
  return formatINR(Number(n) || 0);
}

function currentMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
}

/** Roll up the 4 RGY dimensions for one deal into a single status (worst wins). */
function worstStatus(dims: Record<string, RGYStatus>): RGYStatus {
  const vals = Object.values(dims);
  if (vals.includes("R")) return "R";
  if (vals.includes("Y")) return "Y";
  if (vals.includes("G")) return "G";
  return "NA";
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
  const [selectedDeal, setSelectedDeal] = useState<RGYRow | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [pod, setPod] = useState<PodMember[]>([]);
  const [rgyRows, setRgyRows] = useState<RGYRow[]>([]);
  const [vsdRollup, setVsdRollup] = useState<VsdRollup[]>([]);
  const [expandedVsd, setExpandedVsd] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const monthStart = startOfMonth(new Date(`${selectedMonth}-01T00:00:00`));
      const monthIso = format(monthStart, "yyyy-MM-dd");
      const monday = currentMonday();
      const mondayIso = format(monday, "yyyy-MM-dd");
      const overdueCutoff = format(subDays(new Date(), 35), "yyyy-MM-dd");
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
      ] = await Promise.all([
        supabase.from("staffing_deals")
          .select("id, deal_name, account, mrr, total_deal_value, deal_status, vsd, principal_bopm, senior_bopm, bopm")
          .in("deal_status", ACTIVE_STATUSES),
        supabase.from("deal_revenue_monthly")
          .select("deal_id, mrr, actuals")
          .eq("month", monthIso),
        supabase.from("deal_rgy_weekly")
          .select("deal_id, week_start, internal, customer, delivery, consumption")
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
      ]);

      if (cancelled) return;

      const dealList = deals || [];
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
        { id: "k4", label: "Attainment", value: `${attainment}%` },
      ]);

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
        if (Object.values(dims).some(v => v === "R")) redCount++;
        rgyRowsBuilt.push({
          id: deal_id,
          deal: d.deal_name || deal_id,
          client: d.account || "—",
          bopm: d.principal_bopm || d.senior_bopm || d.bopm || "—",
          dimensions: dims,
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
      const overdueMbrCount = (pendingMbrs || []).filter((m: any) => activeIds.has(m.deal_id)).length;
      const inactiveChannels = new Set((inact || []).map((i: any) => i.channel_id)).size;
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

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedMonth]);

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
              {alerts.length > 0 && <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>}
            </div>
            <p className="text-ui text-muted-foreground mt-1">Live portfolio data</p>
          </div>
          <DateRangeSelector value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* KPI Row */}
        <div className="mb-8">
          {loading ? <KPISkeleton /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((kpi) => <MetricCard key={kpi.id} {...kpi} />)}
            </div>
          )}
        </div>

        {/* Finance Targets */}
        <div className="mb-8 space-y-4">
          <FinanceTargetsCard monthYYYYMM={selectedMonth} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Alerts */}
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

          {/* Pod Utilization */}
          <div className="data-card col-span-1 lg:col-span-2">
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
