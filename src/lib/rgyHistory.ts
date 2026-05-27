import { supabase } from "@/integrations/supabase/client";
import { REVIEW_SENTINEL_DIMENSION } from "@/lib/rgyCompliance";

/**
 * Append an audit row to deal_rgy_notes capturing who changed which RGY
 * dimension and what the value moved from/to. Best-effort — never throws
 * to caller; failures are logged.
 */
export async function logRGYChange(params: {
  dealId: string;
  dimension: string;
  fromValue: string;
  toValue: string;
  weekStart?: string | null;
  note?: string;
}) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", uid)
      .maybeSingle();
    const name = profile?.display_name || userRes?.user?.email || "Unknown user";
    await (supabase as any).from("deal_rgy_notes").insert({
      deal_id: params.dealId,
      dimension: params.dimension,
      from_value: params.fromValue || "",
      to_value: params.toValue || "",
      note: params.note || "",
      week_start: params.weekStart || null,
      updated_by: uid,
      updated_by_name: name,
    });
  } catch (e) {
    console.warn("[rgyHistory] failed to log change", e);
  }
}

/**
 * Record an intentional "reviewed — no change" mark for a given deal & week.
 * Used by the Weekly Compliance report so Central CX can distinguish
 * "forgot to update" from "looked, nothing changed".
 */
export async function logRGYReviewedNoChange(params: {
  dealId: string;
  weekStart: string;
  note?: string;
}) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", uid)
      .maybeSingle();
    const name = profile?.display_name || userRes?.user?.email || "Unknown user";
    await (supabase as any).from("deal_rgy_notes").insert({
      deal_id: params.dealId,
      dimension: REVIEW_SENTINEL_DIMENSION,
      from_value: "",
      to_value: "",
      note: params.note || "Reviewed - no change",
      week_start: params.weekStart,
      updated_by: uid,
      updated_by_name: name,
    });
  } catch (e) {
    console.warn("[rgyHistory] failed to log reviewed-no-change", e);
  }
}