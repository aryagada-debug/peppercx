/**
 * Phase 4c-ii: Board / signals / my-deals queries for Home.tsx.
 *
 * - useHomeTasksQuery: deal_tasks + cx_tasks + the per-deal context the
 *   Kanban needs (deal metadata, staffing assignments, picker list of
 *   people) — all scoped by the viewer's alias set / access deal IDs.
 *   Also derives `isVsdViewer` and `myVsdDealIds` so the page doesn't
 *   need to recompute them.
 * - useHomeFlagsQuery: RGY flags + Slack inactivity + expiring deals
 *   (the "Signals" card).
 * - useHomeMyDealsQuery: the "My deals" card + monthly financial
 *   summary / per-deal financials / targets.
 *
 * Each hook owns its own realtime subscription via the shared bridge
 * and exposes optimistic patch helpers where the page mutates rows.
 */
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTableSubscription, invalidatePatcher } from "@/lib/realtime";

// --- shared types --------------------------------------------------------

export interface DealTaskRow {
  id: string; deal_id: string; title: string; description: string;
  assignee: string; stage: string; start_date: string | null; end_date: string | null;
  urgency: string; estimated_hours: number; logged_hours: number;
  subtasks: any; auto_regen: boolean; sort_order: number; phase: string;
  assignees?: string[];
  created_by_name?: string;
  created_at?: string;
}
export interface CxTaskRow {
  id: string; space_id: string; title: string; assignee: string;
  assignees?: string[]; status: string;
  start_date: string | null; end_date: string | null; urgency: string;
}
export interface DealLite {
  id: string; deal_name: string; account: string;
  end_date?: string | null;
  vsd?: string | null;
  principal_bopm?: string | null;
  senior_bopm?: string | null;
  bopm?: string | null;
}
export interface PersonLite {
  id: string; name: string; designation: string | null; tbh: boolean;
}
export interface RGYFlagRow {
  id: string; deal_id: string; week_start: string;
  issue_status: string | null; resolution_due_date: string | null;
  issue_details: string | null;
}
export interface InactivityRow {
  id: string; deal_id: string; channel_id: string;
  week_start: string; message_count: number;
}
export interface MyDeal {
  id: string; deal_name: string; account: string; deal_status: string;
  mrr: number | null; total_deal_value: number | null;
  end_date: string | null; my_role: string;
}
export interface FinBucket {
  contraction: number; delivery: number; invoicing: number; receivables: number;
}

const ACTIVE_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"];
const ZERO_FIN: FinBucket = { contraction: 0, delivery: 0, invoicing: 0, receivables: 0 };

const aliasesKey = (a: Set<string>) => Array.from(a).sort().join("|");
const accessKey = (s: Set<string>) => Array.from(s).sort().join("|");

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

const inAliasFn = (aliases: Set<string>) => (s: string | null) =>
  !!s && aliases.has((s || "").trim().toLowerCase());

// --- tasks ---------------------------------------------------------------

export interface HomeTasksData {
  dealTasks: DealTaskRow[];
  cxTasks: CxTaskRow[];
  deals: Record<string, DealLite>;
  dealAssignmentsMap: Record<string, Set<string>>;
  allPeople: PersonLite[];
  isVsdViewer: boolean;
  myVsdDealIds: Set<string>;
}

const EMPTY_TASKS: HomeTasksData = {
  dealTasks: [], cxTasks: [], deals: {}, dealAssignmentsMap: {},
  allPeople: [], isVsdViewer: false, myVsdDealIds: new Set(),
};

