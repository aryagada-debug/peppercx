import { AppLayout } from "@/components/layout/AppLayout";
import { useState } from "react";
import { cn } from "@/lib/utils";

const rateCard = [
  { role: "VSD", category: "VSD/BOPM", rate: 1200 },
  { role: "Sr. Group BOPM", category: "VSD/BOPM", rate: 800 },
  { role: "Group BOPM", category: "VSD/BOPM", rate: 600 },
  { role: "Content Strategist", category: "Content", rate: 500 },
  { role: "Senior Writer", category: "Content", rate: 400 },
  { role: "SEO Lead", category: "SEO", rate: 650 },
  { role: "SEO Manager", category: "SEO", rate: 450 },
  { role: "Creative Director", category: "Creative", rate: 900 },
  { role: "Sr. Designer", category: "Creative", rate: 550 },
];

const resources = [
  { role: "Content Strategist", category: "Content", active: true, person: "Sneha P.", count: 1, weeklyHrs: 25, rate: 500 },
  { role: "Senior Writer", category: "Content", active: true, person: "Nisha K.", count: 2, weeklyHrs: 30, rate: 400 },
  { role: "SEO Lead", category: "SEO", active: true, person: "Deepak R.", count: 1, weeklyHrs: 20, rate: 650 },
  { role: "SEO Manager", category: "SEO", active: true, person: "Raj M.", count: 1, weeklyHrs: 15, rate: 450 },
  { role: "Group BOPM", category: "VSD/BOPM", active: true, person: "Rahul S.", count: 1, weeklyHrs: 10, rate: 600 },
];

export default function GM2Calculator() {
  const [mrr] = useState(850000);
  const [duration] = useState(12);

  const totalMonthlyCost = resources.reduce((sum, r) => sum + (r.active ? r.rate * r.weeklyHrs * 4.33 * r.count : 0), 0);
  const gm1Pct = 42.3;
  const gm1Abs = mrr * (gm1Pct / 100);
  const gm2Abs = gm1Abs - totalMonthlyCost;
  const gm2Pct = (gm2Abs / mrr) * 100;

  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">GM2 Margin Calculator</h1>
        <p className="text-ui text-muted-foreground mb-6">Real-time gross margin analysis at deal level</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="data-card">
            <p className="metric-label mb-3">Deal Information</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Customer", "TechCorp India"],
                ["Mandate", "SEO+Content"],
                ["MRR", `₹${(mrr / 100000).toFixed(1)}L`],
                ["Duration", `${duration} months`],
                ["Deal Value", `₹${((mrr * duration) / 10000000).toFixed(2)}Cr`],
                ["GM1%", `${gm1Pct}%`],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-caption text-muted-foreground">{label}</p>
                  <p className="text-ui font-medium text-foreground">{val}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="data-card">
            <p className="metric-label mb-3">Margin Summary</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-caption text-muted-foreground">GM1 Absolute</p>
                <p className="text-subhead font-semibold font-mono tabular-nums text-foreground">₹{(gm1Abs / 100000).toFixed(1)}L</p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">GM2 Cost (Monthly)</p>
                <p className="text-subhead font-semibold font-mono tabular-nums text-foreground">₹{(totalMonthlyCost / 100000).toFixed(1)}L</p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">GM2 Absolute</p>
                <p className={cn("text-subhead font-semibold font-mono tabular-nums", gm2Abs > 0 ? "text-positive" : "text-destructive")}>₹{(gm2Abs / 100000).toFixed(1)}L</p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">GM2%</p>
                <p className={cn("text-subhead font-semibold font-mono tabular-nums", gm2Pct > 20 ? "text-positive" : gm2Pct > 10 ? "text-warning" : "text-destructive")}>{gm2Pct.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Role", "Category", "Person", "Count", "Hrs/Wk", "Rate (₹/hr)", "Monthly Cost"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map(r => (
                <tr key={r.role} className="border-b border-border/50">
                  <td className="py-3 px-4 font-medium text-foreground">{r.role}</td>
                  <td className="py-3 px-4 text-muted-foreground">{r.category}</td>
                  <td className="py-3 px-4 text-foreground">{r.person}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{r.count}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{r.weeklyHrs}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">₹{r.rate}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">₹{Math.round(r.rate * r.weeklyHrs * 4.33 * r.count).toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-secondary/30">
                <td colSpan={6} className="py-3 px-4 font-semibold text-foreground text-right">Total Monthly Cost</td>
                <td className="py-3 px-4 font-mono tabular-nums font-semibold text-foreground">₹{Math.round(totalMonthlyCost).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
