import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScoreRow {
  area_id: string;
  kpi_id: string;
  score: number | null;
  note: string | null;
}

export interface ReviewRow {
  id: string;
  scorecard_key: string;
  member_person_id: string | null;
  member_user_id: string | null;
  year: number;
  quarter: number;
  weighted_total: number | null;
  area_averages: Record<string, number> | null;
  scores: ScoreRow[];
  reviewer_notes: string | null;
  updated_at: string;
}

export function useSeoKraReviews(scorecardKey: string, year: number, quarter: number) {
  return useQuery({
    queryKey: ["seo-kra-reviews", scorecardKey, year, quarter],
    queryFn: async (): Promise<ReviewRow[]> => {
      const { data: reviews } = await supabase
        .from("seo_kra_reviews")
        .select("id, scorecard_key, member_person_id, member_user_id, year, quarter, weighted_total, area_averages, reviewer_notes, updated_at")
        .eq("scorecard_key", scorecardKey)
        .eq("year", year)
        .eq("quarter", quarter);
      const ids = (reviews || []).map((r: any) => r.id);
      const { data: scores } = ids.length
        ? await supabase.from("seo_kra_scores").select("review_id, area_id, kpi_id, score, note").in("review_id", ids)
        : { data: [] as any[] };
      const byReview = new Map<string, ScoreRow[]>();
      (scores || []).forEach((s: any) => {
        const arr = byReview.get(s.review_id) || [];
        arr.push({ area_id: s.area_id, kpi_id: s.kpi_id, score: s.score, note: s.note });
        byReview.set(s.review_id, arr);
      });
      return (reviews || []).map((r: any) => ({ ...r, scores: byReview.get(r.id) || [] }));
    },
    staleTime: 60 * 1000,
  });
}

export interface SaveReviewInput {
  scorecard_key: string;
  member_person_id: string;
  member_user_id?: string | null;
  year: number;
  quarter: number;
  weighted_total: number;
  area_averages: Record<string, number>;
  reviewer_notes: string;
  scores: ScoreRow[];
}

export function useSaveSeoKraReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveReviewInput) => {
      const { data: existing } = await supabase
        .from("seo_kra_reviews")
        .select("id")
        .eq("scorecard_key", input.scorecard_key)
        .eq("member_person_id", input.member_person_id)
        .eq("year", input.year)
        .eq("quarter", input.quarter)
        .maybeSingle();

      let reviewId = (existing as any)?.id as string | undefined;
      const payload = {
        scorecard_key: input.scorecard_key,
        member_person_id: input.member_person_id,
        member_user_id: input.member_user_id ?? null,
        year: input.year,
        quarter: input.quarter,
        weighted_total: input.weighted_total,
        area_averages: input.area_averages,
        reviewer_notes: input.reviewer_notes,
      };
      if (reviewId) {
        const { error } = await supabase.from("seo_kra_reviews").update(payload).eq("id", reviewId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("seo_kra_reviews").insert(payload).select("id").single();
        if (error) throw error;
        reviewId = (data as any).id;
      }

      await supabase.from("seo_kra_scores").delete().eq("review_id", reviewId);
      if (input.scores.length) {
        const rows = input.scores.map(s => ({ review_id: reviewId, ...s }));
        const { error } = await supabase.from("seo_kra_scores").insert(rows);
        if (error) throw error;
      }
      return reviewId;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["seo-kra-reviews", vars.scorecard_key, vars.year, vars.quarter] });
    },
  });
}