export function useHomeTasksQuery(opts: {
  userId: string | undefined;
  isAdmin: boolean;
  isCapLead: boolean;
  aliases: Set<string>;
  accessIds: Set<string>;
}) {
  const { userId, isAdmin, isCapLead, aliases, accessIds } = opts;
  const qc = useQueryClient();
  const key = useMemo(
    () => ["home", "tasks", userId ?? "", isAdmin, isCapLead,
      aliasesKey(aliases), accessKey(accessIds)] as const,
    [userId, isAdmin, isCapLead, aliases, accessIds],
  );

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async (): Promise<HomeTasksData> => {
      const inAliases = inAliasFn(aliases);
      const scopeClause = buildDealScopeOrClause(aliases, accessIds, isAdmin);

      let scopeQuery = supabase
        .from("staffing_deals")
        .select("id, vsd, principal_bopm, senior_bopm, bopm");
      if (scopeClause) scopeQuery = scopeQuery.or(scopeClause);
      const { data: allDealsForScope } = await scopeQuery;

      const myDealsForScope = (allDealsForScope || []).filter((d: any) =>
        inAliases(d.vsd) || inAliases(d.principal_bopm) ||
        inAliases(d.senior_bopm) || inAliases(d.bopm));
      const aliasDealIds = new Set<string>(myDealsForScope.map((d: any) => d.id));
      accessIds.forEach((id) => aliasDealIds.add(id));
      const myDealIdsForScope = Array.from(aliasDealIds);

      let myVsdDealSet = new Set<string>(
        (allDealsForScope || [])
          .filter((d: any) => inAliases(d.vsd))
          .map((d: any) => d.id),
      );
      if (isCapLead) myVsdDealSet = new Set([...myVsdDealSet, ...accessIds]);
      const isVsdViewer = myVsdDealSet.size > 0;

      let dtQuery = supabase.from("deal_tasks")
        .select("id, deal_id, title, description, assignee, assignees, created_by_name, created_at, stage, start_date, end_date, urgency, estimated_hours, logged_hours, subtasks, auto_regen, sort_order, phase")
        .in("stage", ["To Do", "In Progress", "In Review"]);
      if (!isAdmin && !isVsdViewer) {
        dtQuery = dtQuery.in("deal_id", myDealIdsForScope);
      }
      const [{ data: dtAll }, { data: ctAll }] = await Promise.all([
        dtQuery,
        supabase.from("cx_tasks")
          .select("id, space_id, title, assignee, assignees, status, start_date, end_date, urgency")
          .not("status", "in", "(Done,Closed)"),
      ]);
      const dt = (dtAll || []) as DealTaskRow[];
      const ct = (ctAll || []) as CxTaskRow[];

      const deals: Record<string, DealLite> = {};
      const dealAssignmentsMap: Record<string, Set<string>> = {};
      const dealIds = Array.from(new Set(dt.map((t) => t.deal_id)));
      if (dealIds.length) {
        const { data: dealRows } = await supabase.from("staffing_deals")
          .select("id, deal_name, account, end_date, vsd, principal_bopm, senior_bopm, bopm")
          .in("id", dealIds);
        (dealRows || []).forEach((d: any) => { deals[d.id] = d; });
        const { data: assigns } = await supabase.from("staffing_assignments")
          .select("deal_id, person_id").in("deal_id", dealIds);
        (assigns || []).forEach((a: any) => {
          if (!dealAssignmentsMap[a.deal_id]) dealAssignmentsMap[a.deal_id] = new Set();
          dealAssignmentsMap[a.deal_id].add(a.person_id);
        });
      }

      const { data: peopleRows } = await supabase
        .from("staffing_people")
        .select("id, name, designation, tbh")
        .eq("tbh", false)
        .eq("leaving", false);
      const allPeople = (peopleRows as PersonLite[]) || [];

      return {
        dealTasks: dt, cxTasks: ct, deals, dealAssignmentsMap, allPeople,
        isVsdViewer, myVsdDealIds: myVsdDealSet,
      };
    },
  });

  useTableSubscription({
    table: "deal_tasks",
    enabled: !!userId,
    patcher: invalidatePatcher(key),
  });

  const patch = useCallback(
    (updater: (prev: HomeTasksData) => HomeTasksData) => {
      qc.setQueryData<HomeTasksData>(key, (prev) => updater(prev ?? EMPTY_TASKS));
    },
    [qc, key],
  );
  const patchDealTasks = useCallback(
    (updater: (prev: DealTaskRow[]) => DealTaskRow[]) => {
      patch((prev) => ({ ...prev, dealTasks: updater(prev.dealTasks) }));
    },
    [patch],
  );
  const patchCxTasks = useCallback(
    (updater: (prev: CxTaskRow[]) => CxTaskRow[]) => {
      patch((prev) => ({ ...prev, cxTasks: updater(prev.cxTasks) }));
    },
    [patch],
  );
  const invalidate = useCallback(
    () => { qc.invalidateQueries({ queryKey: key }); },
    [qc, key],
  );

  return {
    ...query,
    data: query.data ?? EMPTY_TASKS,
    patch, patchDealTasks, patchCxTasks, invalidate,
  };
}

// --- flags / signals -----------------------------------------------------

