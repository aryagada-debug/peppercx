/**
 * Identity / scope queries for Home.tsx.
 *
 * - useHomeProfileQuery: profile + staffing_person + canonical "aliases"
 *   set (display name, staffing name, email — lowercase). The aliases set
 *   is what every Home loader checks deal columns (vsd / principal_bopm /
 *   senior_bopm / bopm) against.
 * - useHomeRecentsAndPinsQuery: recent views + pins for the sidebar.
 * - useHomeActiveDealsQuery: alias/access-scoped list for the "Add Task"
 *   deal picker.
 * - useHomeQuotaQuery: user quota row + closed amount aggregated from
 *   alias/access-scoped staffing_deals in the period.
 */
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfYear, endOfYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// --- shared types --------------------------------------------------------

export interface RecentView {
  id: string; entity_type: string; entity_id: string; entity_name: string; viewed_at: string;
}
export interface UserPin {
  id: string; entity_type: string; entity_id: string; entity_name: string; pinned_at: string;
}
export interface QuotaRow {
  id: string; period_type: string; period_start: string; period_end: string; target_amount: number;
}
export interface ActiveDealLite {
  id: string; deal_name: string; account: string;
}

const ACTIVE_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"];

function aliasesKey(aliases: Set<string>): string {
  return Array.from(aliases).sort().join("|");
}

function accessKey(ids: Set<string>): string {
  return Array.from(ids).sort().join("|");
}

function buildDealScopeOrClause(
  aliases: Set<string>,
  accessIds: Set<string>,
  isAdmin: boolean,
): string | null {
  if (isAdmin) return null;
  const safe = Array.from(aliases).filter(
    (a) => a && !a.includes("@") && !/[,()"\\]/.test(a),
  );
  const cols = ["vsd", "principal_bopm", "senior_bopm", "bopm"];
  const parts: string[] = [];
  for (const a of safe) for (const c of cols) parts.push(`${c}.ilike.${a}`);
  const ids = Array.from(accessIds);
  if (ids.length) parts.push(`id.in.(${ids.join(",")})`);
  return parts.length ? parts.join(",") : null;
}

// --- profile -------------------------------------------------------------

export interface HomeProfile {
  displayName: string;
  staffingName: string;
  staffingPersonId: string | null;
  aliases: Set<string>;
}

export function useHomeProfileQuery(userId: string | undefined, email: string | null | undefined) {
  const query = useQuery({
    queryKey: ["home", "profile", userId ?? ""],
    enabled: !!userId,
    queryFn: async (): Promise<HomeProfile> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, staffing_person_id")
        .eq("user_id", userId!)
        .maybeSingle();
      const dn = profile?.display_name || email || "";
      const staffingPersonId = profile?.staffing_person_id || null;
      let sn = "";
      if (staffingPersonId) {
        const { data: p } = await supabase
          .from("staffing_people").select("name").eq("id", staffingPersonId).maybeSingle();
        sn = p?.name || "";
      }
      if (!sn && email) {
        const { data: pByEmail } = await supabase
          .from("staffing_people").select("name").ilike("email", email).maybeSingle();
        sn = pByEmail?.name || "";
      }
      const aliases = new Set<string>();
      [dn, sn, email || ""].forEach((v) => {
        const t = (v || "").trim().toLowerCase();
        if (t) aliases.add(t);
      });
      return { displayName: dn, staffingName: sn, staffingPersonId, aliases };
    },
  });

  // Stable default so consumers can destructure without nullish checks.
  const data = query.data ?? useMemo<HomeProfile>(
    () => ({ displayName: "", staffingName: "", staffingPersonId: null, aliases: new Set() }),
    [],
  );

  return { ...query, data };
}

// --- recents + pins ------------------------------------------------------

