import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { cn } from "@/lib/utils";

const revenueData = [
  { deal: "D-2024-047", client: "TechCorp India", serviceLine: "SEO+Content", mrr: "₹8.5L", recognized: "₹8.2L", pending: "₹0.3L", status: "G" },
  { deal: "D-2024-041", client: "FinServe Ltd", serviceLine: "Content", mrr: "₹12.0L", recognized: "₹9.8L", pending: "₹2.2L", status: "R" },
  { deal: "D-2024-038", client: "MediaNext", serviceLine: "Creative", mrr: "₹5.2L", recognized: "₹5.2L", pending: "—", status: "G" },
  { deal: "D-2024-035", client: "RetailMax", serviceLine: "SEO", mrr: "₹3.0L", recognized: "₹2.1L", pending: "₹0.9L", status: "R" },
  { deal: "D-2024-033", client: "CloudFirst", serviceLine: "SEO+Content", mrr: "₹15.0L", recognized: "₹14.5L", pending: "₹0.5L", status: "G" },
  { deal: "D-2024-029", client: "EduPrime", serviceLine: "Content", mrr: "₹6.8L", recognized: "₹6.0L", pending: "₹0.8L", status: "Y" },
];

const rgyBadge: Record<string, string> = { G: "rgy-green", R: "rgy-red", Y: "rgy-yellow" };

export default function Revenue() {
  return (
    <AppLayout>
      <div className="px-3 py-4">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">Revenue Tracker</h1>
        <p className="text-ui text-muted-foreground mb-6">Deal-level revenue recognition — March 2026</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total MRR" value="₹1.82Cr" change={7.14} />
          <MetricCard label="Recognized (MTD)" value="₹1.58Cr" />
          <MetricCard label="Pending" value="₹24.0L" />
          <MetricCard label="Collection Rate" value="87.6%" change={-2.3} />
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Deal", "Client", "Service", "MRR", "Recognized", "Pending", "Status"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {revenueData.map(r => (
                <tr key={r.deal} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-accent font-medium">{r.deal}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{r.client}</td>
                  <td className="py-3 px-4 text-muted-foreground">{r.serviceLine}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{r.mrr}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{r.recognized}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{r.pending}</td>
                  <td className="py-3 px-4"><span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold", rgyBadge[r.status])}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
