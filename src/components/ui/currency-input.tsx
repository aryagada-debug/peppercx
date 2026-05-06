import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { INR_PER_USD, type Currency } from "@/lib/currency";

interface CurrencyInputProps {
  /** Value stored in INR (base currency in DB). */
  valueInr: number | string | undefined | null;
  /** Called with the new INR value on every change. */
  onChangeInr: (inr: number) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Initial display currency. Defaults to INR. */
  defaultCurrency?: Currency;
  /** Notified when the user toggles between INR/USD. */
  onCurrencyChange?: (c: Currency) => void;
  id?: string;
}

/**
 * Number input with a per-input INR/USD toggle. Storage is always INR;
 * the toggle only changes how the user enters and sees the value.
 */
export function CurrencyInput({
  valueInr,
  onChangeInr,
  placeholder = "0",
  className,
  inputClassName,
  disabled,
  defaultCurrency = "INR",
  onCurrencyChange,
  id,
}: CurrencyInputProps) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  // Keep in sync if parent updates the default (e.g. another CurrencyInput in the same form toggled).
  useEffect(() => {
    setCurrency((prev) => (prev === defaultCurrency ? prev : defaultCurrency));
  }, [defaultCurrency]);
  const numericInr =
    valueInr === "" || valueInr === null || valueInr === undefined
      ? NaN
      : Number(valueInr);

  // The visible string the user is editing. Kept local so typing doesn't
 // jitter due to floating-point round trips.
  const [display, setDisplay] = useState<string>(() =>
    Number.isFinite(numericInr)
      ? currency === "USD"
        ? String(round(numericInr / INR_PER_USD, 2))
        : String(numericInr)
      : "",
  );

  // External value changed (e.g. form reset) → resync the display.
  const lastExternal = useRef<number | "">(Number.isFinite(numericInr) ? numericInr : "");
  useEffect(() => {
    const ext = Number.isFinite(numericInr) ? numericInr : "";
    if (ext !== lastExternal.current) {
      lastExternal.current = ext;
      setDisplay(
        ext === ""
          ? ""
          : currency === "USD"
            ? String(round((ext as number) / INR_PER_USD, 2))
            : String(ext),
      );
    }
  }, [numericInr, currency]);

  const switchCurrency = (next: Currency) => {
    if (next === currency) return;
    // Re-render the current INR amount in the new currency.
    if (Number.isFinite(numericInr)) {
      setDisplay(
        next === "USD"
          ? String(round(numericInr / INR_PER_USD, 2))
          : String(round(numericInr, 0)),
      );
    }
    setCurrency(next);
    onCurrencyChange?.(next);
  };

  const handleChange = (raw: string) => {
    setDisplay(raw);
    if (raw.trim() === "") {
      onChangeInr(0);
      lastExternal.current = 0;
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const inr = currency === "USD" ? n * INR_PER_USD : n;
    lastExternal.current = inr;
    onChangeInr(inr);
  };

  const symbol = currency === "USD" ? "$" : "₹";

  return (
    <div className={cn("relative flex items-stretch", className)}>
      <span
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
        aria-hidden
      >
        {symbol}
      </span>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("pl-6 pr-[78px] tabular-nums", inputClassName)}
      />
      <div
        role="group"
        aria-label="Currency"
        className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
      >
        <ToggleBtn active={currency === "INR"} onClick={() => switchCurrency("INR")}>
          ₹
        </ToggleBtn>
        <ToggleBtn active={currency === "USD"} onClick={() => switchCurrency("USD")}>
          $
        </ToggleBtn>
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-pressed={active}
      className={cn(
        "h-6 w-7 rounded text-xs font-bold leading-none transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}