import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { useVsdTargets } from "@/hooks/useFinanceTargets";
import { METRICS, METRIC_LABELS, attainmentPct, attainmentTone, formatINR } from "@/lib/csvTargets";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  monthYYYYMM: string;
}

export function FinanceTargetsCard({ monthYYYYMM }: Props) {
  const { totals, loading } = useVsdTargets(monthYYYYMM);
  const monthLabel = format(new Date(`${monthYYYYMM}-01T00:00:00`), "MMM yyyy");
  const allZero = METRICS.every((m) => totals[m].target === 0 && totals[m].actual === 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Finance Targets — {monthLabel}
          </CardTitle>
          <Link to="/targets" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {METRICS.map((m) => (
              <div key={m} className="rounded-md border border-border p-3 animate-pulse h-20 bg-muted/30" />
            ))}
          </div>
        ) : allZero ? (
          <p className="text-xs text-muted-foreground">
            No targets uploaded for {monthLabel}. <Link to="/targets" className="text-primary hover:underline">Upload now →</Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {METRICS.map((m) => {
              const t = totals[m];
              const pct = attainmentPct(t.actual, t.target);
              return (
                <div key={m} className="rounded-md border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{METRIC_LABELS[m]}</p>
                  <p className="text-base font-semibold font-mono tabular-nums text-foreground mt-1">
                    {formatINR(t.actual)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                    of {formatINR(t.target)}
                  </p>
                  <p className={cn("text-xs font-semibold mt-0.5 font-mono tabular-nums", attainmentTone(pct))}>
                    {pct === null ? "—" : `${pct.toFixed(1)}%`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}