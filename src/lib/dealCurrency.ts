import { formatMoney, type Currency, type FormatOpts } from "@/lib/currency";

/**
 * Per-deal display currency override.
 *
 * Business rule: any deal whose geography is "Global" — OR any deal where
 * "Neema" appears in the VSD / BOPM fields — must always display its
 * financials in USD, regardless of the user's global ₹/$ toggle.
 * Every other deal falls back to the global currency the user chose.
 */
export interface DealCurrencyShape {
  geo?: string | null;
  vsd?: string | null;
  principalBopm?: string | null;
  seniorBopm?: string | null;
  bopm?: string | null;
  inputCurrency?: "INR" | "USD" | null;
}

export function dealDisplayCurrency(
  deal: DealCurrencyShape | null | undefined,
  globalCurrency: Currency,
): Currency {
  // All tables and KPIs render in the user-selected global currency.
  // The FX rate (₹/$ ticker) converts every amount uniformly — no
  // per-deal currency overrides for Global geo or specific VSDs.
  return globalCurrency;
}

/**
 * Convert a stored amount to INR base using the deal's `inputCurrency`,
 * so downstream display conversions (which assume INR-stored values)
 * stay correct even when the source was entered in USD.
 */
export function dealAmountToInr(
  amount: number | null | undefined,
  deal: DealCurrencyShape | null | undefined,
  fxRate: number,
): number {
  const v = Number(amount) || 0;
  if (!deal || deal.inputCurrency !== "USD") return v;
  const rate = Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 83;
  return v * rate;
}

/** Format an amount (assumed INR) using the deal-resolved currency. */
export function formatDealMoney(
  amountInInr: number,
  deal: DealCurrencyShape | null | undefined,
  globalCurrency: Currency,
  fxRate: number,
  opts: FormatOpts = { compact: true },
): string {
  const ccy = dealDisplayCurrency(deal, globalCurrency);
  return formatMoney(amountInInr, ccy, opts, fxRate);
}