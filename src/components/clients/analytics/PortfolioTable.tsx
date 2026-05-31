import { useMemo, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import type { PortfolioRow } from "@/lib/dealAnalytics";
import { totalRow } from "@/lib/dealAnalytics";
import { ChevronDown, ChevronUp } from "lucide-react";

type SortKey = keyof Pick<
  PortfolioRow,
  "label" | "deals" | "retainerDeals" | "nonRetainerDeals" | "mrr" | "retainerValue" | "nonRetainerValue" | "totalValue"
>;

interface Props {
  title: string;
  rows: PortfolioRow[];
  rowLabel: string;
  onRowClick?: (row: PortfolioRow) => void;
  emptyHint?: string;
}

export function PortfolioTable({ title, rows, rowLabel, onRowClick, emptyHint }: Props) {
  const { format } = useCurrency();
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "totalValue", dir: -1 });
  const grand = useMemo(() => totalRow(rows), [rows]);
  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = (a as any)[sort.k];
      const bv = (b as any)[sort.k];
      if (typeof av === "string") return av.localeCompare(String(bv)) * sort.dir;
      return ((Number(av) || 0) - (Number(bv) || 0)) * sort.dir;
    });
    return arr;
  }, [rows, sort]);

  const setSortKey = (k: SortKey) =>
    setSort((s) => (s.k === k ? { k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { k, dir: -1 }));

  const Th = ({ k, children, align = "right" }: { k: SortKey; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      onClick={() => setSortKey(k)}
      className={cn(
        "px-2 py-1.5 cursor-pointer select-none text-[10.5px] uppercase tracking-wide text-muted-foreground font-medium",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {sort.k === k ? (sort.dir === -1 ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />) : null}
      </span>
    </th>
  );

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h3 className="text-[12.5px] font-medium text-foreground">{title}</h3>
        <span className="text-[10.5px] text-muted-foreground tabular-nums">{rows.length} {rows.length === 1 ? "row" : "rows"}</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <Th k="label" align="left">{rowLabel}</Th>
              <Th k="deals"># Deals</Th>
              <Th k="retainerDeals">Retainer #</Th>
              <Th k="nonRetainerDeals">Non-Ret. #</Th>
              <Th k="mrr">MRR</Th>
              <Th k="retainerValue">Retainer Value</Th>
              <Th k="nonRetainerValue">Non-Retainer Value</Th>
              <Th k="totalValue">Total Value</Th>
              <th className="px-2 py-1.5 text-right text-[10.5px] uppercase tracking-wide text-muted-foreground font-medium">% Share</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground text-[12px]">{emptyHint || "No deals in scope."}</td></tr>
            )}
            {sorted.map((r) => {
              const share = grand.totalValue > 0 ? (r.totalValue / grand.totalValue) * 100 : 0;
              return (
                <tr
                  key={r.key}
                  onClick={() => onRowClick?.(r)}
                  className={cn(
                    "border-b border-border/60 last:border-b-0",
                    onRowClick && "cursor-pointer hover:bg-muted/40",
                  )}
                >
                  <td className="px-2 py-1.5 text-left text-foreground font-medium">{r.label}</td>
                  <td className="px-2 py-1.5 text-right">{r.deals}</td>
                  <td className="px-2 py-1.5 text-right text-positive">{r.retainerDeals}</td>
                  <td className="px-2 py-1.5 text-right text-warning">{r.nonRetainerDeals}</td>
                  <td className="px-2 py-1.5 text-right">{format(r.mrr)}</td>
                  <td className="px-2 py-1.5 text-right">{format(r.retainerValue)}</td>
                  <td className="px-2 py-1.5 text-right">{format(r.nonRetainerValue)}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{format(r.totalValue)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{share.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="bg-muted/40 border-t border-border">
              <tr>
                <td className="px-2 py-1.5 text-left font-medium">Grand Total</td>
                <td className="px-2 py-1.5 text-right font-medium">{grand.deals}</td>
                <td className="px-2 py-1.5 text-right font-medium">{grand.retainerDeals}</td>
                <td className="px-2 py-1.5 text-right font-medium">{grand.nonRetainerDeals}</td>
                <td className="px-2 py-1.5 text-right font-medium">{format(grand.mrr)}</td>
                <td className="px-2 py-1.5 text-right font-medium">{format(grand.retainerValue)}</td>
                <td className="px-2 py-1.5 text-right font-medium">{format(grand.nonRetainerValue)}</td>
                <td className="px-2 py-1.5 text-right font-medium">{format(grand.totalValue)}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">100.0%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}