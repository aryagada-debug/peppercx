import { useCurrency } from "@/contexts/CurrencyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();
  return (
    <Select value={currency} onValueChange={(v) => setCurrency(v as "INR" | "USD")}>
      <SelectTrigger
        className="h-8 w-[88px] text-xs font-mono tabular-nums"
        aria-label="Display currency"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="INR" className="text-xs">₹ INR</SelectItem>
        <SelectItem value="USD" className="text-xs">$ USD</SelectItem>
      </SelectContent>
    </Select>
  );
}