// Weighted "Overall Customer" RGY rollup — replaces the old worst-of-all rule.
//
// Weights (raw):
//   customer  = 50
//   internal  = 10
//   content / seo / supply / copy / design / video = 5 each
//   (legacy fields delivery/consumption are weighted 5 each for backward compatibility)
//
// Score per dim: R = 0, Y = 50, G = 100. NA / blank dims are excluded
// and the denominator is normalized over present dims.
//
// Bands: score < 40 -> R, 40 <= score <= 75 -> Y, score > 75 -> G.
// Returns null only when every dim is missing/NA.

export type RGYBand = "R" | "Y" | "G" | null;

export const RGY_WEIGHTS: Record<string, number> = {
  customer: 50,
  internal: 10,
  content: 5,
  seo: 5,
  supply: 5,
  copy: 5,
  design: 5,
  video: 5,
  // Legacy / dashboard-only dims:
  delivery: 5,
  consumption: 5,
};

function dimValue(v: string | null | undefined): number | null {
  if (!v) return null;
  if (v === "R") return 0;
  if (v === "Y") return 50;
  if (v === "G") return 100;
  return null; // "NA" or anything else
}

export function scoreToBand(score: number | null): RGYBand {
  if (score === null) return null;
  if (score < 40) return "R";
  if (score <= 75) return "Y";
  return "G";
}

export function computeOverallCustomerScore(
  dims: Record<string, string | null | undefined>
): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of Object.keys(RGY_WEIGHTS)) {
    const v = dimValue(dims[key]);
    if (v === null) continue;
    const w = RGY_WEIGHTS[key];
    weightedSum += w * v;
    weightTotal += w;
  }
  if (weightTotal === 0) return null;
  return weightedSum / weightTotal;
}

export function getOverallCustomerRGY(
  dims: Record<string, string | null | undefined>
): RGYBand {
  return scoreToBand(computeOverallCustomerScore(dims));
}
