import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type ComplianceStatus,
  REVIEW_SENTINEL_DIMENSION,
  nameMatchesRole,
} from "@/lib/rgyCompliance";

const ACTIVE_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"];

export interface ComplianceRow {
  dealId: string;
  account: string;
  dealName: string;
  pod: string;
  vsd: string;
  bopm: string; // combined principal + senior + bopm
  vsdStatus: ComplianceStatus;
  bopmStatus: ComplianceStatus;
  vsdLastBy: string;
  vsdLastAt: string | null;
  bopmLastBy: string;
  bopmLastAt: string | null;
  otherEditors: string[];
}

interface DealRec {
  deal_id: string;
  account: string | null;
  deal_name: string | null;
  pod: string | null;
  vsd: string | null;
  principal_bopm: string | null;
  senior_bopm: string | null;
  bopm: string | null;
  deal_status: string | null;
}

interface NoteRec {
  deal_id: string;
  dimension: string;
  updated_by_name: string;
  created_at: string;
  week_start: string | null;
}

export function useRgyWeeklyCompliance(weekStart: string) {
  const [deals, setDeals] = useState<DealRec[]>([]);
  const [notes, setNotes] = useState<NoteRec[]>([]);
  const [loading, setLoading] = useState(true);

  // load active deals once (re-fetched if needed via realtime)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("staffing_deals")
        .select("deal_id, account, deal_name, pod, vsd, principal_bopm, senior_bopm, bopm, deal_status")
        .in("deal_status", ACTIVE_STATUSES)
        .limit(2000);
      if (!cancelled) setDeals((data as DealRec[]) || []);
    })();
    return () => { cancelled = true; };
  }, []);

  // load notes for the selected week (Mon..Sun inclusive)
  useEffect(() => {
    let cancelled = false;
    const weekEnd = new Date(weekStart + "T00:00:00Z");
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const endIso = weekEnd.toISOString();
    setLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("deal_rgy_notes")
        .select("deal_id, dimension, updated_by_name, created_at, week_start")
        .gte("created_at", weekStart + "T00:00:00Z")
        .lt("created_at", endIso)
        .limit(5000);
      if (!cancelled) {
        setNotes((data as NoteRec[]) || []);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel(`rgy-compliance-${weekStart}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_rgy_notes" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [weekStart]);

  const rows = useMemo<ComplianceRow[]>(() => {
    const byDeal = new Map<string, NoteRec[]>();
    for (const n of notes) {
      if (!byDeal.has(n.deal_id)) byDeal.set(n.deal_id, []);
      byDeal.get(n.deal_id)!.push(n);
    }
    return deals.map(d => {
      const dealNotes = byDeal.get(d.deal_id) || [];
      const bopmCombined = [d.principal_bopm, d.senior_bopm, d.bopm]
        .filter(Boolean).join(", ");

      let vsdStatus: ComplianceStatus = "pending";
      let bopmStatus: ComplianceStatus = "pending";
      let vsdLastBy = "", vsdLastAt: string | null = null;
      let bopmLastBy = "", bopmLastAt: string | null = null;
      const otherEditors = new Set<string>();

      // sort newest-first
      const sorted = [...dealNotes].sort((a, b) => b.created_at.localeCompare(a.created_at));
      for (const n of sorted) {
        const editor = n.updated_by_name || "";
        const isReview = n.dimension === REVIEW_SENTINEL_DIMENSION;
        const matchVsd = nameMatchesRole(editor, d.vsd);
        const matchBopm = nameMatchesRole(editor, bopmCombined);
        if (matchVsd) {
          if (vsdStatus === "pending") {
            vsdStatus = isReview ? "reviewed" : "updated";
            vsdLastBy = editor; vsdLastAt = n.created_at;
          } else if (vsdStatus === "reviewed" && !isReview) {
            vsdStatus = "updated"; vsdLastBy = editor; vsdLastAt = n.created_at;
          }
        }
        if (matchBopm) {
          if (bopmStatus === "pending") {
            bopmStatus = isReview ? "reviewed" : "updated";
            bopmLastBy = editor; bopmLastAt = n.created_at;
          } else if (bopmStatus === "reviewed" && !isReview) {
            bopmStatus = "updated"; bopmLastBy = editor; bopmLastAt = n.created_at;
          }
        }
        if (!matchVsd && !matchBopm && editor) otherEditors.add(editor);
      }

      return {
        dealId: d.deal_id,
        account: d.account || "",
        dealName: d.deal_name || "",
        pod: d.pod || "",
        vsd: d.vsd || "",
        bopm: bopmCombined,
        vsdStatus, bopmStatus,
        vsdLastBy, vsdLastAt,
        bopmLastBy, bopmLastAt,
        otherEditors: Array.from(otherEditors),
      };
    });
  }, [deals, notes]);

  return { rows, loading };
}