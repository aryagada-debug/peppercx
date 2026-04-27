import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  CURRENCY_SYMBOL,
  formatMoney,
  setActiveCurrency,
  type Currency,
  type FormatOpts,
} from "@/lib/currency";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  symbol: string;
  format: (amountInInr: number, opts?: FormatOpts) => string;
  formatFull: (amountInInr: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const STORAGE_KEY = "vsd.currency";

function readInitial(): Currency {
  if (typeof window === "undefined") return "INR";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "USD" ? "USD" : "INR";
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const initial = readInitial();
    setActiveCurrency(initial);
    return initial;
  });

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    setActiveCurrency(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  // Keep the module-level mirror in sync (covers HMR / first paint).
  useEffect(() => {
    setActiveCurrency(currency);
  }, [currency]);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      symbol: CURRENCY_SYMBOL[currency],
      format: (amount, opts) => formatMoney(amount ?? 0, currency, opts ?? { compact: true }),
      formatFull: (amount) => formatMoney(amount ?? 0, currency, { compact: false }),
    }),
    [currency, setCurrency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Safe fallback so non-wrapped trees don't crash.
    return {
      currency: "INR",
      setCurrency: () => {},
      symbol: "₹",
      format: (amount, opts) => formatMoney(amount ?? 0, "INR", opts ?? { compact: true }),
      formatFull: (amount) => formatMoney(amount ?? 0, "INR", { compact: false }),
    };
  }
  return ctx;
}