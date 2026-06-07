import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarkRGYDimension {
  key: string;
  label: string;
  owner?: string;
  value: string; // "", R, Y, G, NA
}

export interface MarkRGYDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealLabel: string;
  dimensions: MarkRGYDimension[];
  saving?: boolean;
  onSave: (next: MarkRGYDimension[]) => Promise<void> | void;
}

const BUTTONS: { value: string; label: string; active: string }[] = [
  { value: "G",  label: "G", active: "bg-[hsl(95_45%_92%)] text-[hsl(105_75%_18%)] border-[hsl(95_50%_55%)]" },
  { value: "Y",  label: "Y", active: "bg-[hsl(35_90%_92%)] text-[hsl(28_90%_22%)] border-[hsl(35_87%_55%)]" },
  { value: "R",  label: "R", active: "bg-[hsl(0_80%_95%)] text-[hsl(0_60%_30%)] border-[hsl(0_65%_76%)]" },
  { value: "NA", label: "⊘", active: "bg-foreground text-background border-foreground" },
];

const dotColor = (v: string) =>
  v === "G" ? "bg-[hsl(95_50%_55%)]"
  : v === "Y" ? "bg-[hsl(35_87%_55%)]"
  : v === "R" ? "bg-[hsl(0_65%_76%)]"
  : v === "NA" ? "bg-muted-foreground/40"
  : "bg-transparent border border-dashed border-muted-foreground";

/**
 * Walks the user through marking every RGY dimension for a single deal
 * in one modal. Replaces inline per-cell editing in the RGY Health table.
 * Caller is responsible for persisting and for opening the combined
 * issues dialog when any dimension ends up Red.
 */
export function MarkRGYDialog({ open, onOpenChange, dealLabel, dimensions, saving, onSave }: MarkRGYDialogProps) {
  const [local, setLocal] = useState<MarkRGYDimension[]>(dimensions);

  useEffect(() => {
    if (open) setLocal(dimensions);
  }, [open, dimensions]);

  const update = (key: string, value: string) =>
    setLocal(prev => prev.map(d => d.key === key ? { ...d, value } : d));

  const missing = local.filter(d => !d.value).length;
  const reds = local.filter(d => d.value === "R").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark RGY — {dealLabel}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Mark every dimension for this week. Any Red will prompt you to log a combined issue + action plan next.
        </p>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {local.map((dim, i) => (
            <div key={dim.key} className={cn("px-4 py-3", i < local.length - 1 && "border-b border-border")}>
              <div className="flex items-center gap-3">
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColor(dim.value))} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{dim.label}</p>
                  {dim.owner && <p className="text-xs text-muted-foreground leading-tight">{dim.owner}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  {BUTTONS.map(btn => {
                    const isActive = dim.value === btn.value;
                    return (
                      <button
                        key={btn.value}
                        type="button"
                        onClick={() => update(dim.key, btn.value)}
                        className={cn(
                          "w-7 h-7 rounded-full text-xs font-medium border transition-all flex items-center justify-center leading-none",
                          isActive
                            ? btn.active
                            : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                        )}
                        title={btn.value === "NA" ? "Not Required" : btn.value}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {missing > 0
              ? `${missing} dimension${missing === 1 ? "" : "s"} still unmarked`
              : "All dimensions marked"}
          </span>
          {reds > 0 && (
            <span className="text-destructive font-medium">
              {reds} Red — issue form will open after save
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(local)} disabled={saving || missing > 0} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save RGY
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}