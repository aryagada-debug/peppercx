import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RgyLetter = "R" | "Y" | "G" | "NA" | "PENDING";

const WEIGHTS: Record<string, number> = {
  customer: 50,
  internal: 10,
  content: 5,
  seo: 5,
  supply: 5,
  copy: 5,
  design: 5,
  video: 5,
};

const VALUE_SCORE: Record<string, number> = { G: 1, Y: 0.5, R: 0 };

function classify(score: number): "R" | "Y" | "G" {
  if (score >= 0.75) return "G";
  if (score >= 0.4) return "Y";
  return "R";
}

export type RgyRollupMap = Map<string, RgyLetter>;

async function loadRollup(dealIds: string[]): Promise<RgyRollupMap> {
  const map: RgyRollupMap = new Map();
  if (!dealIds.length) return map;
  const cols = ["deal_id", "created_at", ...Object.keys(WEIGHTS)].join(",");
  const { data, error } = await supabase
    .from("deal_rgy_weekly")
    .select(cols)
    .in("deal_id", dealIds)
    .order("created_at", { ascending: false });
  if (error || !data) return map;

  const latest = new Map<string, any>();
  for (const row of data as any[]) {
    if (!latest.has(row.deal_id)) latest.set(row.deal_id, row);
  }

  for (const [dealId, row] of latest) {
    let num = 0;
    let den = 0;
    for (const [dim, w] of Object.entries(WEIGHTS)) {
      const v = String(row[dim] || "").toUpperCase();
      if (v in VALUE_SCORE) {
        num += VALUE_SCORE[v] * w;
        den += w;
      }
    }
    if (den === 0) map.set(dealId, "PENDING");
    else map.set(dealId, classify(num / den));
  }
  return map;
}

export function useDealRgyRollup(dealIds: string[]) {
  const [map, setMap] = useState<RgyRollupMap>(new Map());
  const [loading, setLoading] = useState(true);
  const key = dealIds.slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadRollup(dealIds).then(m => {
      if (!cancelled) {
        setMap(m);
        setLoading(false);
      }
    });
    const channel = supabase
      .channel(`rgy-rollup-${key || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_rgy_weekly" }, () => {
        loadRollup(dealIds).then(m => { if (!cancelled) setMap(m); });
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { rgyRollup: map, loading };
}