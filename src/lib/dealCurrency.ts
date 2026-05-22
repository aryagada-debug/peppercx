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
  if (!deal) return globalCurrency;
  const geo = (deal.geo || "").trim().toLowerCase();
  const isGlobal = geo === "global";
  const peopleStr = `${deal.vsd || ""} ${deal.principalBopm || ""} ${deal.seniorBopm || ""} ${deal.bopm || ""}`.toLowerCase();
  const isNeema = /\bneema\b/.test(peopleStr);
  if (isGlobal || isNeema) return "USD";
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