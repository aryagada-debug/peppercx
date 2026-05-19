import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityItem {
  id: string;
  kind: "slack" | "rgy" | "mbr" | "task";
  deal_id: string;
  deal_name: string;
  account: string;
  actor: string;
  text: string;
  href: string;
  at: string; // ISO
}

/**
 * Fetches recent activity for the deals the user is tagged into (vsd / bopm / principal_bopm / senior_bopm).
 * Aggregates slack messages, RGY weekly updates, MBR entries and deal-task changes.
 * When `allAccounts` is true (admins), returns activity across every active deal in the workspace
 * regardless of the alias set.
 */
export function useAccountActivity(aliases: Set<string>, enabled: boolean, limit = 20, allAccounts = false) {
  const qc = useQueryClient();
  // Re-derive a primitive key so callers passing a mutated ref still trigger reloads
  const aliasKey = Array.from(aliases).sort().join("|");

  const fetchActivity = async (): Promise<ActivityItem[]> => {
    if (!allAccounts && aliases.size === 0) return [];
    const inA = (s: string | null) => !!s && aliases.has((s || "").trim().toLowerCase());

    // 1. My deals
    const { data: deals } = await supabase
      .from("staffing_deals")
      .select("id, deal_name, account, vsd, principal_bopm, senior_bopm, bopm")
      .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);
    const mine = allAccounts
      ? (deals || [])
      : (deals || []).filter((d: any) =>
          inA(d.vsd) || inA(d.principal_bopm) || inA(d.senior_bopm) || inA(d.bopm));
    const dealMap = new Map<string, { deal_name: string; account: string }>();
    mine.forEach((d: any) => dealMap.set(d.id, { deal_name: d.deal_name, account: d.account }));
    const ids = Array.from(dealMap.keys());
    if (!ids.length) return [];

    // 2. Pull recent activity in parallel
    const [{ data: slack }, { data: rgy }, { data: mbr }, { data: tasks }] = await Promise.all([
      supabase.from("slack_messages").select("id, deal_id, user_name, text, created_at").in("deal_id", ids).order("created_at", { ascending: false }).limit(limit),
      supabase.from("deal_rgy_weekly").select("id, deal_id, week_start, issue_status, issue_details, created_at").in("deal_id", ids).order("created_at", { ascending: false }).limit(limit),
      supabase.from("mbr_entries").select("id, deal_id, status, updated_by, updated_at").in("deal_id", ids).order("updated_at", { ascending: false }).limit(limit),
      supabase.from("deal_tasks").select("id, deal_id, title, stage, assignee, updated_at").in("deal_id", ids).order("updated_at", { ascending: false }).limit(limit),
    ]);

    const out: ActivityItem[] = [];
    (slack || []).forEach((m: any) => {
      const d = dealMap.get(m.deal_id)!;
      out.push({
        id: `slack-${m.id}`, kind: "slack", deal_id: m.deal_id,
        deal_name: d.deal_name, account: d.account,
        actor: m.user_name || "Slack",
        text: (m.text || "").slice(0, 140),
        href: `/deals/${m.deal_id}?tab=Slack`,
        at: m.created_at,
      });
    });
    (rgy || []).forEach((r: any) => {
      const d = dealMap.get(r.deal_id)!;
      out.push({
        id: `rgy-${r.id}`, kind: "rgy", deal_id: r.deal_id,
        deal_name: d.deal_name, account: d.account,
        actor: "RGY",
        text: r.issue_status === "Open"
          ? `Issue logged${r.issue_details ? `: ${String(r.issue_details).slice(0, 100)}` : ""}`
          : `Health updated for week of ${r.week_start}`,
        href: `/deals/${r.deal_id}?tab=RGY+Health`,
        at: r.created_at,
      });
    });
    (mbr || []).forEach((m: any) => {
      const d = dealMap.get(m.deal_id)!;
      out.push({
        id: `mbr-${m.id}`, kind: "mbr", deal_id: m.deal_id,
        deal_name: d.deal_name, account: d.account,
        actor: m.updated_by || "MBR",
        text: `MBR ${String(m.status || "").toLowerCase()}`,
        href: `/deals/${m.deal_id}?tab=MBR`,
        at: m.updated_at,
      });
    });
    (tasks || []).forEach((t: any) => {
      const d = dealMap.get(t.deal_id)!;
      out.push({
        id: `task-${t.id}`, kind: "task", deal_id: t.deal_id,
        deal_name: d.deal_name, account: d.account,
        actor: t.assignee || "Task",
        text: `Task "${t.title}" → ${t.stage}`,
        href: `/deals/${t.deal_id}?tab=Tasks`,
        at: t.updated_at,
      });
    });
    out.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    return out.slice(0, limit);
  };

  const q = useQuery({
    queryKey: ["account-activity", aliasKey, limit, allAccounts],
    queryFn: fetchActivity,
    enabled,
  });

  return {
    items: q.data || [],
    loading: q.isLoading,
    reload: () => qc.invalidateQueries({ queryKey: ["account-activity", aliasKey, limit, allAccounts] }),
  };
}