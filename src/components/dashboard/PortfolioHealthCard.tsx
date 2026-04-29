import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoreOutput } from "@/lib/portfolioScore";

interface Props {
  current: ScoreOutput;
  previousScore?: number | null;
  periodLabel?: string;
  comparisonLabel?: string;
}

export function PortfolioHealthCard({ current, previousScore, periodLabel = "This period", comparisonLabel = "vs last period" }: Props) {
  const delta = previousScore == null ? null : current.score - previousScore;
  const trendIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const deltaTone =
    delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-positive" : "text-destructive";

  const ringTone =
    current.bandTone === "positive"
      ? "ring-positive/30 bg-positive/5"
      : current.bandTone === "warning"
        ? "ring-warning/30 bg-warning/5"
        : "ring-destructive/30 bg-destructive/5";

  const letterTone =
    current.bandTone === "positive"
      ? "text-positive"
      : current.bandTone === "warning"
        ? "text-warning"
        : "text-destructive";

  return (
    <div className={cn("rounded-2xl border p-5 ring-1", ringTone)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Portfolio health · {periodLabel}</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-5xl font-semibold tabular-nums tracking-tight text-foreground leading-none">{current.score}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
            <span className={cn("text-2xl font-semibold leading-none", letterTone)}>{current.letter}</span>
            <span className={cn(
              "ml-2 px-2 py-0.5 rounded-md text-xs font-medium",
              current.bandTone === "positive" && "bg-positive/15 text-positive",
              current.bandTone === "warning" && "bg-warning/15 text-warning",
              current.bandTone === "destructive" && "bg-destructive/15 text-destructive",
            )}>
              {current.band}
            </span>
          </div>
          {delta !== null && (
            <div className={cn("mt-2 inline-flex items-center gap-1.5 text-sm font-medium", deltaTone)}>
              <TrendIcon className="h-4 w-4" />
              <span className="tabular-nums">{delta > 0 ? "+" : ""}{delta} pts</span>
              <span className="text-muted-foreground font-normal">{comparisonLabel}</span>
              {previousScore != null && (
                <span className="text-muted-foreground font-normal">· was {previousScore}</span>
              )}
            </div>
          )}
        </div>

        {/* Donut */}
        <ScoreDonut value={current.score} tone={current.bandTone} />
      </div>
    </div>
  );
}

function ScoreDonut({ value, tone }: { value: number; tone: "positive" | "warning" | "destructive" }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const stroke =
    tone === "positive" ? "hsl(var(--positive))" : tone === "warning" ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" className="shrink-0">
      <circle cx="46" cy="46" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
      <circle
        cx="46" cy="46" r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 46 46)"
      />
      <text x="46" y="51" textAnchor="middle" className="fill-foreground text-sm font-semibold tabular-nums">{value}</text>
    </svg>
  );
}
