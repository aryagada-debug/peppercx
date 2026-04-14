import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { RGYStatus, RGYRow } from "@/types/dashboard";

interface RGYHeatmapProps {
  data: RGYRow[];
  dimensions: string[];
  onRowClick?: (row: RGYRow) => void;
  onDealClick?: (dealId: string) => void;
}

const cellColors: Record<RGYStatus, string> = {
  R: "rgy-red",
  G: "rgy-green",
  Y: "rgy-yellow",
  NA: "rgy-na",
};

const statusLabels: Record<RGYStatus, string> = {
  R: "Red",
  G: "Green",
  Y: "Yellow",
  NA: "N/A",
};

const cellLabels: Record<RGYStatus, string> = {
  R: "R",
  G: "G",
  Y: "Y",
  NA: "—",
};

const statusBadgeStyles: Record<string, string> = {
  "Active Deal": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "Deal Disputed": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "New Deal in SLA/PO": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Deal Completed Successfully": "bg-muted text-muted-foreground border-border",
  "Deal Churned / Lost": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const statusShortLabels: Record<string, string> = {
  "Active Deal": "Active",
  "Deal Disputed": "Disputed",
  "New Deal in SLA/PO": "New/SLA",
  "Deal Completed Successfully": "Completed",
  "Deal Churned / Lost": "Churned",
};

export function RGYHeatmap({ data, dimensions, onRowClick, onDealClick }: RGYHeatmapProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-ui text-muted-foreground">
        No deals to display for this period
      </div>
    );
  }

  const showStatus = data.some(r => r.status);

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="w-full text-ui" aria-label="RGY Deal Health Heatmap">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal</th>
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Client</th>
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">BOPM</th>
              {showStatus && (
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Status</th>
              )}
              {dimensions.map(d => (
                <th key={d} className="text-center py-2 px-2 font-medium text-muted-foreground text-caption uppercase tracking-wider whitespace-nowrap">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/50 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-secondary/50"
                )}
                onClick={() => onRowClick?.(row)}
              >
                <td className="py-2 pr-4 whitespace-nowrap">
                  {onDealClick ? (
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline text-left"
                      onClick={(e) => { e.stopPropagation(); onDealClick(row.id); }}
                    >
                      {row.deal}
                    </button>
                  ) : (
                    <span className="font-medium text-foreground">{row.deal}</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{row.client}</td>
                <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{row.bopm}</td>
                {showStatus && (
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 font-medium border",
                        statusBadgeStyles[row.status || ""] || "bg-muted text-muted-foreground border-border"
                      )}
                    >
                      {statusShortLabels[row.status || ""] || row.status || "—"}
                    </Badge>
                  </td>
                )}
                {dimensions.map(d => {
                  const status = (row.dimensions[d] || "NA") as RGYStatus;
                  return (
                    <td key={d} className="py-2 px-2 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold",
                              cellColors[status]
                            )}
                            aria-label={`${d}: ${statusLabels[status]}`}
                          >
                            {cellLabels[status]}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{d} · {statusLabels[status]}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
