import { useEffect, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDealTargets, type DealTargetRecord } from "@/hooks/useFinanceTargets";
import { METRICS, METRIC_LABELS, attainmentPct, attainmentTone, formatINR } from "@/lib/csvTargets";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  monthYYYYMM: string;
  dealIds?: string[]; // if provided, filter to these deals (Home view)
  title?: string;
  maxRows?: number;
}

export function DealTargetsTable({ monthYYYYMM, dealIds, title, maxRows }: Props) {
  const { rows, loading } = useDealTargets(monthYYYYMM);
  const [dealNames, setDealNames] = useState<Record<string, { name: string; account: string }>>({});
  const monthLabel = format(new Date(`${monthYYYYMM}-01T00:00:00`), "MMM yyyy");

  const filtered: DealTargetRecord[] = dealIds
    ? rows.filter((r) => dealIds.includes(r.deal_id))
    : rows;
  const display = maxRows ? filtered.slice(0, maxRows) : filtered;

  useEffect(() => {
    const ids = display.map((r) => r.deal_id);
    if (!ids.length) return;
    supabase.from("staffing_deals").select("id, deal_name, account").in("id", ids).then(({ data }) => {
      const map: Record<string, { name: string; account: string }> = {};
      (data || []).forEach((d: any) => { map[d.id] = { name: d.deal_name || d.id, account: d.account || "" }; });
      setDealNames(map);
    });
  }, [display.map((r) => r.deal_id).join("|")]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" /> {title || `Deal Targets — ${monthLabel}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 bg-muted/30 rounded-md animate-pulse" />
        ) : display.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No deal targets for {monthLabel}. <Link to="/targets" className="text-primary hover:underline">Upload now →</Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th rowSpan={2} className="text-left py-2 pr-3 font-medium text-muted-foreground uppercase tracking-wider text-[10px] sticky left-0 bg-card">Deal Name</th>
                  <th rowSpan={2} className="text-left py-2 pr-3 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Client Name</th>
                  {METRICS.map((m) => (
                    <th key={m} colSpan={3} className="text-center py-1.5 px-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px] border-l border-border">
                      {METRIC_LABELS[m]}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  {METRICS.map((m) => (
                    <Fragment key={m}>
                      <th className="text-right py-1.5 pr-2 pl-2 font-medium text-muted-foreground text-[10px] border-l border-border">Tgt</th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-[10px]">Act</th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-[10px]">%</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-2 pr-3 sticky left-0 bg-card">
                      <Link to={`/deals/${r.deal_id}`} className="font-medium text-foreground hover:text-primary">
                        {dealNames[r.deal_id]?.name || r.deal_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[200px]" title={dealNames[r.deal_id]?.account || ""}>
                      {dealNames[r.deal_id]?.account || "—"}
                    </td>
                    {METRICS.map((m) => {
                      const tgt = r[`${m}_target` as const] as number;
                      const act = r[`${m}_actual` as const] as number;
                      const pct = attainmentPct(act, tgt);
                      return (
                        <Fragment key={m}>
                          <td className="text-right py-2 pr-2 pl-2 font-mono tabular-nums text-muted-foreground border-l border-border/50">{formatINR(tgt)}</td>
                          <td className="text-right py-2 px-2 font-mono tabular-nums text-foreground">{formatINR(act)}</td>
                          <td className={cn("text-right py-2 px-2 font-mono tabular-nums font-semibold", attainmentTone(pct))}>
                            {pct === null ? "—" : `${pct.toFixed(0)}%`}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {maxRows && filtered.length > maxRows && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Showing {maxRows} of {filtered.length} deals. <Link to="/targets" className="text-primary hover:underline">View all →</Link>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}