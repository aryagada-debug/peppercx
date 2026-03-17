import { AppLayout } from "@/components/layout/AppLayout";
import { useState } from "react";

const deals = ["D-2024-047 • TechCorp", "D-2024-041 • FinServe", "D-2024-038 • MediaNext"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const initialData = [
  { deal: deals[0], hours: [4, 4, 3, 4, 4] },
  { deal: deals[1], hours: [3, 2, 3, 3, 2] },
  { deal: deals[2], hours: [2, 2, 2, 2, 2] },
];

export default function Timesheets() {
  const [data] = useState(initialData);
  const totalByDay = days.map((_, di) => data.reduce((sum, d) => sum + d.hours[di], 0));
  const grandTotal = totalByDay.reduce((a, b) => a + b, 0);

  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">My Timesheet</h1>
        <p className="text-ui text-muted-foreground mb-6">Week of March 10–14, 2026</p>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal</th>
                {days.map(d => <th key={d} className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider w-20">{d}</th>)}
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.deal} className="border-b border-border/50">
                  <td className="py-3 px-4 text-foreground font-medium">{row.deal}</td>
                  {row.hours.map((h, i) => (
                    <td key={i} className="py-3 px-4 text-right font-mono tabular-nums text-foreground">{h}</td>
                  ))}
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-foreground">{row.hours.reduce((a, b) => a + b, 0)}</td>
                </tr>
              ))}
              <tr className="bg-secondary/30">
                <td className="py-3 px-4 font-semibold text-foreground">Total</td>
                {totalByDay.map((t, i) => (
                  <td key={i} className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-foreground">{t}</td>
                ))}
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-foreground">{grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="data-card flex-1">
            <p className="metric-label">Allocated</p>
            <p className="text-subhead font-semibold text-foreground mt-1 font-mono tabular-nums">40 hrs/week</p>
          </div>
          <div className="data-card flex-1">
            <p className="metric-label">Logged</p>
            <p className="text-subhead font-semibold text-foreground mt-1 font-mono tabular-nums">{grandTotal} hrs</p>
          </div>
          <div className="data-card flex-1">
            <p className="metric-label">Variance</p>
            <p className="text-subhead font-semibold text-destructive mt-1 font-mono tabular-nums">{grandTotal - 40} hrs</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
