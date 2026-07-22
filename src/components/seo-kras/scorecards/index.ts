import type { Scorecard } from "./types";
import { growthLeadScorecard } from "./growthLead";

export const scorecards: Scorecard[] = [growthLeadScorecard];
export const scorecardByKey = (key: string) =>
  scorecards.find(s => s.key === key) ?? scorecards[0];
export type { Scorecard, AreaDef, KpiDef } from "./types";
export type { ScoreRow } from "@/hooks/queries/useSeoKraReviews";