import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RGYHeatmap } from "@/components/dashboard/RGYHeatmap";
import { UtilizationBar, UtilizationLegend } from "@/components/dashboard/UtilizationBar";
import { DealDrawer } from "@/components/dashboard/DealDrawer";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { Badge } from "@/components/ui/badge";
import { kpis, alerts, podMembers, rgyData, rgyDimensions } from "@/data/dashboardMocks";
import type { RGYRow } from "@/types/dashboard";

export default function Dashboard() {
  const [selectedDeal, setSelectedDeal] = useState<RGYRow | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("2026-03");

  const openDeal = (deal: RGYRow) => setSelectedDeal(deal);

  return (
    <AppLayout onSearchSelectDeal={openDeal}>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-subhead font-semibold tracking-tight text-foreground">Portfolio Overview</h1>
              <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>
            </div>
            <p className="text-ui text-muted-foreground mt-1">VSD Pod — Anirudh Kumar</p>
          </div>
          <DateRangeSelector value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi) => (
            <MetricCard key={kpi.id} {...kpi} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Alerts */}
          <div className="data-card col-span-1">
            <p className="metric-label mb-4">Alerts</p>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-2.5">
                  <alert.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${alert.severity === "destructive" ? "text-destructive" : "text-warning"}`} />
                  <span className="text-ui text-foreground flex-1">{alert.text}</span>
                  <Link to={alert.actionHref} className="text-ui text-primary hover:underline whitespace-nowrap">{alert.actionLabel}</Link>
                </div>
              ))}
            </div>
          </div>

          {/* Pod Utilization */}
          <div className="data-card col-span-1 lg:col-span-2">
            <p className="metric-label mb-4">Pod Utilization</p>
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
                {podMembers.map((m) => (
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
          </div>
        </div>

        {/* RGY Heatmap */}
        <div className="data-card">
          <p className="metric-label mb-4">RGY Health — Deal Heatmap</p>
          <RGYHeatmap data={rgyData} dimensions={rgyDimensions} onRowClick={openDeal} />
        </div>
      </div>

      <DealDrawer deal={selectedDeal} open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)} />
    </AppLayout>
  );
}
