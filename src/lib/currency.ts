export type Currency = "INR" | "USD";

/** Display-only FX rate. Source data remains stored in INR. */
export const INR_PER_USD = 83;

export function convertFromInr(amountInInr: number, currency: Currency): number {
  if (!Number.isFinite(amountInInr)) return 0;
  return currency === "USD" ? amountInInr / INR_PER_USD : amountInInr;
}

export function convertToInr(amount: number, currency: Currency): number {
  if (!Number.isFinite(amount)) return 0;
  return currency === "USD" ? amount * INR_PER_USD : amount;
}

export interface FormatOpts {
  compact?: boolean;
}

function formatInrCompact(n: number): string {
  if (!n) return "₹0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

function formatUsdCompact(n: number): string {
  if (!n) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

function formatInrFull(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

function formatUsdFull(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

/** Format an amount stored in INR using the requested display currency. */
export function formatMoney(
  amountInInr: number,
  currency: Currency,
  opts: FormatOpts = { compact: true },
): string {
  const v = convertFromInr(amountInInr ?? 0, currency);
  if (opts.compact) {
    return currency === "USD" ? formatUsdCompact(v) : formatInrCompact(v);
  }
  return currency === "USD" ? formatUsdFull(v) : formatInrFull(v);
}

// ---------------------------------------------------------------------------
// Active currency (module-level mirror of CurrencyContext).
// Lets non-React utilities (like `formatINR` in csvTargets) honour the user's
// chosen currency without requiring every call site to be refactored.
// ---------------------------------------------------------------------------

let _activeCurrency: Currency = "INR";

export function setActiveCurrency(c: Currency) {
  _activeCurrency = c;
}

export function getActiveCurrency(): Currency {
  return _activeCurrency;
}

/** Format using whatever currency the user currently has selected. */
export function formatMoneyActive(amountInInr: number, opts?: FormatOpts): string {
  return formatMoney(amountInInr, _activeCurrency, opts);
}

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
};