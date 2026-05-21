import { cn } from "@/lib/utils";

export type DealTypeFilterValue = "All" | "Retainer" | "Non-Retainer" | "Pilot";
export const DEAL_TYPE_FILTER_OPTIONS: DealTypeFilterValue[] = ["All", "Retainer", "Non-Retainer", "Pilot"];

/** Returns true when a deal's dealType matches the current filter. */
export function dealMatchesType(dealType: string | null | undefined, value: DealTypeFilterValue) {
  if (value === "All") return true;
  return (dealType || "") === value;
}

interface Props {
  value: DealTypeFilterValue;
  onChange: (v: DealTypeFilterValue) => void;
  /** Optional className for the outer pill group. */
  className?: string;
  /** Smaller / larger variant; defaults to "sm". */
  size?: "sm" | "md";
}

/**
 * Shared Retainer / Non-Retainer / Pilot filter — pill-group style to match
 * existing toggles on the Staffing pages.
 */
export function DealTypeFilter({ value, onChange, className, size = "sm" }: Props) {
  return (
    <div
      className={cn(
        "flex gap-0.5 bg-secondary rounded-lg p-0.5",
        className,
      )}
      role="group"
      aria-label="Filter by deal type"
    >
      {DEAL_TYPE_FILTER_OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-md font-medium whitespace-nowrap transition-colors",
            size === "md" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]",
            value === opt
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}