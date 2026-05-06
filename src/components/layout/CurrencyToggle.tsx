import { useCurrency } from "@/contexts/CurrencyContext";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CurrencyToggle() {
  const { currency, setCurrency, fxRate, setFxRate } = useCurrency();
  return (
    <div className="flex items-center gap-1.5">
      <div
        role="group"
        aria-label="Display currency"
        className="flex items-center rounded-md border border-border bg-muted/40 p-0.5"
      >
        <button
          type="button"
          aria-pressed={currency === "INR"}
          onClick={() => setCurrency("INR")}
          className={cn(
            "h-6 w-6 rounded text-xs leading-none transition-colors",
            currency === "INR"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          ₹
        </button>
        <button
          type="button"
          aria-pressed={currency === "USD"}
          onClick={() => setCurrency("USD")}
          className={cn(
            "h-6 w-6 rounded text-xs leading-none transition-colors",
            currency === "USD"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          $
        </button>
      </div>
      <label className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>1$ =</span>
        <Input
          type="number"
          min={1}
          step={0.5}
          value={fxRate}
          onChange={(e) => setFxRate(Number(e.target.value))}
          className="h-6 w-[58px] px-1.5 text-[11px] tabular-nums"
          title="USD → INR exchange rate"
        />
        <span>₹</span>
      </label>
    </div>
  );
}