export interface HomeFlagsData {
  rgyFlags: RGYFlagRow[];
  inactivity: InactivityRow[];
  expiringDeals: DealLite[];
  deals: Record<string, DealLite>;
}

const EMPTY_FLAGS: HomeFlagsData = {
  rgyFlags: [], inactivity: [], expiringDeals: [], deals: {},
};

export function useHomeFlagsQuery(opts: {
  userId: string | undefined;
  isAdmin: boolean;
  aliases: Set<string>;
  accessIds: Set<string>;
}) {
  const { userId, isAdmin, aliases, accessIds } = opts;
  return useQuery({
    queryKey: ["home", "flags", userId ?? "", isAdmin,
      aliasesKey(aliases), accessKey(accessIds)],
    enabled: !!userId,
    queryFn: async (): Promise<HomeFlagsData> => {
      const inAliases = inAliasFn(aliases);
      const scopeClause = buildDealScopeOrClause(aliases, accessIds, isAdmin);
      let q = supabase.from("staffing_deals")
        .select("id, deal_name, account, vsd, principal_bopm, senior_bopm, bopm, end_date, deal_status")
        .in("deal_status", ACTIVE_STATUSES);
      if (scopeClause) q = q.or(scopeClause);
      const { data: allDeals } = await q;
      const myDeals = (allDeals || []).filter((d: any) =>
        accessIds.has(d.id) ||
        inAliases(d.vsd) || inAliases(d.principal_bopm) ||
        inAliases(d.senior_bopm) || inAliases(d.bopm));
      const myDealIds = myDeals.map((d: any) => d.id);

      const deals: Record<string, DealLite> = {};
      myDeals.forEach((d: any) => { deals[d.id] = d; });

      let rgyFlags: RGYFlagRow[] = [];
      let inactivity: InactivityRow[] = [];
      if (myDealIds.length) {
        const [{ data: rgy }, { data: inact }] = await Promise.all([
          supabase.from("deal_rgy_weekly")
            .select("id, deal_id, week_start, issue_status, resolution_due_date, issue_details")
            .in("deal_id", myDealIds).eq("issue_status", "Open")
            .order("week_start", { ascending: false }).limit(20),
          supabase.from("slack_inactivity_nudges")
            .select("id, deal_id, channel_id, week_start, message_count")
            .in("deal_id", myDealIds)
            .order("week_start", { ascending: false }).limit(20),
        ]);
        rgyFlags = (rgy as RGYFlagRow[]) || [];
        inactivity = (inact as InactivityRow[]) || [];
      }
      const today = new Date();
      const expiringDeals = myDeals.filter((d: any) => {
        if (!d.end_date) return false;
        const end = new Date(d.end_date);
        const days = (end.getTime() - today.getTime()) / 86400000;
        return days >= 0 && days <= 30;
      }) as DealLite[];

      return { rgyFlags, inactivity, expiringDeals, deals };
    },
    initialData: EMPTY_FLAGS,
  });
}

// --- my deals + financial summary ---------------------------------------

export interface HomeMyDealsData {
  myDeals: MyDeal[];
  finByDeal: Record<string, FinBucket>;
  finSummary: FinBucket;
  finTargets: FinBucket;
}

const EMPTY_MY_DEALS: HomeMyDealsData = {
  myDeals: [], finByDeal: {}, finSummary: { ...ZERO_FIN }, finTargets: { ...ZERO_FIN },
};

