import { useGeoFilter, type GeoKey } from "@/contexts/GeoFilterContext";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";

const OPTIONS: { key: GeoKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "US", label: "US" },
  { key: "India", label: "IN" },
  { key: "Other", label: "Other" },
];

export function GeoFilter() {
  const { geo, setGeo } = useGeoFilter();
  return (
    <div
      role="group"
      aria-label="Geography filter"
      className="flex items-center rounded-md border border-border bg-muted/40 p-0.5"
      title="Filter by geography. Applies to analytics and KPIs across the app."
    >
      <Globe className="h-3 w-3 mx-1 text-muted-foreground" />
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={geo === o.key}
          onClick={() => setGeo(o.key)}
          className={cn(
            "h-6 px-2 rounded text-[11px] leading-none transition-colors",
            geo === o.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}