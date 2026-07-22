import type { Scorecard } from "./types";
import { growthLeadScorecard } from "./growthLead";
import { seoOpsScorecard } from "./seoOps";

export const scorecards: Scorecard[] = [growthLeadScorecard, seoOpsScorecard];
export const scorecardByKey = (key: string) =>
  scorecards.find(s => s.key === key) ?? scorecards[0];

/** HSL CSS var name for an area, keyed by area index. Loops if more than 4 areas. */
const AREA_TOKENS = ["--kra-growth", "--kra-client", "--kra-ai", "--kra-delivery"] as const;
export function areaToken(areaIndex: number) {
  return AREA_TOKENS[areaIndex % AREA_TOKENS.length];
}
export function areaColor(areaIndex: number, alpha = 1) {
  const tok = areaToken(areaIndex);
  return alpha >= 1 ? `hsl(var(${tok}))` : `hsl(var(${tok}) / ${alpha})`;
}

export type { Scorecard, AreaDef, KpiDef } from "./types";
export type { ScoreRow } from "@/hooks/queries/useSeoKraReviews";