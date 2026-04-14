import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

export function RGYHeatmap({ data, dimensions, onRowClick }: RGYHeatmapProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-ui text-muted-foreground">
        No deals to display for this period
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="w-full text-ui" aria-label="RGY Deal Health Heatmap">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal</th>
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Client</th>
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">BOPM</th>
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
                <td className="py-2 pr-4 font-medium text-foreground whitespace-nowrap">{row.deal}</td>
                <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{row.client}</td>
                <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{row.bopm}</td>
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
