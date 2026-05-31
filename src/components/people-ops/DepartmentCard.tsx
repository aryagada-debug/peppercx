import React from "react";
import { cn } from "@/lib/utils";

export interface DeptRoleSlice {
  name: string;
  count: number;
}

export interface DeptCardData {
  id: string;
  name: string;
  headcount: number;
  avgUtilPct: number;
  mix: { overloaded: number; nearFull: number; healthy: number; under: number }; // counts
  roles: DeptRoleSlice[];
  tbh: number;
  leavers: number;
}

function bucketLabel(pct: number) {
  if (pct > 100) return { label: "Overloaded", tone: "text-destructive" };
  if (pct >= 85) return { label: "Near Full", tone: "text-warning" };
  if (pct >= 30) return { label: "Healthy", tone: "text-positive" };
  return { label: "Under-utilised", tone: "text-info" };
}

export function DepartmentCard({
  data,
  onViewTable,
}: {
  data: DeptCardData;
  onViewTable: () => void;
}) {
  const { mix } = data;
  const total = Math.max(1, mix.overloaded + mix.nearFull + mix.healthy + mix.under);
  const pct = (n: number) => (n / total) * 100;
  const b = bucketLabel(data.avgUtilPct);

  // Top 4 role types by headcount.
  const topRoles = [...data.roles].sort((a, b) => b.count - a.count).slice(0, 4);

  return (
    <div className="border border-border bg-card p-5 flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div className="min-w-0">
          <h3 className="font-medium text-base truncate">{data.name}</h3>
          <p className="text-xs text-muted-foreground">{data.headcount} Personnel</p>
        </div>
        <button
          onClick={onViewTable}
          className="text-primary text-xs font-medium hover:underline whitespace-nowrap"
          type="button"
        >
          View Table
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-[10px] font-medium mb-1.5">
            <span className="text-muted-foreground uppercase tracking-wide">Utilization Mix</span>
            <span className={cn(b.tone)}>{b.label} · {Math.round(data.avgUtilPct)}%</span>
          </div>
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted">
            <div className="bg-destructive" style={{ width: `${pct(mix.overloaded)}%` }} />
            <div className="bg-warning" style={{ width: `${pct(mix.nearFull)}%` }} />
            <div className="bg-positive" style={{ width: `${pct(mix.healthy)}%` }} />
            <div className="bg-info" style={{ width: `${pct(mix.under)}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-4 border-t border-border">
          {topRoles.map((r) => (
            <div key={r.name} className="flex justify-between items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground truncate">{r.name}</span>
              <span className="text-xs font-medium tabular-nums">
                {String(r.count).padStart(2, "0")}
              </span>
            </div>
          ))}
          {data.tbh > 0 && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-info">TBH (Gap)</span>
              <span className="text-xs font-medium text-info tabular-nums">
                {String(data.tbh).padStart(2, "0")}
              </span>
            </div>
          )}
          {data.leavers > 0 && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-destructive">Leavers</span>
              <span className="text-xs font-medium text-destructive tabular-nums">
                {String(data.leavers).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function UtilLegend() {
  const items = [
    { color: "bg-destructive", label: "OVERLOADED (>100%)" },
    { color: "bg-warning", label: "NEAR FULL (85-100%)" },
    { color: "bg-positive", label: "HEALTHY (30-85%)" },
    { color: "bg-info", label: "UNDER-UTILISED (<30%)" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-border">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", i.color)} />
          <span className="text-[10px] text-muted-foreground tracking-wider">{i.label}</span>
        </div>
      ))}
    </div>
  );
}