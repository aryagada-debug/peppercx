import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney as formatMoneyRaw, type Currency, type FormatOpts } from "@/lib/currency";

const LS_CURRENCY = "vsdos.currency";
const LS_FX = "vsdos.fxRate";
const DEFAULT_FX = 83;

interface CurrencyState {
  currency: Currency;
  fxRate: number;
  setCurrency: (c: Currency) => void;
  setFxRate: (r: number) => void;
  format: (amountInInr: number, opts?: FormatOpts) => string;
}

const CurrencyContext = createContext<CurrencyState | null>(null);

// Module-level mirror so non-hook utilities (e.g. formatINR) can read the
// current display currency / rate without a React context.
let globalCurrency: Currency =
  (typeof localStorage !== "undefined" && (localStorage.getItem(LS_CURRENCY) as Currency)) || "INR";
let globalFx: number =
  (typeof localStorage !== "undefined" && Number(localStorage.getItem(LS_FX))) || DEFAULT_FX;
if (!Number.isFinite(globalFx) || globalFx <= 0) globalFx = DEFAULT_FX;

export function getGlobalCurrency(): Currency {
  return globalCurrency;
}
export function getGlobalFx(): number {
  return globalFx;
}
export function formatGlobalMoney(amountInInr: number, opts?: FormatOpts): string {
  return formatMoneyRaw(amountInInr, globalCurrency, opts ?? { compact: true }, globalFx);
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(globalCurrency);
  const [fxRate, setFxRateState] = useState<number>(globalFx);

  // One-time: if user has no local preference, read their saved
  // `profiles.default_currency` and apply it. Users can override with the
  // toggle at any time — a manual change writes localStorage so we never
  // overwrite an explicit choice.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(LS_CURRENCY)) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_currency")
        .eq("user_id", user.id)
        .maybeSingle();
      const pref = (profile as any)?.default_currency as Currency | undefined;
      if (cancelled || !pref || (pref !== "INR" && pref !== "USD")) return;
      setCurrencyState(pref);
      globalCurrency = pref;
      try { localStorage.setItem(LS_CURRENCY, pref); } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    globalCurrency = c;
    setCurrencyState(c);
    try { localStorage.setItem(LS_CURRENCY, c); } catch {}
  }, []);

  const setFxRate = useCallback((r: number) => {
    const safe = Number.isFinite(r) && r > 0 ? r : DEFAULT_FX;
    globalFx = safe;
    setFxRateState(safe);
    try { localStorage.setItem(LS_FX, String(safe)); } catch {}
  }, []);

  const format = useCallback(
    (amountInInr: number, opts?: FormatOpts) =>
      formatMoneyRaw(amountInInr, currency, opts ?? { compact: true }, fxRate),
    [currency, fxRate],
  );

  const value = useMemo<CurrencyState>(
    () => ({ currency, fxRate, setCurrency, setFxRate, format }),
    [currency, fxRate, setCurrency, setFxRate, format],
  );

  // No remount on currency change — components subscribe via useCurrency()
  // (or the lightweight useCurrencyVersion() hook below) and re-render only
  // themselves. Non-hook callers of formatINR pick up the new value on
  // their next natural render via the module-level mirrors above.
  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyState {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider (e.g. tests).
    return {
      currency: globalCurrency,
      fxRate: globalFx,
      setCurrency: () => {},
      setFxRate: () => {},
      format: (n, opts) => formatMoneyRaw(n, globalCurrency, opts ?? { compact: true }, globalFx),
    };
  }
  return ctx;
}

export function useMoney() {
  return useCurrency();
}

/**
 * Subscribe a component (and its subtree) to currency/fx changes without
 * destructuring anything. Useful in pages that call the legacy `formatINR`
 * module function — calling this hook ensures the page re-renders when the
 * user toggles ₹/$ so the formatted strings update.
 */
export function useCurrencyVersion(): string {
  const { currency, fxRate } = useCurrency();
  return `${currency}-${fxRate}`;
}