import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { cn } from "@/lib/utils";

const channels = [
  { name: "#techcorp-seo-content", deal: "D-2024-047", score: 78, staffMatch: "4/5", dailyUpdates: "4/5", weeklyInt: "3/4", weeklyCust: "3/4" },
  { name: "#finserve-content", deal: "D-2024-041", score: 42, staffMatch: "3/5", dailyUpdates: "1/5", weeklyInt: "2/4", weeklyCust: "1/4" },
  { name: "#medianext-creative", deal: "D-2024-038", score: 85, staffMatch: "3/3", dailyUpdates: "5/5", weeklyInt: "4/4", weeklyCust: "3/4" },
  { name: "#retailmax-seo", deal: "D-2024-035", score: 35, staffMatch: "2/4", dailyUpdates: "1/5", weeklyInt: "1/4", weeklyCust: "1/4" },
  { name: "#cloudfirst-content", deal: "D-2024-033", score: 92, staffMatch: "5/5", dailyUpdates: "5/5", weeklyInt: "4/4", weeklyCust: "4/4" },
  { name: "#eduprime-marketing", deal: "D-2024-029", score: 61, staffMatch: "2/3", dailyUpdates: "3/5", weeklyInt: "2/4", weeklyCust: "2/4" },
];

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "text-positive" : score >= 50 ? "text-warning" : "text-destructive";
  return <span className={cn("font-mono tabular-nums font-semibold", color)}>{score}</span>;
}

export default function SlackHealth() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">Slack Health</h1>
        <p className="text-ui text-muted-foreground mb-6">Automated channel monitoring — {channels.length} channels tracked</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Avg Health Score" value="65.5" suffix="/ 100" />
          <MetricCard label="Well Run (≥75)" value="2" />
          <MetricCard label="Needs Attention" value="2" />
          <MetricCard label="Critical (<50)" value="2" />
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Channel", "Deal", "Score", "Staff Match", "Daily (7d)", "Weekly Int", "Weekly Cust"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map(c => (
                <tr key={c.name} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{c.name}</td>
                  <td className="py-3 px-4 font-mono text-accent">{c.deal}</td>
                  <td className="py-3 px-4"><ScoreBadge score={c.score} /></td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.staffMatch}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.dailyUpdates}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.weeklyInt}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.weeklyCust}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