export function useHomeRecentsAndPinsQuery(userId: string | undefined) {
  const qc = useQueryClient();
  const key = ["home", "recentsPins", userId ?? ""] as const;

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_recent_views").select("*")
          .eq("user_id", userId!).order("viewed_at", { ascending: false }).limit(8),
        supabase.from("user_pins").select("*")
          .eq("user_id", userId!).order("pinned_at", { ascending: false }),
      ]);
      return {
        recents: (r as RecentView[]) || [],
        pins: (p as UserPin[]) || [],
      };
    },
  });

  const patchPins = useCallback(
    (updater: (prev: UserPin[]) => UserPin[]) => {
      qc.setQueryData<{ recents: RecentView[]; pins: UserPin[] }>(key, (prev) => ({
        recents: prev?.recents ?? [],
        pins: updater(prev?.pins ?? []),
      }));
    },
    [qc, key],
  );

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: key });
  }, [qc, key]);

  return { ...query, patchPins, invalidate };
}

// --- active deals (Add Task picker) --------------------------------------

export function useHomeActiveDealsQuery(opts: {
  userId: string | undefined;
  aliases: Set<string>;
  accessIds: Set<string>;
  isAdmin: boolean;
}) {
  const { userId, aliases, accessIds, isAdmin } = opts;
  return useQuery({
    queryKey: ["home", "activeDeals", userId ?? "", isAdmin, aliasesKey(aliases), accessKey(accessIds)],
    enabled: !!userId,
    queryFn: async (): Promise<ActiveDealLite[]> => {
      const inAliases = (s: string | null) =>
        !!s && aliases.has((s || "").trim().toLowerCase());
      const scopeClause = buildDealScopeOrClause(aliases, accessIds, isAdmin);
      let q = supabase.from("staffing_deals")
        .select("id, deal_name, account, deal_status, vsd, principal_bopm, senior_bopm, bopm")
        .in("deal_status", ACTIVE_STATUSES)
        .order("deal_name");
      if (scopeClause) q = q.or(scopeClause);
      const { data } = await q;
      const visible = (data || []).filter((d: any) =>
        isAdmin || accessIds.has(d.id) ||
        inAliases(d.vsd) || inAliases(d.principal_bopm) ||
        inAliases(d.senior_bopm) || inAliases(d.bopm),
      );
      return visible.map((d: any) => ({ id: d.id, deal_name: d.deal_name, account: d.account }));
    },
  });
}

// --- quota + closed amount ----------------------------------------------

export function useHomeQuotaQuery(opts: {
  userId: string | undefined;
  periodType: "year";
  aliases: Set<string>;
  accessIds: Set<string>;
  isAdmin: boolean;
}) {
  const { userId, periodType, aliases, accessIds, isAdmin } = opts;
  return useQuery({
    queryKey: [
      "home", "quota", userId ?? "", periodType, isAdmin,
      aliasesKey(aliases), accessKey(accessIds),
    ],
    enabled: !!userId,
    queryFn: async (): Promise<{ quota: QuotaRow | null; closedAmount: number }> => {
      const today = new Date();
      const start = startOfYear(today);
      const end = endOfYear(today);
      const { data: q } = await supabase.from("user_quotas").select("*")
        .eq("user_id", userId!).eq("period_type", periodType)
        .lte("period_start", format(today, "yyyy-MM-dd"))
        .gte("period_end", format(today, "yyyy-MM-dd"))
        .maybeSingle();
      const inAliases = (s: string | null) =>
        !!s && aliases.has((s || "").trim().toLowerCase());
      const scopeClause = buildDealScopeOrClause(aliases, accessIds, isAdmin);
      let q2 = supabase.from("staffing_deals")
        .select("net_deal_value, total_deal_value, vsd, principal_bopm, senior_bopm, bopm, start_date, deal_status")
        .gte("start_date", format(start, "yyyy-MM-dd"))
        .lte("start_date", format(end, "yyyy-MM-dd"));
      if (scopeClause) q2 = q2.or(scopeClause);
      const { data: allDeals } = await q2;
      const mine = (allDeals || []).filter((d: any) =>
        inAliases(d.vsd) || inAliases(d.principal_bopm) ||
        inAliases(d.senior_bopm) || inAliases(d.bopm),
      );
      const closedAmount = mine.reduce(
        (sum: number, d: any) => sum + Number(d.net_deal_value || d.total_deal_value || 0),
        0,
      );
      return { quota: (q as QuotaRow) || null, closedAmount };
    },
  });
}
