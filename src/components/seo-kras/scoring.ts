import type { Scorecard, ScoreRow } from "./scorecards";

export function computeScores(scorecard: Scorecard, scores: Pick<ScoreRow, "area_id" | "kpi_id" | "score">[]) {
  const byKey = new Map<string, number>();
  scores.forEach(s => {
    if (typeof s.score === "number" && !Number.isNaN(s.score)) {
      byKey.set(`${s.area_id}:${s.kpi_id}`, s.score);
    }
  });
  const areaAverages: Record<string, number> = {};
  let weighted = 0;
  let weightUsed = 0;
  scorecard.areas.forEach(area => {
    const vals = area.kpis.map(k => byKey.get(`${area.id}:${k.id}`)).filter((n): n is number => typeof n === "number");
    if (!vals.length) {
      areaAverages[area.id] = 0;
      return;
    }
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    areaAverages[area.id] = Number(avg.toFixed(2));
    weighted += avg * area.weight;
    weightUsed += area.weight;
  });
  const weightedTotal = weightUsed > 0 ? Number((weighted / weightUsed).toFixed(2)) : 0;
  return { areaAverages, weightedTotal };
}

export type { ScoreRow } from "./scorecards";