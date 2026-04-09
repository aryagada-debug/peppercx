interface UtilizationBarProps {
  value: number;
}

export function UtilizationBar({ value }: UtilizationBarProps) {
  const color = value < 60 ? "bg-destructive" : value <= 85 ? "bg-positive" : "bg-warning";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-sm overflow-hidden min-w-[100px] max-w-[160px]">
        <div className={`h-full rounded-sm ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-caption font-mono tabular-nums text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export function UtilizationLegend() {
  return (
    <div className="flex items-center gap-4 mt-3 text-caption text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-destructive" /> &lt; 60% Under</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-positive" /> 60–85% Optimal</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warning" /> &gt; 85% Over</span>
    </div>
  );
}
