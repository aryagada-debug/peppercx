import { cn } from "@/lib/utils";

type RGYValue = "R" | "G" | "Y" | "NA";

interface RGYHeatmapProps {
  data: {
    deal: string;
    client: string;
    dimensions: Record<string, RGYValue>;
  }[];
  dimensions: string[];
}

const cellColors: Record<RGYValue, string> = {
  R: "rgy-red",
  G: "rgy-green",
  Y: "rgy-yellow",
  NA: "rgy-na",
};

const cellLabels: Record<RGYValue, string> = {
  R: "R",
  G: "G",
  Y: "Y",
  NA: "—",
};

export function RGYHeatmap({ data, dimensions }: RGYHeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-ui">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal</th>
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Client</th>
            {dimensions.map(d => (
              <th key={d} className="text-center py-2 px-2 font-medium text-muted-foreground text-caption uppercase tracking-wider whitespace-nowrap">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
              <td className="py-2 pr-4 font-medium text-foreground whitespace-nowrap">{row.deal}</td>
              <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{row.client}</td>
              {dimensions.map(d => (
                <td key={d} className="py-2 px-2 text-center">
                  <span className={cn(
                    "inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold",
                    cellColors[row.dimensions[d] || "NA"]
                  )}>
                    {cellLabels[row.dimensions[d] || "NA"]}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
