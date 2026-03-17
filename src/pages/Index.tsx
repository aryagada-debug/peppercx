import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RGYHeatmap } from "@/components/dashboard/RGYHeatmap";
import { AlertTriangle, Clock, MessageSquare, UserMinus } from "lucide-react";

const kpis = [
  { label: "Active Deals", value: "47", change: 4.26, suffix: "deals" },
  { label: "Total MRR", value: "₹1.82Cr", change: 7.14 },
  { label: "Total Deal Value", value: "₹18.4Cr", change: 3.21 },
  { label: "Attainment", value: "91.2%", change: -1.38 },
];

const alerts = [
  { icon: AlertTriangle, text: "3 deals have Red RGY status", severity: "destructive" as const },
  { icon: Clock, text: "5 MBRs overdue (>35 days)", severity: "warning" as const },
  { icon: MessageSquare, text: "4 Slack channels inactive >3 days", severity: "warning" as const },
  { icon: UserMinus, text: "2 deals unstaffed", severity: "destructive" as const },
];

const podMembers = [
  { name: "Rahul S.", role: "Sr. BOPM", utilization: 82, deals: 6 },
  { name: "Priya M.", role: "Group BOPM", utilization: 71, deals: 5 },
  { name: "Ankit K.", role: "Jr. BOPM", utilization: 93, deals: 4 },
  { name: "Meera T.", role: "Sr. BOPM", utilization: 67, deals: 7 },
  { name: "Vikram J.", role: "Jr. BOPM", utilization: 88, deals: 3 },
];

const rgyData = [
  { deal: "D-2024-047", client: "TechCorp India", dimensions: { Internal: "G" as const, Customer: "G" as const, Delivery: "Y" as const, Consumption: "G" as const } },
  { deal: "D-2024-041", client: "FinServe Ltd", dimensions: { Internal: "Y" as const, Customer: "R" as const, Delivery: "Y" as const, Consumption: "R" as const } },
  { deal: "D-2024-038", client: "MediaNext", dimensions: { Internal: "G" as const, Customer: "G" as const, Delivery: "G" as const, Consumption: "Y" as const } },
  { deal: "D-2024-035", client: "RetailMax", dimensions: { Internal: "R" as const, Customer: "Y" as const, Delivery: "R" as const, Consumption: "Y" as const } },
  { deal: "D-2024-033", client: "CloudFirst", dimensions: { Internal: "G" as const, Customer: "G" as const, Delivery: "G" as const, Consumption: "G" as const } },
  { deal: "D-2024-029", client: "EduPrime", dimensions: { Internal: "Y" as const, Customer: "Y" as const, Delivery: "G" as const, Consumption: "NA" as const } },
];

const rgyDimensions = ["Internal", "Customer", "Delivery", "Consumption"];

function UtilizationBar({ value }: { value: number }) {
  const color = value < 70 ? "bg-positive" : value < 85 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-sm overflow-hidden">
        <div className={`h-full rounded-sm ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-caption font-mono tabular-nums text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-subhead font-semibold tracking-tight text-foreground">Portfolio Overview</h1>
          <p className="text-ui text-muted-foreground mt-1">VSD Pod — Anirudh Kumar • March 2026</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi) => (
            <MetricCard key={kpi.label} {...kpi} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Alerts Panel */}
          <div className="data-card col-span-1">
            <p className="metric-label mb-4">Alerts</p>
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <alert.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${alert.severity === "destructive" ? "text-destructive" : "text-warning"}`} />
                  <span className="text-ui text-foreground">{alert.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pod Utilization */}
          <div className="data-card col-span-2">
            <p className="metric-label mb-4">Pod Utilization</p>
            <table className="w-full text-ui">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Name</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Role</th>
                  <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deals</th>
                  <th className="text-left py-2 font-medium text-muted-foreground text-caption uppercase tracking-wider w-40">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {podMembers.map((m) => (
                  <tr key={m.name} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">{m.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{m.role}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">{m.deals}</td>
                    <td className="py-2"><UtilizationBar value={m.utilization} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RGY Heatmap */}
        <div className="data-card">
          <p className="metric-label mb-4">RGY Health — Deal Heatmap</p>
          <RGYHeatmap data={rgyData} dimensions={rgyDimensions} />
        </div>
      </div>
    </AppLayout>
  );
}
