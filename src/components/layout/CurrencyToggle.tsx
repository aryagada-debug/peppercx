import { useCurrency } from "@/contexts/CurrencyContext";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

export function CurrencyToggle() {
  const { currency, setCurrency, fxRate, setFxRate } = useCurrency();
  const { isAdmin } = useUserRole();
  const readOnly = !isAdmin;
  return (
    <div className="flex items-center gap-1.5">
      <div
        role="group"
        aria-label="Display currency"
        className={cn(
          "flex items-center rounded-md border border-border bg-muted/40 p-0.5",
          readOnly && "opacity-80",
        )}
        title={readOnly ? "Only admins can change the display currency" : undefined}
      >
        <button
          type="button"
          aria-pressed={currency === "INR"}
          onClick={() => { if (!readOnly) setCurrency("INR"); }}
          disabled={readOnly}
          className={cn(
            "h-6 w-6 rounded text-xs leading-none transition-colors disabled:cursor-not-allowed",
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
          onClick={() => { if (!readOnly) setCurrency("USD"); }}
          disabled={readOnly}
          className={cn(
            "h-6 w-6 rounded text-xs leading-none transition-colors disabled:cursor-not-allowed",
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
          readOnly={readOnly}
          disabled={readOnly}
          className="h-6 w-[58px] px-1.5 text-[11px] tabular-nums"
          title={readOnly ? "Only admins can change the exchange rate" : "USD → INR exchange rate"}
        />
        <span>₹</span>
      </label>
    </div>
  );
}