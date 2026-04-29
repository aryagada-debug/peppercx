import type { RGYStatus } from "@/types/dashboard";

export interface ScoreInput {
  rgyStatuses: RGYStatus[]; // worst-status per deal
  attainmentPct: number;    // 0..100+
  overdueMbrCount: number;
  unstaffedCount: number;
  totalDeals: number;
}

export interface ScoreOutput {
  score: number;        // 0..100
  letter: "A" | "B" | "C" | "D" | "F";
  band: "Healthy" | "Watch" | "Critical";
  bandTone: "positive" | "warning" | "destructive";
}

/**
 * Composite portfolio health (0..100). Weighted blend:
 * - 50% RGY mix (G=1, Y=0.5, R=0, NA=0.6)
 * - 25% Attainment (cap at 100)
 * - 15% MBR compliance (1 - overdue/total)
 * - 10% Staffing coverage (1 - unstaffed/total)
 */
export function computePortfolioScore(input: ScoreInput): ScoreOutput {
  const total = Math.max(1, input.totalDeals);
  const rgyTotal = Math.max(1, input.rgyStatuses.length);
  let rgyPts = 0;
  for (const s of input.rgyStatuses) {
    rgyPts += s === "G" ? 1 : s === "Y" ? 0.5 : s === "NA" ? 0.6 : 0;
  }
  const rgyScore = (rgyPts / rgyTotal) * 100;
  const attain = Math.max(0, Math.min(100, input.attainmentPct));
  const mbrScore = Math.max(0, 1 - input.overdueMbrCount / total) * 100;
  const staffScore = Math.max(0, 1 - input.unstaffedCount / total) * 100;

  const composite = rgyScore * 0.5 + attain * 0.25 + mbrScore * 0.15 + staffScore * 0.10;
  const score = Math.round(composite);

  const letter: ScoreOutput["letter"] =
    score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  const band: ScoreOutput["band"] = score >= 80 ? "Healthy" : score >= 65 ? "Watch" : "Critical";
  const bandTone: ScoreOutput["bandTone"] = band === "Healthy" ? "positive" : band === "Watch" ? "warning" : "destructive";

  return { score, letter, band, bandTone };
}
