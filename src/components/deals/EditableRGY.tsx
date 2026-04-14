import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface RGYDimension {
  key: string;
  label: string;
  owner: string;
  value: string;
  planOfAction?: string;
}

interface Props {
  dimensions: RGYDimension[];
  onSave: (dimensions: RGYDimension[]) => void;
}

const RGY_BUTTONS = [
  {
    value: "G",
    label: "G",
    active: "bg-[hsl(95_45%_92%)] text-[hsl(105_75%_18%)] border-[hsl(95_50%_55%)]",
    dot: "bg-[hsl(95_50%_55%)]",
  },
  {
    value: "Y",
    label: "Y",
    active: "bg-[hsl(35_90%_92%)] text-[hsl(28_90%_22%)] border-[hsl(35_87%_55%)]",
    dot: "bg-[hsl(35_87%_55%)]",
  },
  {
    value: "R",
    label: "R",
    active: "bg-[hsl(0_80%_95%)] text-[hsl(0_60%_30%)] border-[hsl(0_65%_76%)]",
    dot: "bg-[hsl(0_65%_76%)]",
  },
] as const;

const dotColor = (v: string) =>
  v === "G" ? "bg-[hsl(95_50%_55%)]" : v === "Y" ? "bg-[hsl(35_87%_55%)]" : "bg-[hsl(0_65%_76%)]";

export function EditableRGY({ dimensions, onSave }: Props) {
  const [local, setLocal] = useState<RGYDimension[]>(dimensions);
  const [dirty, setDirty] = useState(false);

  const update = (key: string, value: string) => {
    setLocal(prev => prev.map(d => (d.key === key ? { ...d, value } : d)));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(local);
    setDirty(false);
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        RGY Health Status
      </p>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header with legend */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Health Status</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {[
                { label: "Green", color: "bg-[hsl(95_50%_55%)]" },
                { label: "Yellow", color: "bg-[hsl(35_87%_55%)]" },
                { label: "Red", color: "bg-[hsl(0_65%_76%)]" },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={cn("w-2.5 h-2.5 rounded-full", l.color)} />
                  {l.label}
                </span>
              ))}
            </div>
            {dirty && (
              <button
                onClick={handleSave}
                className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            )}
          </div>
        </div>

        {/* Rows */}
        {local.map((dim, i) => (
          <div
            key={dim.key}
            className={cn(
              "flex items-center gap-3 px-5 py-3",
              i < local.length - 1 && "border-b border-border"
            )}
          >
            {/* Status dot */}
            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColor(dim.value))} />

            {/* Label + owner */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">{dim.label}</p>
              <p className="text-xs text-muted-foreground leading-tight">{dim.owner}</p>
            </div>

            {/* Toggle buttons */}
            <div className="flex gap-1.5 shrink-0">
              {RGY_BUTTONS.map(btn => {
                const isActive = dim.value === btn.value;
                return (
                  <button
                    key={btn.value}
                    onClick={() => update(dim.key, btn.value)}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-medium border transition-all",
                      isActive
                        ? btn.active
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    )}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
