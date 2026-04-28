import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "positive" | "warning" | "destructive" | "primary" | "muted";

const toneBg: Record<KpiTone, string> = {
  positive: "bg-positive/10",
  warning: "bg-warning/10",
  destructive: "bg-destructive/10",
  primary: "bg-primary/10",
  muted: "bg-muted",
};
const toneIconBg: Record<KpiTone, string> = {
  positive: "bg-positive/15 text-positive",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  primary: "bg-primary/15 text-primary",
  muted: "bg-foreground/10 text-foreground",
};
const toneBorder: Record<KpiTone, string> = {
  positive: "border-positive/20",
  warning: "border-warning/20",
  destructive: "border-destructive/20",
  primary: "border-primary/20",
  muted: "border-border",
};

interface KpiTileProps {
  label: string;
  value: string;
  suffix?: string;
  tone?: KpiTone;
  icon?: LucideIcon;
  className?: string;
}

export function KpiTile({ label, value, suffix, tone = "muted", icon: Icon, className }: KpiTileProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 flex items-center gap-3",
        toneBg[tone],
        toneBorder[tone],
        className,
      )}
    >
      {Icon && (
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", toneIconBg[tone])}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-medium tabular-nums tracking-tight text-foreground leading-none">{value}</span>
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}
