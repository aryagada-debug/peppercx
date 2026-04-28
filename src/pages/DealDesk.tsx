import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { cn } from "@/lib/utils";

const pipeline = [
  { id: "DD-001", client: "FutureBrand", capability: "SEO+Content", geo: "India", mrr: "₹12.0L", gm: "38.2%", stage: "Under Review", days: 5 },
  { id: "DD-002", client: "QuantumTech", capability: "Creative", geo: "UAE", mrr: "₹8.5L", gm: "42.1%", stage: "L1 Approved", days: 12 },
  { id: "DD-003", client: "MetroMedia", capability: "Content", geo: "US", mrr: "₹18.0L", gm: "35.7%", stage: "Draft", days: 2 },
  { id: "DD-004", client: "DataFirst", capability: "SEO", geo: "India", mrr: "₹6.0L", gm: "45.3%", stage: "L2 Approved", days: 18 },
  { id: "DD-005", client: "GreenCorp", capability: "Content Studio", geo: "India", mrr: "₹9.2L", gm: "31.8%", stage: "Under Review", days: 8 },
];

const stageColor: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  "Under Review": "bg-warning/10 text-warning",
  "L1 Approved": "bg-accent/10 text-accent",
  "L2 Approved": "bg-positive/10 text-positive",
  Active: "bg-positive/10 text-positive",
};

export default function DealDesk() {
  return (
    <AppLayout>
      <div className="px-3 py-4">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">Deal Desk</h1>
        <p className="text-ui text-muted-foreground mb-6">Pre-sales deal structuring, pricing & approval pipeline</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Pipeline Value" value="₹53.7L" suffix="/mo" />
          <MetricCard label="Avg Margin" value="38.6%" />
          <MetricCard label="Avg Cycle Time" value="9.0" suffix="days" />
          <MetricCard label="Win Rate (QTD)" value="72.4%" change={3.1} />
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["ID", "Client", "Capability", "GEO", "MRR", "GM%", "Stage", "Age"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pipeline.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-accent font-medium">{p.id}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{p.client}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.capability}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.geo}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{p.mrr}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{p.gm}</td>
                  <td className="py-3 px-4"><span className={cn("inline-block px-2 py-0.5 rounded-md text-caption font-medium", stageColor[p.stage])}>{p.stage}</span></td>
                  <td className="py-3 px-4 font-mono tabular-nums text-muted-foreground">{p.days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
