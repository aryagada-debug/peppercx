import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  daysSince: number | null;
  className?: string;
  compact?: boolean;
}

/**
 * Amber pill rendered next to a deal name when its RGY hasn't been updated
 * in 30+ days (or never). Use anywhere a deal surface is shown.
 */
export function StaleRgyBadge({ daysSince, className, compact }: Props) {
  const label = daysSince === null
    ? "No RGY"
    : compact ? `${daysSince}d` : `Stale RGY · ${daysSince}d`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700",
        className,
      )}
      title={daysSince === null
        ? "No RGY entry recorded for this deal yet"
        : `Last RGY update was ${daysSince} day${daysSince === 1 ? "" : "s"} ago`}
    >
      <AlertTriangle className="h-3 w-3" />
      {label}
    </span>
  );
}