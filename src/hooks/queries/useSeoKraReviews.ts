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
  quarter: string;
  weighted_total: number | null;
  area_averages: Record<string, number> | null;
  member_name: string;
  scores: ScoreRow[];
  reviewer_notes: string | null;
  updated_at: string;
}

export function useSeoKraReviews(scorecardKey: string, year: number, quarter: number) {
  const q = String(quarter);
  return useQuery({
    queryKey: ["seo-kra-reviews", scorecardKey, year, quarter],
    queryFn: async (): Promise<ReviewRow[]> => {
      const { data: reviews } = await supabase
        .from("seo_kra_reviews")
        .select("id, scorecard_key, member_person_id, member_user_id, member_name, year, quarter, total, area_scores, notes, updated_at")
        .eq("scorecard_key", scorecardKey)
        .eq("year", year)
        .eq("quarter", q);
      const ids = (reviews || []).map((r: any) => r.id);
      const { data: scores } = ids.length
        ? await supabase.from("seo_kra_scores").select("review_id, kpi_id, score, note").in("review_id", ids)
        : { data: [] as any[] };
      const byReview = new Map<string, ScoreRow[]>();
      (scores || []).forEach((s: any) => {
        const arr = byReview.get(s.review_id) || [];
        arr.push({ area_id: (s.kpi_id || "").split(":")[0] || "", kpi_id: (s.kpi_id || "").split(":")[1] || s.kpi_id, score: s.score, note: s.note });
        byReview.set(s.review_id, arr);
      });
      return (reviews || []).map((r: any) => ({
        id: r.id,
        scorecard_key: r.scorecard_key,
        member_person_id: r.member_person_id,
        member_user_id: r.member_user_id,
        member_name: r.member_name || "",
        year: r.year,
        quarter: r.quarter,
        weighted_total: r.total,
        area_averages: (r.area_scores as any) || null,
        reviewer_notes: r.notes || "",
        updated_at: r.updated_at,
        scores: byReview.get(r.id) || [],
      }));
    },
    staleTime: 60 * 1000,
  });
}

export interface SaveReviewInput {
  scorecard_key: string;
  member_person_id: string;
  member_user_id?: string | null;
  member_name: string;
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
      const q = String(input.quarter);
      const { data: existing } = await supabase
        .from("seo_kra_reviews")
        .select("id")
        .eq("scorecard_key", input.scorecard_key)
        .eq("member_person_id", input.member_person_id)
        .eq("year", input.year)
        .eq("quarter", q)
        .maybeSingle();

      let reviewId = (existing as any)?.id as string | undefined;
      const payload = {
        scorecard_key: input.scorecard_key,
        member_person_id: input.member_person_id,
        member_user_id: input.member_user_id ?? null,
        member_name: input.member_name,
        year: input.year,
        quarter: q,
        total: input.weighted_total,
        area_scores: input.area_averages as any,
        notes: input.reviewer_notes,
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
        const rows = input.scores.map(s => ({
          review_id: reviewId!,
          kpi_id: `${s.area_id}:${s.kpi_id}`,
          score: s.score ?? undefined,
          note: s.note ?? "",
        }));
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

export interface HistoryPoint {
  periodKey: string;
  year: number;
  quarter: number;
  label: string;
  weighted_total: number | null;
  area_averages: Record<string, number>;
  kpiScores: Record<string, number>;
}

export function useSeoKraMemberHistory(scorecardKey: string, memberPersonId: string | null, limit = 8) {
  return useQuery({
    queryKey: ["seo-kra-history", scorecardKey, memberPersonId, limit],
    enabled: !!memberPersonId,
    queryFn: async (): Promise<HistoryPoint[]> => {
      if (!memberPersonId) return [];
      const { data: reviews } = await supabase
        .from("seo_kra_reviews")
        .select("id, year, quarter, total, area_scores, updated_at")
        .eq("scorecard_key", scorecardKey)
        .eq("member_person_id", memberPersonId)
        .order("year", { ascending: true })
        .order("quarter", { ascending: true });
      const list = (reviews || []) as any[];
      if (!list.length) return [];
      const ids = list.map(r => r.id);
      const { data: scores } = await supabase
        .from("seo_kra_scores")
        .select("review_id, kpi_id, score")
        .in("review_id", ids);
      const byReview = new Map<string, Record<string, number>>();
      (scores || []).forEach((s: any) => {
        const m = byReview.get(s.review_id) || {};
        if (typeof s.score === "number") m[s.kpi_id] = s.score;
        byReview.set(s.review_id, m);
      });
      const points: HistoryPoint[] = list.map(r => ({
        periodKey: `${r.year}-Q${r.quarter}`,
        year: r.year,
        quarter: Number(r.quarter),
        label: `Q${r.quarter} ${String(r.year).slice(-2)}`,
        weighted_total: r.total,
        area_averages: (r.area_scores as any) || {},
        kpiScores: byReview.get(r.id) || {},
      }));
      points.sort((a, b) => (a.year - b.year) || (a.quarter - b.quarter));
      return points.slice(-limit);
    },
    staleTime: 60 * 1000,
  });
}