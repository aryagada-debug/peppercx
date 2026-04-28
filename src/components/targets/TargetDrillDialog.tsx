import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth } from "date-fns";
import { METRIC_LABELS, attainmentPct, attainmentTone, formatINR, type Metric } from "@/lib/csvTargets";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  metric: Metric | null;
  monthYYYYMM: string;
  dealIdScope?: Set<string>;
}

interface Row {
  deal_id: string;
  deal_name: string;
  account: string;
  target: number;
  actual: number;
}

export function TargetDrillDialog({ open, onOpenChange, metric, monthYYYYMM, dealIdScope }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !metric) return;
    (async () => {
      setLoading(true);
      const iso = format(startOfMonth(new Date(`${monthYYYYMM}-01T00:00:00`)), "yyyy-MM-dd");
      const { data: targets } = await supabase
        .from("deal_financial_targets")
        .select(`deal_id, ${metric}_target, ${metric}_actual`)
        .eq("month", iso);
      const dealIds = (targets || []).map((t: any) => t.deal_id);
      const scoped = dealIdScope
        ? (targets || []).filter((t: any) => dealIdScope.has(t.deal_id))
        : (targets || []);
      const { data: deals } = await supabase
        .from("staffing_deals").select("id, deal_name, account").in("id", dealIds);
      const dealMap = new Map((deals || []).map((d: any) => [d.id, d]));
      const built: Row[] = scoped.map((t: any) => ({
        deal_id: t.deal_id,
        deal_name: dealMap.get(t.deal_id)?.deal_name || t.deal_id,
        account: dealMap.get(t.deal_id)?.account || "—",
        target: Number(t[`${metric}_target`]) || 0,
        actual: Number(t[`${metric}_actual`]) || 0,
      })).sort((a, b) => b.target - a.target);
      setRows(built);
      setLoading(false);
    })();
  }, [open, metric, monthYYYYMM, dealIdScope]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {metric ? METRIC_LABELS[metric] : ""} — {format(new Date(`${monthYYYYMM}-01T00:00:00`), "MMM yyyy")}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No targets recorded for this month.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2 px-2">Deal</th>
                <th className="text-left font-medium py-2 px-2">Account</th>
                <th className="text-right font-medium py-2 px-2">Target</th>
                <th className="text-right font-medium py-2 px-2">Actual</th>
                <th className="text-right font-medium py-2 px-2">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const pct = attainmentPct(r.actual, r.target);
                return (
                  <tr key={r.deal_id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-2 px-2">
                      <Link to={`/deals/${r.deal_id}`} className="text-primary hover:underline font-medium">{r.deal_name}</Link>
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{r.account}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{formatINR(r.target)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{formatINR(r.actual)}</td>
                    <td className={cn("py-2 px-2 text-right font-mono tabular-nums font-semibold", attainmentTone(pct))}>
                      {pct === null ? "—" : `${pct.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}