import React from "react";
import { cn } from "@/lib/utils";

interface Tile {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "positive" | "warning" | "destructive" | "info";
}

const toneClass: Record<NonNullable<Tile["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-positive",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
};

export function PeopleOpsAnalyticsStrip({ tiles }: { tiles: Tile[] }) {
  return (
    <div
      className="grid border border-border bg-border rounded-sm overflow-hidden"
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, gap: "1px" }}
    >
      {tiles.map((t) => (
        <div key={t.label} className="bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {t.label}
          </p>
          <p className={cn("text-xl font-medium mt-1 tabular-nums", toneClass[t.tone ?? "default"])}>
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}