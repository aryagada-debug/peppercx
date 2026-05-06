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

  // One-time: if no user preference, default Neema's view to USD.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(LS_CURRENCY)) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("staffing_person_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const pid = profile?.staffing_person_id;
      if (!pid) return;
      const { data: person } = await supabase
        .from("staffing_people")
        .select("name")
        .eq("id", pid)
        .maybeSingle();
      const name = (person?.name || "").trim().toLowerCase();
      if (!cancelled && name.includes("neema")) {
        setCurrencyState("USD");
        globalCurrency = "USD";
        localStorage.setItem(LS_CURRENCY, "USD");
      }
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

  return (
    <CurrencyContext.Provider value={value}>
      <div key={`${currency}:${fxRate}`} className="contents">
        {children}
      </div>
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