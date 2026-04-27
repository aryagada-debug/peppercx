import { useState, Fragment } from "react";
import { format } from "date-fns";
import { Upload, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useVsdTargets, useDealTargets } from "@/hooks/useFinanceTargets";
import { TargetsUploadDialog } from "@/components/targets/TargetsUploadDialog";
import { DealTargetsTable } from "@/components/targets/DealTargetsTable";
import {
  METRICS, METRIC_LABELS, attainmentPct, attainmentTone, formatINR,
} from "@/lib/csvTargets";

export default function Targets() {
  const { isAdmin } = useUserRole();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [uploadOpen, setUploadOpen] = useState(false);
  const { rows: vsdRows, totals, loading, reload } = useVsdTargets(month);
  const { reload: reloadDeal } = useDealTargets(month);
  const monthLabel = format(new Date(`${month}-01T00:00:00`), "MMMM yyyy");

  const onUploaded = () => { reload(); reloadDeal(); };

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-subhead font-semibold tracking-tight text-foreground">Target Setting & Attainment</h1>
            <p className="text-ui text-muted-foreground mt-1">{monthLabel} — Contraction, Delivery, Invoicing, Receivables</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangeSelector value={month} onChange={setMonth} />
            {isAdmin && (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload CSV
              </Button>
            )}
          </div>
        </div>

        {/* KPI tiles per metric */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {METRICS.map((m) => {
            const t = totals[m];
            const pct = attainmentPct(t.actual, t.target);
            return (
              <div key={m} className="data-card">
                <p className="metric-label">{METRIC_LABELS[m]}</p>
                <p className="text-2xl font-semibold font-mono tabular-nums text-foreground mt-1">
                  {formatINR(t.actual)}
                </p>
                <p className="text-xs text-muted-foreground font-mono tabular-nums">
                  Target {formatINR(t.target)}
                </p>
                <p className={cn("text-sm font-semibold mt-1 font-mono tabular-nums", attainmentTone(pct))}>
                  {pct === null ? "—" : `${pct.toFixed(1)}% attained`}
                </p>
              </div>
            );
          })}
        </div>

        <Tabs defaultValue="vsd">
          <TabsList>
            <TabsTrigger value="vsd">By VSD</TabsTrigger>
            <TabsTrigger value="deal">By Deal</TabsTrigger>
          </TabsList>

          <TabsContent value="vsd" className="pt-4">
            <div className="data-card p-0 overflow-hidden">
              {loading ? (
                <div className="h-48 bg-muted/30 animate-pulse" />
              ) : vsdRows.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-ui text-muted-foreground mb-3">
                    No VSD targets for {monthLabel}.
                  </p>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload your first month
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-ui">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th rowSpan={2} className="text-left py-2 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider sticky left-0 bg-secondary/30">VSD</th>
                        {METRICS.map((m) => (
                          <th key={m} colSpan={3} className="text-center py-2 px-2 font-medium text-muted-foreground text-caption uppercase tracking-wider border-l border-border">
                            {METRIC_LABELS[m]}
                          </th>
                        ))}
                      </tr>
                      <tr className="border-b border-border bg-secondary/30">
                        {METRICS.map((m) => (
                          <Fragment key={m}>
                            <th className="text-right py-1.5 pr-2 pl-2 font-medium text-muted-foreground text-[10px] uppercase border-l border-border">Target</th>
                            <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase">Actual</th>
                            <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase">Attain%</th>
                          </Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vsdRows.map((r) => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-foreground sticky left-0 bg-card">{r.vsd}</td>
                          {METRICS.map((m) => {
                            const tgt = (r as any)[`${m}_target`] as number;
                            const act = (r as any)[`${m}_actual`] as number;
                            const pct = attainmentPct(act, tgt);
                            return (
                              <Fragment key={m}>
                                <td className="text-right py-2.5 pr-2 pl-2 font-mono tabular-nums text-muted-foreground border-l border-border/50">{formatINR(tgt)}</td>
                                <td className="text-right py-2.5 px-2 font-mono tabular-nums text-foreground">{formatINR(act)}</td>
                                <td className={cn("text-right py-2.5 px-2 font-mono tabular-nums font-semibold", attainmentTone(pct))}>
                                  {pct === null ? "—" : `${pct.toFixed(1)}%`}
                                </td>
                              </Fragment>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="bg-secondary/40 font-semibold">
                        <td className="py-2.5 px-3 sticky left-0 bg-secondary/40">Total</td>
                        {METRICS.map((m) => {
                          const t = totals[m];
                          const pct = attainmentPct(t.actual, t.target);
                          return (
                            <Fragment key={m}>
                              <td className="text-right py-2.5 pr-2 pl-2 font-mono tabular-nums text-foreground border-l border-border/50">{formatINR(t.target)}</td>
                              <td className="text-right py-2.5 px-2 font-mono tabular-nums text-foreground">{formatINR(t.actual)}</td>
                              <td className={cn("text-right py-2.5 px-2 font-mono tabular-nums", attainmentTone(pct))}>
                                {pct === null ? "—" : `${pct.toFixed(1)}%`}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="deal" className="pt-4">
            <DealTargetsTable monthYYYYMM={month} title={`All Deals — ${monthLabel}`} />
          </TabsContent>
        </Tabs>

        <TargetsUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={onUploaded} />
      </div>
    </AppLayout>
  );
}
