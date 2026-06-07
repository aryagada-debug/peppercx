import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface RGYStatusBarProps {
  dims: { key: string; label: string; value: string }[];
  /** True if any open `[RGY Health]` task exists for this deal's current week */
  hasOpenIssue: boolean;
  /** Open the combined issues dialog in create/review mode */
  onReview: () => void;
  /** Open the combined issues dialog in edit mode (pre-filled) */
  onEdit: () => void;
  className?: string;
}

/**
 * One-line status strip that summarises RGY health for the current week and
 * surfaces a single CTA to open the combined Issues dialog. Replaces the
 * per-click pop-up on dimension changes.
 */
export function RGYStatusBar({ dims, hasOpenIssue, onReview, onEdit, className }: RGYStatusBarProps) {
  let g = 0, y = 0, r = 0, na = 0, tbu = 0;
  dims.forEach(d => {
    if (d.value === "G") g++;
    else if (d.value === "Y") y++;
    else if (d.value === "R") r++;
    else if (d.value === "NA") na++;
    else tbu++;
  });
  const reds = dims.filter(d => d.value === "R").map(d => d.label);
  const yellows = dims.filter(d => d.value === "Y").map(d => d.label);
  const nonGreen = r + y;

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-card px-4 py-2.5",
      className,
    )}>
      <div className="flex items-center gap-3 flex-wrap min-w-0 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[hsl(0_65%_76%)]" /> {r} Red
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[hsl(35_87%_55%)]" /> {y} Yellow
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[hsl(95_50%_55%)]" /> {g} Green
        </span>
        {(na > 0 || tbu > 0) && <span className="text-muted-foreground/40">·</span>}
        {na > 0 && <span className="text-muted-foreground text-xs">{na} N/A</span>}
        {tbu > 0 && <span className="text-muted-foreground text-xs">{tbu} To update</span>}

        {nonGreen > 0 ? (
          <span className="text-xs text-muted-foreground truncate" title={[...reds.map(l => `Red: ${l}`), ...yellows.map(l => `Yellow: ${l}`)].join(" · ")}>
            — {reds.length > 0 && <span className="text-foreground">{reds.slice(0, 2).join(", ")}{reds.length > 2 ? ` +${reds.length - 2}` : ""}</span>}
            {reds.length > 0 && yellows.length > 0 && ", "}
            {yellows.length > 0 && <span className="text-foreground">{yellows.slice(0, 2).join(", ")}{yellows.length > 2 ? ` +${yellows.length - 2}` : ""}</span>}
          </span>
        ) : (
          <span className="text-xs text-positive inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> All clear
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {nonGreen === 0 ? null : hasOpenIssue ? (
          <>
            <span className="text-xs inline-flex items-center gap-1 text-positive">
              <CheckCircle2 className="h-3.5 w-3.5" /> Issue logged
            </span>
            <Button size="sm" variant="outline" onClick={onEdit} className="h-7 text-xs gap-1">
              <Pencil className="h-3 w-3" /> Edit issue
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Issues missing
            </span>
            <Button size="sm" onClick={onReview} className="h-7 text-xs">
              Review issues
            </Button>
          </>
        )}
      </div>
    </div>
  );
}