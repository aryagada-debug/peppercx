import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { formatINR, currencyHelper } from "./constants";

type Props = {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

export const CurrencyInput = forwardRef<HTMLInputElement, Props>(function CurrencyInput(
  { id, value, onChange, placeholder, disabled },
  ref,
) {
  const display = value == null ? "" : formatINR(value);
  return (
    <div className="space-y-1">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
        <Input
          ref={ref}
          id={id}
          inputMode="numeric"
          value={display}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-7"
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            onChange(digits === "" ? null : Number(digits));
          }}
        />
      </div>
      {value != null && value > 0 && (
        <p className="text-xs text-muted-foreground">{currencyHelper(value)}</p>
      )}
    </div>
  );
});
