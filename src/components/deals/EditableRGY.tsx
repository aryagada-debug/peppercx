import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface RGYDimension {
  key: string;
  label: string;
  owner: string;
  value: string;
  planOfAction?: string;
}

export interface RGYIssueDetail {
  id: string;
  summary: string;
  details?: string;
  actionPlan?: string;
  dueDate?: string;
  stage?: string;
  assignee?: string;
}

interface Props {
  dimensions: RGYDimension[];
  onSave: (dimensions: RGYDimension[]) => void;
  issuesByDim?: Record<string, RGYIssueDetail[]>;
  onIssueClick?: (issue: RGYIssueDetail) => void;
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
  {
    value: "NA",
    label: "⊘",
    active: "bg-foreground text-background border-foreground",
    dot: "bg-muted-foreground/40",
  },
  {
    value: "TBU",
    label: "⋯",
    active: "bg-foreground text-background border-dashed border-foreground",
    dot: "bg-transparent border border-dashed border-muted-foreground",
  },
] as const;

const dotColor = (v: string) =>
  v === "G" ? "bg-[hsl(95_50%_55%)]"
  : v === "Y" ? "bg-[hsl(35_87%_55%)]"
  : v === "R" ? "bg-[hsl(0_65%_76%)]"
  : v === "NA" ? "bg-muted-foreground/40"
  : v === "TBU" ? "bg-transparent border border-dashed border-muted-foreground"
  : "bg-muted-foreground/40";

export function EditableRGY({ dimensions, onSave, issuesByDim, onIssueClick }: Props) {
  const [local, setLocal] = useState<RGYDimension[]>(dimensions);

  // Sync local state when parent dimensions change
  useEffect(() => {
    setLocal(dimensions);
  }, [dimensions.map(d => d.value).join(",")]);

  const update = (key: string, value: string) => {
    const next = local.map(d => (d.key === key ? { ...d, value } : d));
    setLocal(next);
    onSave(next); // immediate save — parent decides whether to open issue form
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
                { label: "Not Required (⊘)", color: "bg-muted-foreground/40" },
                { label: "To Be Updated (⋯)", color: "bg-transparent border border-dashed border-muted-foreground" },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={cn("w-2.5 h-2.5 rounded-full", l.color)} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Rows */}
        {local.map((dim, i) => (
          <div
            key={dim.key}
            className={cn(
              "px-5 py-3",
              i < local.length - 1 && "border-b border-border"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Status dot */}
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColor(dim.value))} />

              {/* Label + owner */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">{dim.label}</p>
                <p className="text-xs text-muted-foreground leading-tight">{dim.owner}</p>
              </div>

              {/* Toggle buttons */}
              <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                {RGY_BUTTONS.map(btn => {
                  const isActive = dim.value === btn.value;
                  return (
                    <button
                      key={btn.value}
                      onClick={() => update(dim.key, btn.value)}
                      className={cn(
                        "w-7 h-7 rounded-full text-xs font-medium border transition-all flex items-center justify-center leading-none",
                        isActive
                          ? btn.active
                          : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                      )}
                      title={btn.value === "NA" ? "Not Required" : btn.value === "TBU" ? "To Be Updated" : btn.value}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inline issue context for R/Y dimensions */}
            {(dim.value === "R" || dim.value === "Y") && issuesByDim && issuesByDim[dim.key]?.length > 0 && (
              <div className="mt-2 ml-5 space-y-1.5">
                {issuesByDim[dim.key].map(issue => {
                  const isOpen = issue.stage && issue.stage !== "Done" && issue.stage !== "Dropped";
                  return (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => onIssueClick?.(issue)}
                      className={cn(
                        "w-full text-left rounded-md border px-3 py-2 transition-colors",
                        dim.value === "R"
                          ? "border-[hsl(0_65%_76%)]/50 bg-[hsl(0_80%_97%)]/60 hover:bg-[hsl(0_80%_95%)]"
                          : "border-[hsl(35_87%_55%)]/40 bg-[hsl(35_90%_96%)]/60 hover:bg-[hsl(35_90%_92%)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-medium text-foreground leading-snug">{issue.summary}</p>
                        <span className={cn(
                          "text-[10px] uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded",
                          isOpen ? "bg-foreground/5 text-muted-foreground" : "bg-positive/15 text-positive"
                        )}>
                          {issue.stage || "Open"}
                        </span>
                      </div>
                      {issue.actionPlan && (
                        <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                          <span className="font-medium text-foreground/80">Action: </span>{issue.actionPlan}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        {issue.assignee && <span>· {issue.assignee}</span>}
                        {issue.dueDate && <span>· Due {issue.dueDate}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