export function useHomeMyDealsQuery(opts: {
  userId: string | undefined;
  isAdmin: boolean;
  isCapLead: boolean;
  isCapMember: boolean;
  aliases: Set<string>;
  accessIds: Set<string>;
}) {
  const { userId, isAdmin, isCapLead, isCapMember, aliases, accessIds } = opts;
  return useQuery({
    queryKey: ["home", "myDeals", userId ?? "", isAdmin, isCapLead, isCapMember,
      aliasesKey(aliases), accessKey(accessIds)],
    enabled: !!userId,
    queryFn: async (): Promise<HomeMyDealsData> => {
      const inAliases = inAliasFn(aliases);
      const scopeClause = buildDealScopeOrClause(aliases, accessIds, isAdmin);
      let q = supabase.from("staffing_deals")
        .select("id, deal_name, account, vsd, principal_bopm, senior_bopm, bopm, end_date, deal_status, mrr, total_deal_value")
        .in("deal_status", ACTIVE_STATUSES);
      if (scopeClause) q = q.or(scopeClause);
      const { data } = await q;
      const visible = (data || []).filter((d: any) =>
        isAdmin || accessIds.has(d.id) ||
        inAliases(d.vsd) || inAliases(d.principal_bopm) ||
        inAliases(d.senior_bopm) || inAliases(d.bopm));
      const myDeals: MyDeal[] = visible.map((d: any) => {
        let role = "";
        if (inAliases(d.vsd)) role = "VSD";
        else if (inAliases(d.principal_bopm)) role = "Principal BOPM";
        else if (inAliases(d.senior_bopm)) role = "Senior BOPM";
        else if (inAliases(d.bopm)) role = "BOPM";
        else if (isAdmin) role = "Admin";
        else if (isCapLead) role = "Capability Lead";
        else if (isCapMember) role = "Capability IC";
        return {
          id: d.id, deal_name: d.deal_name, account: d.account,
          deal_status: d.deal_status, mrr: d.mrr, total_deal_value: d.total_deal_value,
          end_date: d.end_date, my_role: role,
        };
      }).sort((a, b) => (b.mrr || 0) - (a.mrr || 0));

      const ids = myDeals.map((d) => d.id);
      if (!ids.length) return { myDeals, finByDeal: {}, finSummary: { ...ZERO_FIN }, finTargets: { ...ZERO_FIN } };

      // Resolve the month to display: current month if any rows exist for the
      // visible deals, else the latest month ≤ today that has rows. Used for
      // BOTH actuals and targets so the tiles align with the "MMM yyyy" label.
      let monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      let { data: fins } = await supabase.from("deal_financials")
        .select("deal_id, consumption, invoiced, received, month")
        .eq("month", monthStart)
        .in("deal_id", ids);
      if (!fins || fins.length === 0) {
        const { data: latestFin } = await supabase.from("deal_financials")
          .select("month").in("deal_id", ids).lte("month", monthStart)
          .order("month", { ascending: false }).limit(1);
        const fallbackMonth = latestFin?.[0]?.month;
        if (fallbackMonth) {
          monthStart = fallbackMonth;
          const res = await supabase.from("deal_financials")
            .select("deal_id, consumption, invoiced, received, month")
            .eq("month", fallbackMonth)
            .in("deal_id", ids);
          fins = res.data || [];
        }
      }
      const finByDeal: Record<string, FinBucket> = {};
      (fins || []).forEach((r: any) => {
        const cur = finByDeal[r.deal_id] || { ...ZERO_FIN };
        const cons = Number(r.consumption) || 0;
        const inv = Number(r.invoiced) || 0;
        const rec = Number(r.received) || 0;
        cur.contraction += cons;
        cur.delivery += cons;
        cur.invoicing += inv;
        cur.receivables += Math.max(0, inv - rec);
        finByDeal[r.deal_id] = cur;
      });
      const finSummary = Object.values(finByDeal).reduce((s, v) => ({
        contraction: s.contraction + v.contraction,
        delivery: s.delivery + v.delivery,
        invoicing: s.invoicing + v.invoicing,
        receivables: s.receivables + v.receivables,
      }), { ...ZERO_FIN });

      let { data: tgts } = await supabase.from("deal_financial_targets")
        .select("deal_id, month, contraction_target, delivery_target, invoicing_target, receivables_target")
        .eq("month", monthStart)
        .in("deal_id", ids);
      if (!tgts || tgts.length === 0) {
        const { data: latest } = await supabase.from("deal_financial_targets")
          .select("month").in("deal_id", ids).lte("month", monthStart)
          .order("month", { ascending: false }).limit(1);
        const fallbackMonth = latest?.[0]?.month;
        if (fallbackMonth) {
          monthStart = fallbackMonth;
          const res = await supabase.from("deal_financial_targets")
            .select("deal_id, month, contraction_target, delivery_target, invoicing_target, receivables_target")
            .eq("month", fallbackMonth)
            .in("deal_id", ids);
          tgts = res.data || [];
        }
      }
      const finTargets = (tgts || []).reduce((s, r: any) => ({
        contraction: s.contraction + (Number(r.contraction_target) || 0),
        delivery: s.delivery + (Number(r.delivery_target) || 0),
        invoicing: s.invoicing + (Number(r.invoicing_target) || 0),
        receivables: s.receivables + (Number(r.receivables_target) || 0),
      }), { ...ZERO_FIN });

      return { myDeals, finByDeal, finSummary, finTargets };
    },
    initialData: EMPTY_MY_DEALS,
  });
}
