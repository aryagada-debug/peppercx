import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { cn } from "@/lib/utils";

const targets = [
  { vsd: "Anirudh", target: "₹72.0L", actual: "₹65.6L", attainment: 91.1, rating: "Good" },
  { vsd: "Priya", target: "₹58.0L", actual: "₹55.2L", attainment: 95.2, rating: "Good" },
  { vsd: "Vikram", target: "₹45.0L", actual: "₹37.8L", attainment: 84.0, rating: "Average" },
  { vsd: "Sneha", target: "₹38.0L", actual: "₹29.6L", attainment: 77.9, rating: "Poor" },
  { vsd: "Deepak", target: "₹52.0L", actual: "₹48.9L", attainment: 94.0, rating: "Good" },
];

const ratingColor: Record<string, string> = {
  Good: "text-positive",
  Average: "text-warning",
  Poor: "text-destructive",
};

export default function Targets() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">Target Setting & Attainment</h1>
        <p className="text-ui text-muted-foreground mb-6">March 2026 — Monthly targets by VSD</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Target" value="₹2.65Cr" />
          <MetricCard label="Total Actual" value="₹2.37Cr" />
          <MetricCard label="Overall Attainment" value="89.4%" change={-1.8} />
          <MetricCard label="VSDs On-Track" value="3/5" />
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["VSD", "Target", "Actual", "Attainment", "Rating"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {targets.map(t => (
                <tr key={t.vsd} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{t.vsd}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-muted-foreground">{t.target}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{t.actual}</td>
                  <td className="py-3 px-4 font-mono tabular-nums"><span className={cn(ratingColor[t.rating])}>{t.attainment.toFixed(1)}%</span></td>
                  <td className="py-3 px-4"><span className={cn("font-medium", ratingColor[t.rating])}>{t.rating}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
