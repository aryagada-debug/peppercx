import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { cn } from "@/lib/utils";
import { useSlackHealth } from "@/hooks/queries/useSlackHealth";
import { Skeleton } from "@/components/ui/skeleton";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "text-positive" : score >= 50 ? "text-warning" : "text-destructive";
  return <span className={cn("font-mono tabular-nums font-semibold", color)}>{score}</span>;
}

export default function SlackHealth() {
  const { data: channels = [], isLoading } = useSlackHealth();

  const avgScore = channels.length
    ? (channels.reduce((s, c) => s + c.score, 0) / channels.length).toFixed(1)
    : "—";
  const wellRun = channels.filter((c) => c.score >= 75).length;
  const needsAttention = channels.filter((c) => c.score >= 50 && c.score < 75).length;
  const critical = channels.filter((c) => c.score < 50).length;

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">Slack Health</h1>
        <p className="text-ui text-muted-foreground mb-6">
          Automated channel monitoring — {isLoading ? "loading…" : `${channels.length} channels tracked`}
        </p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Avg Health Score" value={String(avgScore)} suffix="/ 100" />
          <MetricCard label="Well Run (≥75)" value={String(wellRun)} />
          <MetricCard label="Needs Attention" value={String(needsAttention)} />
          <MetricCard label="Critical (<50)" value={String(critical)} />
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
              {isLoading && (
                <tr><td colSpan={7} className="p-4"><Skeleton className="h-20 w-full" /></td></tr>
              )}
              {!isLoading && channels.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No Slack channels connected to any deal yet. Link a channel from a deal's detail page to get started.
                </td></tr>
              )}
              {channels.map(c => (
                <tr key={c.channelId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{c.channelName}</td>
                  <td className="py-3 px-4 font-mono text-accent">{c.dealCode}</td>
                  <td className="py-3 px-4"><ScoreBadge score={c.score} /></td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.staffMatch}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.daily}</td>
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
