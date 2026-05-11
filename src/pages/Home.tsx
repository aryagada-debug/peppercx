import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { formatINR } from "@/lib/csvTargets";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { Link, useNavigate } from "react-router-dom";
import { format, isToday, isPast, parseISO, isWithinInterval, addDays, startOfDay, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, differenceInMinutes, differenceInDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, AlertTriangle, Flag, ListTodo, Plus, Trash2,
  MessageSquare, Clock, CheckCircle2, Loader2, CalendarIcon, Wifi,
  Sparkles, Bell, Pin, Clock3, RefreshCw, Settings as SettingsIcon, X,
  ChevronRight, Target, BellRing, AlertCircle, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TaskFormDialog } from "@/components/deals/TaskFormDialog";
import { useGoogleCalendar, type GCalEvent } from "@/hooks/useGoogleCalendar";
import { CalendarConnectButton } from "@/components/calendar/CalendarConnectButton";
import { useUserRole } from "@/hooks/useUserRole";
import { TaskKanban, type DealTask } from "@/components/deals/TaskKanban";
import { SlackHomeBubble } from "@/components/slack/SlackHomeBubble";
import { CxDatePickerPopover } from "@/components/cx/CxDatePickerPopover";
import { useAccountActivity } from "@/hooks/useAccountActivity";
import { Activity as ActivityIcon } from "lucide-react";
import { useVsdUsers, useBopmDirectory, nameKey } from "@/hooks/useAppUsers";

const DEAL_STAGES = ["To Do", "In Progress", "In Review", "Done", "Dropped"] as const;

interface DealTaskRow {
  id: string; deal_id: string; title: string; description: string;
  assignee: string; stage: string; start_date: string | null; end_date: string | null;
  urgency: string; estimated_hours: number; logged_hours: number;
  subtasks: any; auto_regen: boolean; sort_order: number; phase: string;
  assignees?: string[];
  created_by_name?: string;
  created_at?: string;
}
interface CxTaskRow { id: string; space_id: string; title: string; assignee: string; assignees?: string[]; status: string; start_date: string | null; end_date: string | null; urgency: string; }
interface PersonalTodo {
  id: string;
  user_id: string | null;
  title: string;
  notes: string;
  done: boolean;
  due_date: string | null;
  priority: string;
  sort_order: number;
  assignee_staffing_person_id?: string | null;
  assigned_by_user_id?: string | null;
  assigned_by_name?: string | null;
  assignee_name?: string | null;
}
interface RGYFlagRow { id: string; deal_id: string; week_start: string; issue_status: string | null; resolution_due_date: string | null; issue_details: string | null; }
interface InactivityRow { id: string; deal_id: string; channel_id: string; week_start: string; message_count: number; }
interface DealLite { id: string; deal_name: string; account: string; end_date?: string | null; vsd?: string | null; principal_bopm?: string | null; senior_bopm?: string | null; bopm?: string | null; }
interface PersonLite { id: string; name: string; designation: string | null; tbh: boolean; }
interface SmartNudge { id: string; type: string; text: string; target_entity_type: string; target_entity_id: string; target_entity_name: string; primary_action_label: string; primary_action_href: string; confidence: number; generated_at: string; snoozed_until: string | null; }
interface UserNotification { id: string; type: string; actor_name: string; body: string; source_entity_type: string; source_entity_id: string; source_entity_name: string; cta_href: string; read: boolean; created_at: string; }
interface RecentView { id: string; entity_type: string; entity_id: string; entity_name: string; viewed_at: string; }
interface UserPin { id: string; entity_type: string; entity_id: string; entity_name: string; pinned_at: string; }
interface QuotaRow { id: string; period_type: string; period_start: string; period_end: string; target_amount: number; }
interface MyDeal { id: string; deal_name: string; account: string; deal_status: string; mrr: number | null; total_deal_value: number | null; end_date: string | null; my_role: string; }

const TODO_TASK_PREFIX = "todo:";
const toTodoTaskId = (id: string) => `${TODO_TASK_PREFIX}${id}`;
const fromTodoTaskId = (id: string) => id.startsWith(TODO_TASK_PREFIX) ? id.slice(TODO_TASK_PREFIX.length) : null;

function isOverdue(s: string | null) { if (!s) return false; const d = parseISO(s); return isPast(d) && !isToday(d); }
function isDueToday(s: string | null) { if (!s) return false; return isToday(parseISO(s)); }
function isDueWithin(s: string | null, days: number) {
  if (!s) return false;
  return isWithinInterval(parseISO(s), { start: startOfDay(new Date()), end: addDays(new Date(), days) });
}

export default function HomePage() {
  useCurrencyVersion();
  const { user } = useAuth();
  const { isAdmin, isReadOnly } = useUserRole();
  const navigate = useNavigate();
  const { canonVsd } = useVsdUsers();
  const { bopmUsersForVsd } = useBopmDirectory();

  const [displayName, setDisplayName] = useState("");
  const [staffingName, setStaffingName] = useState("");
  const [staffingPersonId, setStaffingPersonId] = useState<string | null>(null);

  // Per-card loading states (staggered)
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [loadingNudges, setLoadingNudges] = useState(true);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [loadingRecents, setLoadingRecents] = useState(true);

  // Data
  const [dealTasks, setDealTasks] = useState<DealTaskRow[]>([]);
  const [cxTasks, setCxTasks] = useState<CxTaskRow[]>([]);
  const [deals, setDeals] = useState<Record<string, DealLite>>({});
  const [allPeople, setAllPeople] = useState<PersonLite[]>([]);
  const [rgyFlags, setRgyFlags] = useState<RGYFlagRow[]>([]);
  const [inactivity, setInactivity] = useState<InactivityRow[]>([]);
  const [expiringDeals, setExpiringDeals] = useState<DealLite[]>([]);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [editingDealTask, setEditingDealTask] = useState<DealTaskRow | null>(null);
  const [dealAssignmentsMap, setDealAssignmentsMap] = useState<Record<string, Set<string>>>({});
  const [addingTask, setAddingTask] = useState(false);
  const [addTaskDealId, setAddTaskDealId] = useState<string>("");
  const [allActiveDeals, setAllActiveDeals] = useState<{ id: string; deal_name: string; account: string }[]>([]);
  const [nudges, setNudges] = useState<SmartNudge[]>([]);
  // Deal IDs where the viewer is the VSD (active deals only). Tasks on these
  // deals are visible to the VSD even when assigned to a team member.
  const [myVsdDealIds, setMyVsdDealIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [quota, setQuota] = useState<QuotaRow | null>(null);
  const [closedAmount, setClosedAmount] = useState(0);
  const [periodType, setPeriodType] = useState<"year">("year");
  const [taskFilter, setTaskFilter] = useState<"all" | "overdue" | "today" | "upcoming">("today");
  // View-as filter (mirrors Clients & Deals): "me" by default; admins / VSDs
  // can pick "all" or a specific person to see other people's tasks.
  const [taskViewAs, setTaskViewAs] = useState<string>("me"); // "me" | "all" | "created" | personId
  const [isVsdViewer, setIsVsdViewer] = useState(false);
  const [notifTab, setNotifTab] = useState<"activity" | "mentions">("activity");
  // For VSD viewers, restrict the "View tasks for…" dropdown to their team
  // BOPMs (same logic as the BOPM filter on Clients & Deals). Admins see all.
  const myVsdName = useMemo(
    () => (isVsdViewer ? canonVsd(staffingName) : null),
    [isVsdViewer, staffingName, canonVsd]
  );
  const viewAsPeople = useMemo(() => {
    if (isAdmin) return allPeople.filter(p => !p.tbh).slice(0, 200);
    if (isVsdViewer && myVsdName) {
      const teamNames = new Set(
        bopmUsersForVsd(myVsdName).map(b => (b.name || "").trim().toLowerCase())
      );
      return allPeople.filter(p => !p.tbh && teamNames.has((p.name || "").trim().toLowerCase()));
    }
    return [];
  }, [isAdmin, isVsdViewer, myVsdName, bopmUsersForVsd, allPeople]);
  const [mentions, setMentions] = useState<any[]>([]);
  const [recents, setRecents] = useState<RecentView[]>([]);
  const [pins, setPins] = useState<UserPin[]>([]);
  const [myDeals, setMyDeals] = useState<MyDeal[]>([]);
  const [loadingMyDeals, setLoadingMyDeals] = useState(true);

  // Financial summary across deals visible to the user — actual + target this month
  const [finSummary, setFinSummary] = useState<{ contraction: number; delivery: number; invoicing: number; receivables: number }>({ contraction: 0, delivery: 0, invoicing: 0, receivables: 0 });
  const [finTargets, setFinTargets] = useState<{ contraction: number; delivery: number; invoicing: number; receivables: number }>({ contraction: 0, delivery: 0, invoicing: 0, receivables: 0 });
  const [finByDeal, setFinByDeal] = useState<Record<string, { contraction: number; delivery: number; invoicing: number; receivables: number }>>({});
  const [finDrill, setFinDrill] = useState<null | "contraction" | "delivery" | "invoicing" | "receivables">(null);

  // Google Calendar
  const { connected: calConnected, listEvents: calListEvents } = useGoogleCalendar();
  const [calEvents, setCalEvents] = useState<GCalEvent[]>([]);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const int = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(int);
  }, []);
  useEffect(() => {
    if (!calConnected) { setCalEvents([]); return; }
    const tMin = startOfDay(new Date()).toISOString();
    const tMax = addDays(new Date(), 1).toISOString();
    calListEvents({ timeMin: tMin, timeMax: tMax, maxResults: 20 }).then(setCalEvents);
  }, [calConnected, calListEvents]);

  const aliasesRef = useRef<Set<string>>(new Set());

  const computeAliases = (dn: string, sn: string, email: string | null | undefined): Set<string> => {
    const s = new Set<string>();
    [dn, sn, email || ""].forEach(v => { const t = (v || "").trim().toLowerCase(); if (t) s.add(t); });
    return s;
  };

  const loadProfile = useCallback(async () => {
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles").select("display_name, staffing_person_id").eq("user_id", user.id).maybeSingle();
    const dn = profile?.display_name || user.email || "";
    setDisplayName(dn);
    setStaffingPersonId(profile?.staffing_person_id || null);
    let sn = "";
    if (profile?.staffing_person_id) {
      const { data: p } = await supabase.from("staffing_people").select("name").eq("id", profile.staffing_person_id).maybeSingle();
      sn = p?.name || "";
    }
    if (!sn && user.email) {
      const { data: pByEmail } = await supabase.from("staffing_people").select("name").ilike("email", user.email).maybeSingle();
      sn = pByEmail?.name || "";
    }
    setStaffingName(sn);
    aliasesRef.current = computeAliases(dn, sn, user.email);
    return { aliases: aliasesRef.current, staffingPersonId: profile?.staffing_person_id || null };
  }, [user]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoadingTasks(true);
    // First scope by deals the viewer is on (any role column matches their
    // aliases). For non-admin viewers this dramatically shrinks the
    // deal_tasks payload and avoids the 1000-row default cap missing the
    // viewer's / their BOPMs' tasks when total tasks are large.
    const aliasSet = aliasesRef.current;
    const inAliases = (s: string | null) => !!s && aliasSet.has((s || "").trim().toLowerCase());
    const { data: allDealsForScope } = await supabase
      .from("staffing_deals")
      .select("id, vsd, principal_bopm, senior_bopm, bopm")
      .range(0, 9999);
    const myDealsForScope = (allDealsForScope || []).filter((d: any) =>
      inAliases(d.vsd) || inAliases(d.principal_bopm) || inAliases(d.senior_bopm) || inAliases(d.bopm));
    const myDealIdsForScope = myDealsForScope.map((d: any) => d.id);
    const myVsdDealSet = new Set(
      (allDealsForScope || []).filter((d: any) => inAliases(d.vsd)).map((d: any) => d.id)
    );
    const isVsd = myVsdDealSet.size > 0;
    setIsVsdViewer(isVsd);
    setMyVsdDealIds(myVsdDealSet);

    // Build the deal_tasks query: scope to viewer's deals unless admin.
    // Bypass PostgREST's default 1000-row cap with an explicit range.
    let dtQuery = supabase.from("deal_tasks")
      .select("id, deal_id, title, description, assignee, assignees, created_by_name, created_at, stage, start_date, end_date, urgency, estimated_hours, logged_hours, subtasks, auto_regen, sort_order, phase")
      .range(0, 49999);
    if (!isAdmin && !isVsd) {
      dtQuery = dtQuery.in("deal_id", myDealIdsForScope);
    }
    const [{ data: dtAll }, { data: ctAll }] = await Promise.all([
      dtQuery,
      supabase.from("cx_tasks").select("id, space_id, title, assignee, assignees, status, start_date, end_date, urgency").range(0, 9999),
    ]);
    const dt = (dtAll || []) as any[];
    const ct = (ctAll || []) as any[];
    setDealTasks(dt as DealTaskRow[]);
    setCxTasks(ct as CxTaskRow[]);
    const dealIds = Array.from(new Set(dt.map((t: any) => t.deal_id)));
    if (dealIds.length) {
      const { data: dealRows } = await supabase.from("staffing_deals").select("id, deal_name, account, end_date, vsd, principal_bopm, senior_bopm, bopm").in("id", dealIds);
      const map: Record<string, DealLite> = {};
      (dealRows || []).forEach((d: any) => { map[d.id] = d; });
      setDeals(prev => ({ ...prev, ...map }));
      const { data: assigns } = await supabase.from("staffing_assignments").select("deal_id, person_id").in("deal_id", dealIds);
      const m: Record<string, Set<string>> = {};
      (assigns || []).forEach((a: any) => { if (!m[a.deal_id]) m[a.deal_id] = new Set(); m[a.deal_id].add(a.person_id); });
      setDealAssignmentsMap(m);
    }
    const { data: peopleRows } = await supabase.from("staffing_people").select("id, name, designation, tbh");
    setAllPeople((peopleRows as PersonLite[]) || []);
    setLoadingTasks(false);
  }, [user, isAdmin]);

  const loadFlags = useCallback(async () => {
    if (!user) return;
    setLoadingFlags(true);
    const aliasSet = aliasesRef.current;
    const inAliases = (s: string | null) => !!s && aliasSet.has((s || "").trim().toLowerCase());
    const { data: allDeals } = await supabase.from("staffing_deals")
      .select("id, deal_name, account, vsd, principal_bopm, senior_bopm, bopm, end_date, deal_status")
      .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);
    const myDeals = (allDeals || []).filter((d: any) =>
      inAliases(d.vsd) || inAliases(d.principal_bopm) || inAliases(d.senior_bopm) || inAliases(d.bopm));
    const myDealIds = myDeals.map((d: any) => d.id);
    // Track VSD-only scope separately so we can show team tasks on those deals.
    setMyVsdDealIds(new Set((allDeals || []).filter((d: any) => inAliases(d.vsd)).map((d: any) => d.id)));
    const dealMap: Record<string, DealLite> = {};
    myDeals.forEach((d: any) => { dealMap[d.id] = d; });
    setDeals(prev => ({ ...prev, ...dealMap }));

    if (myDealIds.length) {
      const [{ data: rgy }, { data: inact }] = await Promise.all([
        supabase.from("deal_rgy_weekly").select("id, deal_id, week_start, issue_status, resolution_due_date, issue_details")
          .in("deal_id", myDealIds).eq("issue_status", "Open").order("week_start", { ascending: false }).limit(20),
        supabase.from("slack_inactivity_nudges").select("id, deal_id, channel_id, week_start, message_count")
          .in("deal_id", myDealIds).order("week_start", { ascending: false }).limit(20),
      ]);
      setRgyFlags((rgy as RGYFlagRow[]) || []);
      setInactivity((inact as InactivityRow[]) || []);
    }
    const today = new Date();
    const expiring = myDeals.filter((d: any) => {
      if (!d.end_date) return false;
      const end = new Date(d.end_date);
      const days = (end.getTime() - today.getTime()) / 86400000;
      return days >= 0 && days <= 30;
    });
    setExpiringDeals(expiring as DealLite[]);
    setLoadingFlags(false);
  }, [user]);

  const loadMyDeals = useCallback(async () => {
    if (!user) return;
    setLoadingMyDeals(true);
    const aliasSet = aliasesRef.current;
    const inAliases = (s: string | null) => !!s && aliasSet.has((s || "").trim().toLowerCase());
    const { data } = await supabase.from("staffing_deals")
      .select("id, deal_name, account, vsd, principal_bopm, senior_bopm, bopm, end_date, deal_status, mrr, total_deal_value")
      .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);
    const visible = (data || []).filter((d: any) => isAdmin || inAliases(d.vsd) || inAliases(d.principal_bopm) || inAliases(d.senior_bopm) || inAliases(d.bopm));
    const mine: MyDeal[] = visible
      .map((d: any) => {
        let role = "";
        if (inAliases(d.vsd)) role = "VSD";
        else if (inAliases(d.principal_bopm)) role = "Principal BOPM";
        else if (inAliases(d.senior_bopm)) role = "Senior BOPM";
        else if (inAliases(d.bopm)) role = "BOPM";
        else if (isAdmin) role = "Admin";
        return { id: d.id, deal_name: d.deal_name, account: d.account, deal_status: d.deal_status, mrr: d.mrr, total_deal_value: d.total_deal_value, end_date: d.end_date, my_role: role };
      })
      .sort((a, b) => (b.mrr || 0) - (a.mrr || 0));
    setMyDeals(mine);
    // Aggregate financials for these deals
    const ids = mine.map(d => d.id);
    if (ids.length) {
      const { data: fins } = await supabase.from("deal_financials")
        .select("deal_id, consumption, invoiced, received").in("deal_id", ids);
      const byDeal: Record<string, { contraction: number; delivery: number; invoicing: number; receivables: number }> = {};
      (fins || []).forEach((r: any) => {
        const cur = byDeal[r.deal_id] || { contraction: 0, delivery: 0, invoicing: 0, receivables: 0 };
        const cons = Number(r.consumption) || 0;
        const inv = Number(r.invoiced) || 0;
        const rec = Number(r.received) || 0;
        cur.contraction += cons;
        cur.delivery += cons;
        cur.invoicing += inv;
        cur.receivables += Math.max(0, inv - rec);
        byDeal[r.deal_id] = cur;
      });
      setFinByDeal(byDeal);
      const totals = Object.values(byDeal).reduce((s, v) => ({
        contraction: s.contraction + v.contraction,
        delivery: s.delivery + v.delivery,
        invoicing: s.invoicing + v.invoicing,
        receivables: s.receivables + v.receivables,
      }), { contraction: 0, delivery: 0, invoicing: 0, receivables: 0 });
      setFinSummary(totals);
      // Targets for the current month (cap to deal scope). If the current month has no
      // imported targets yet, fall back to the most recent month that does.
      let monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      let { data: tgts } = await supabase.from("deal_financial_targets")
        .select("deal_id, month, contraction_target, delivery_target, invoicing_target, receivables_target")
        .eq("month", monthStart)
        .in("deal_id", ids);
      if (!tgts || tgts.length === 0) {
        const { data: latest } = await supabase.from("deal_financial_targets")
          .select("month")
          .in("deal_id", ids)
          .lte("month", monthStart)
          .order("month", { ascending: false })
          .limit(1);
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
      const tTotals = (tgts || []).reduce((s, r: any) => ({
        contraction: s.contraction + (Number(r.contraction_target) || 0),
        delivery: s.delivery + (Number(r.delivery_target) || 0),
        invoicing: s.invoicing + (Number(r.invoicing_target) || 0),
        receivables: s.receivables + (Number(r.receivables_target) || 0),
      }), { contraction: 0, delivery: 0, invoicing: 0, receivables: 0 });
      setFinTargets(tTotals);
    } else {
      setFinByDeal({});
      setFinSummary({ contraction: 0, delivery: 0, invoicing: 0, receivables: 0 });
      setFinTargets({ contraction: 0, delivery: 0, invoicing: 0, receivables: 0 });
    }
    setLoadingMyDeals(false);
  }, [user, isAdmin]);

  const loadTodos = useCallback(async () => {
    if (!user) return;
    setLoadingTodos(true);
    // Show todos I own, todos I assigned, or todos targeted at my staffing identity
    const orParts = [
      `user_id.eq.${user.id}`,
      `assigned_by_user_id.eq.${user.id}`,
    ];
    if (staffingPersonId) {
      orParts.push(`assignee_staffing_person_id.eq.${staffingPersonId}`);
    }
    const { data } = await supabase
      .from("personal_todos")
      .select("*")
      .or(orParts.join(","))
      .order("sort_order");
    setTodos((data as PersonalTodo[]) || []);
    setLoadingTodos(false);
  }, [user, staffingPersonId]);

  const loadNudges = useCallback(async () => {
    if (!user) return;
    setLoadingNudges(true);
    const { data } = await supabase.from("smart_nudges").select("*").eq("user_id", user.id).eq("dismissed", false)
      .order("generated_at", { ascending: false }).limit(20);
    setNudges((data as SmartNudge[]) || []);
    setLoadingNudges(false);
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoadingNotifs(true);
    const { data } = await supabase.from("user_notifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(30);
    setNotifications((data as UserNotification[]) || []);
    setLoadingNotifs(false);
  }, [user]);

  const loadMentions = useCallback(async (slackUserId?: string | null) => {
    if (!slackUserId) { setMentions([]); return; }
    const { data } = await supabase.from("slack_messages")
      .select("id, deal_id, channel_id, user_name, text, slack_ts, thread_ts, created_at")
      .ilike("text", `%<@${slackUserId}>%`)
      .order("created_at", { ascending: false })
      .limit(20);
    setMentions(data || []);
  }, []);

  const loadQuota = useCallback(async () => {
    if (!user) return;
    setLoadingQuota(true);
    const today = new Date();
    const start: Date = startOfYear(today);
    const end: Date = endOfYear(today);

    const { data: q } = await supabase.from("user_quotas").select("*")
      .eq("user_id", user.id).eq("period_type", periodType)
      .lte("period_start", format(today, "yyyy-MM-dd")).gte("period_end", format(today, "yyyy-MM-dd"))
      .maybeSingle();
    setQuota(q as QuotaRow | null);

    // Closed amount: sum net_deal_value of active/won deals where I am VSD/BOPM and start_date in period
    const aliasSet = aliasesRef.current;
    const inAliases = (s: string | null) => !!s && aliasSet.has((s || "").trim().toLowerCase());
    const { data: allDeals } = await supabase.from("staffing_deals")
      .select("net_deal_value, total_deal_value, vsd, principal_bopm, senior_bopm, bopm, start_date, deal_status")
      .gte("start_date", format(start, "yyyy-MM-dd")).lte("start_date", format(end, "yyyy-MM-dd"));
    const mine = (allDeals || []).filter((d: any) =>
      inAliases(d.vsd) || inAliases(d.principal_bopm) || inAliases(d.senior_bopm) || inAliases(d.bopm));
    const total = mine.reduce((sum: number, d: any) => sum + Number(d.net_deal_value || d.total_deal_value || 0), 0);
    setClosedAmount(total);
    setLoadingQuota(false);
  }, [user, periodType]);

  const loadRecentsAndPins = useCallback(async () => {
    if (!user) return;
    setLoadingRecents(true);
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("user_recent_views").select("*").eq("user_id", user.id).order("viewed_at", { ascending: false }).limit(8),
      supabase.from("user_pins").select("*").eq("user_id", user.id).order("pinned_at", { ascending: false }),
    ]);
    setRecents((r as RecentView[]) || []);
    setPins((p as UserPin[]) || []);
    setLoadingRecents(false);
  }, [user]);

  // Load all active deals for the "Add Task" deal picker.
  const loadActiveDeals = useCallback(async () => {
    const aliasSet = aliasesRef.current;
    const inAliases = (s: string | null) => !!s && aliasSet.has((s || "").trim().toLowerCase());
    const { data } = await supabase.from("staffing_deals")
      .select("id, deal_name, account, deal_status, vsd, principal_bopm, senior_bopm, bopm")
      .in("deal_status", ["Active Deal", "New Deal in SLA/PO", "Deal Disputed"])
      .order("deal_name");
    const visible = (data || []).filter((d: any) =>
      isAdmin || inAliases(d.vsd) || inAliases(d.principal_bopm) || inAliases(d.senior_bopm) || inAliases(d.bopm)
    );
    setAllActiveDeals(visible.map((d: any) => ({ id: d.id, deal_name: d.deal_name, account: d.account })));
  }, [isAdmin]);

  // Create a new deal task from Home (two-way synced with the deal's Kanban).
  const handleAddTaskSubmit = useCallback(async (data: any) => {
    if (!addTaskDealId) { toast.error("Pick a deal first"); return; }
    const list: string[] = (data.assignees && data.assignees.length)
      ? data.assignees
      : (data.assignee ? [data.assignee] : []);
    const { error } = await supabase.from("deal_tasks").insert({
      deal_id: addTaskDealId,
      title: data.title || "Untitled task",
      description: data.description || "",
      stage: data.stage || "To Do",
      assignee: list[0] || staffingName || displayName || "",
      assignees: list.length ? list : [staffingName || displayName || ""].filter(Boolean),
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      urgency: data.urgency || "Medium",
      estimated_hours: data.estimatedHours || 0,
      logged_hours: 0,
      subtasks: data.subtasks || [],
      auto_regen: !!data.autoRegen,
      phase: "",
      created_by: user?.id || null,
      created_by_name: staffingName || displayName || "",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Task added");
    setAddingTask(false);
    setAddTaskDealId("");
    loadTasks();
  }, [addTaskDealId, staffingName, displayName, loadTasks, user]);

  // Create an internal personal todo, optionally assigned to another teammate.
  const handleInternalTaskSubmit = useCallback(async (data: {
    title: string;
    notes?: string;
    dueDate?: string | null;
    priority?: string;
    assigneePersonId?: string | null;
    assigneePersonName?: string | null;
  }) => {
    if (!user) { toast.error("Not signed in"); return; }
    if (!data.title?.trim()) { toast.error("Title is required"); return; }

    let ownerUserId: string | null = user.id;
    let assigneeName = "";
    let pendingStaffingPersonId: string | null = null;
    if (data.assigneePersonId) {
      // Use a security-definer RPC because RLS on profiles only exposes
      // the caller's own row — a direct select would always return null
      // for other teammates.
      const { data: resolved } = await supabase
        .rpc("resolve_assignee_user_id", { _staffing_person_id: data.assigneePersonId });
      const prof = Array.isArray(resolved) ? resolved[0] : resolved;
      if (prof?.user_id) {
        ownerUserId = prof.user_id as string;
        assigneeName = (prof.display_name as string) || data.assigneePersonName || "";
      } else {
        // Assignee hasn't signed in yet — create a pending task linked to
        // their staffing identity. It will appear on their list once they
        // sign in (profile gets linked by email).
        ownerUserId = null;
        pendingStaffingPersonId = data.assigneePersonId;
        assigneeName = data.assigneePersonName || "";
      }
    }

    const isSelf = ownerUserId === user.id;
    const { error } = await supabase.from("personal_todos").insert({
      user_id: ownerUserId,
      assignee_staffing_person_id: pendingStaffingPersonId,
      title: data.title.trim(),
      notes: data.notes || "",
      priority: data.priority || "Medium",
      due_date: data.dueDate || null,
      sort_order: todos.length,
      assigned_by_user_id: isSelf ? null : user.id,
      assigned_by_name: isSelf ? "" : (displayName || ""),
      assignee_name: isSelf ? "" : assigneeName,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(
      isSelf
        ? "Internal task added"
        : pendingStaffingPersonId
          ? `Assigned to ${assigneeName} — they'll see it when they sign in`
          : `Internal task assigned to ${assigneeName}`,
    );
    setAddingTask(false);
    setAddTaskDealId("");
    loadTodos();
  }, [user, displayName, todos.length, loadTodos]);

  // Initial load - staggered
  useEffect(() => {
    if (!user) return;
    (async () => {
      const prof = await loadProfile();
      // Fast cards first
      loadQuota();
      loadTasks();
      loadTodos();
      loadRecentsAndPins();
      loadActiveDeals();
      // Then signals
      setTimeout(() => {
        loadFlags();
        loadNotifications();
        loadMyDeals();
        // Load slack mentions if we know the user's slack id
        (async () => {
          if (!prof?.staffingPersonId) return;
          const { data } = await supabase.from("staffing_people")
            .select("slack_user_id").eq("id", prof.staffingPersonId).maybeSingle();
          loadMentions(data?.slack_user_id || null);
        })();
      }, 100);
    })();
  }, [user, loadProfile, loadQuota, loadTasks, loadTodos, loadFlags, loadNotifications, loadRecentsAndPins, loadMyDeals, loadMentions, loadActiveDeals]);

  useEffect(() => { if (user) loadQuota(); }, [periodType, user, loadQuota]);

  // Realtime: notifications + nudges
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`home-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => loadNotifications())
      .on("postgres_changes", { event: "*", schema: "public", table: "smart_nudges", filter: `user_id=eq.${user.id}` },
        () => loadNudges())
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_tasks" },
        () => loadTasks())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadNotifications, loadNudges, loadTasks]);

  // Visible deal/cx tasks, scoped by the "view-as" filter.
  const aliasMatches = useCallback((names: string[], aliases: Set<string>) => {
    return names.some(n => !!n && aliases.has(n.trim().toLowerCase()));
  }, []);

  const taskScopePredicate = useMemo(() => {
    const aliasSet = aliasesRef.current;
    if (taskViewAs === "all") {
      if (isAdmin) return (_t: DealTaskRow | CxTaskRow) => true;
      const teamNames = new Set(viewAsPeople.map(p => nameKey(p.name)));
      return (t: any) => {
        if (t.deal_id && myVsdDealIds.has(t.deal_id)) return true;
        const list: string[] = Array.isArray(t.assignees) && t.assignees.length
          ? t.assignees : (t.assignee ? [t.assignee] : []);
        if (list.some(n => teamNames.has(nameKey(n || "")))) return true;
        const deal = t.deal_id ? deals[t.deal_id] : null;
        return !!deal && [deal.principal_bopm, deal.senior_bopm, deal.bopm].some(v => teamNames.has(nameKey(v || "")));
      };
    }
    if (taskViewAs === "created") {
      const me = (staffingName || displayName || "").trim().toLowerCase();
      return (t: any) => (t.created_by_name || "").trim().toLowerCase() === me;
    }
    if (taskViewAs === "me") {
      return (t: any) => {
        // VSDs see all tasks on the deals where they are VSD (their team).
        if (t.deal_id && myVsdDealIds.has(t.deal_id)) return true;
        const list: string[] = Array.isArray(t.assignees) && t.assignees.length
          ? t.assignees : (t.assignee ? [t.assignee] : []);
        return aliasMatches(list, aliasSet);
      };
    }
    // Specific BOPM/person id: match direct task assignees first. If legacy
    // imported tasks have blank assignees, fall back to the deal's BOPM fields.
    const person = allPeople.find(p => p.id === taskViewAs);
    const target = (person?.name || "").trim().toLowerCase();
    if (!target) return () => false;
    const personAliases = new Set([target]);
    return (t: any) => {
      const list: string[] = Array.isArray(t.assignees) && t.assignees.length
        ? t.assignees : (t.assignee ? [t.assignee] : []);
      if (aliasMatches(list, personAliases)) return true;
      const deal = t.deal_id ? deals[t.deal_id] : null;
      if (!deal) return false;
      return [deal.principal_bopm, deal.senior_bopm, deal.bopm].some(v => nameKey(v || "") === nameKey(target));
    };
  }, [taskViewAs, allPeople, staffingName, displayName, aliasMatches, myVsdDealIds, deals, isAdmin, viewAsPeople]);

  const visibleDealTasks = useMemo(() => dealTasks.filter(taskScopePredicate as any), [dealTasks, taskScopePredicate]);
  const visibleCxTasks = useMemo(() => cxTasks.filter(taskScopePredicate as any), [cxTasks, taskScopePredicate]);

  // Combined task list (drives KPI counts)
  const allMyTasks = useMemo(() => {
    const dt = visibleDealTasks.filter(t => t.stage !== "Done" && t.stage !== "Dropped").map(t => ({
      kind: "deal" as const, id: t.id, title: t.title, due: t.end_date, urgency: t.urgency, stage: t.stage,
      parentLabel: deals[t.deal_id]?.deal_name || t.deal_id, href: `/deals/${t.deal_id}`, raw: t,
    }));
    const ct = visibleCxTasks.filter(t => t.status !== "Done" && t.status !== "Closed").map(t => ({
      kind: "cx" as const, id: t.id, title: t.title, due: t.end_date, urgency: t.urgency, stage: t.status,
      parentLabel: "CX Task", href: `/central-cx`, raw: t,
    }));
    return [...dt, ...ct];
  }, [visibleDealTasks, visibleCxTasks, deals]);

  // Kanban view of my deal tasks (2-way synced via deal_tasks table — same source DealDetail/Staffing uses)
  const myKanbanTasks: DealTask[] = useMemo(() => {
    return visibleDealTasks.map(t => ({
      id: t.id,
      dealId: t.deal_id,
      title: t.title,
      description: t.description || "",
      stage: t.stage,
      assignee: t.assignee,
      assignees: Array.isArray(t.assignees) && t.assignees.length ? t.assignees : (t.assignee ? [t.assignee] : []),
      startDate: t.start_date || undefined,
      endDate: t.end_date || undefined,
      urgency: t.urgency,
      loggedHours: Number(t.logged_hours) || 0,
      sortOrder: t.sort_order || 0,
      estimatedHours: Number(t.estimated_hours) || 0,
      subtasks: (Array.isArray(t.subtasks) ? t.subtasks : []) as any,
      autoRegen: !!t.auto_regen,
      phase: t.phase || "",
      createdAt: t.created_at,
      createdByName: t.created_by_name,
    }));
  }, [visibleDealTasks]);

  // Map dealId -> { dealName, account } for the Kanban cards.
  const dealMeta = useMemo(() => {
    const m: Record<string, { dealName: string; account: string }> = {};
    Object.values(deals).forEach((d: any) => {
      if (d?.id) m[d.id] = { dealName: d.deal_name || "", account: d.account || "" };
    });
    return m;
  }, [deals]);

  // Search across deal/client for My Tasks kanban
  const [taskSearch, setTaskSearch] = useState("");
  const filteredKanbanTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return myKanbanTasks;
    return myKanbanTasks.filter(t => {
      const d = deals[t.dealId];
      return (
        (d?.deal_name || "").toLowerCase().includes(q) ||
        (d?.account || "").toLowerCase().includes(q) ||
        (t.title || "").toLowerCase().includes(q)
      );
    });
  }, [myKanbanTasks, taskSearch, deals]);

  const handleKanbanUpdate = useCallback(async (id: string, updates: Partial<DealTask>) => {
    const prevTask = dealTasks.find(t => t.id === id);
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.stage !== undefined) dbUpdates.stage = updates.stage;
    if (updates.assignee !== undefined) dbUpdates.assignee = updates.assignee;
    if ((updates as any).assignees !== undefined) {
      const list = (updates as any).assignees as string[];
      dbUpdates.assignees = list;
      dbUpdates.assignee = list[0] || "";
    }
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate || null;
    if (updates.urgency !== undefined) dbUpdates.urgency = updates.urgency;
    if (updates.estimatedHours !== undefined) dbUpdates.estimated_hours = updates.estimatedHours;
    if (updates.loggedHours !== undefined) dbUpdates.logged_hours = updates.loggedHours;
    if (updates.subtasks !== undefined) dbUpdates.subtasks = updates.subtasks;
    if (updates.autoRegen !== undefined) dbUpdates.auto_regen = updates.autoRegen;
    // Optimistic
    setDealTasks(prev => prev.map(t => t.id === id ? { ...t, ...dbUpdates } : t));
    const { error } = await supabase.from("deal_tasks").update(dbUpdates).eq("id", id);
    if (error) { toast.error(error.message); loadTasks(); }
    // Auto-regen: clone task back into "To Do" when it lands in Done.
    if (
      !error &&
      prevTask &&
      updates.stage === "Done" &&
      prevTask.stage !== "Done" &&
      (updates.autoRegen ?? prevTask.auto_regen)
    ) {
      const { data: inserted } = await supabase.from("deal_tasks").insert({
        deal_id: prevTask.deal_id,
        title: prevTask.title,
        description: prevTask.description || "",
        assignee: prevTask.assignee || "",
        assignees: Array.isArray(prevTask.assignees) && prevTask.assignees.length
          ? prevTask.assignees
          : (prevTask.assignee ? [prevTask.assignee] : []),
        stage: "To Do",
        end_date: prevTask.end_date || null,
        urgency: prevTask.urgency,
        estimated_hours: prevTask.estimated_hours || 0,
        logged_hours: 0,
        subtasks: (Array.isArray(prevTask.subtasks) ? prevTask.subtasks : []).map((s: any) => ({ ...s, completed: false })),
        auto_regen: true,
        phase: prevTask.phase || "",
        sort_order: 0,
      } as any).select().maybeSingle();
      if (inserted) setDealTasks(prev => [...prev, inserted as any]);
    }
  }, [loadTasks, dealTasks]);

  const handleKanbanDelete = useCallback(async (id: string) => {
    setDealTasks(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("deal_tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Task deleted");
  }, []);

  // Account activity (replaces Recently Viewed) — recomputes when alias set changes
  const { items: activityItems, loading: loadingActivity } = useAccountActivity(aliasesRef.current, !!displayName, 25);

  const overdue = useMemo(() => allMyTasks.filter(t => isOverdue(t.due)), [allMyTasks]);
  const today = useMemo(() => allMyTasks.filter(t => isDueToday(t.due)), [allMyTasks]);
  const upcoming = useMemo(() => allMyTasks.filter(t => !isOverdue(t.due) && !isDueToday(t.due) && isDueWithin(t.due, 7)), [allMyTasks]);

  // Personal todo handlers
  const [newTodo, setNewTodo] = useState("");
  const [newTodoDue, setNewTodoDue] = useState<Date | undefined>();
  const addTodo = async () => {
    if (!user || !newTodo.trim()) return;
    const { error } = await supabase.from("personal_todos").insert({
      user_id: user.id, title: newTodo.trim(), priority: "Medium",
      due_date: newTodoDue ? format(newTodoDue, "yyyy-MM-dd") : null,
      sort_order: todos.length,
    });
    if (error) { toast.error(error.message); return; }
    setNewTodo(""); setNewTodoDue(undefined);
    loadTodos();
  };
  const toggleTodo = async (t: PersonalTodo) => {
    const next = !t.done;
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, done: next } : x));
    await supabase.from("personal_todos").update({ done: next }).eq("id", t.id);
  };
  const updateTodoPriority = async (id: string, p: string) => {
    setTodos(prev => prev.map(x => x.id === id ? { ...x, priority: p } : x));
    await supabase.from("personal_todos").update({ priority: p }).eq("id", id);
  };
  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(x => x.id !== id));
    await supabase.from("personal_todos").delete().eq("id", id);
    toast.success("Deleted");
  };

  // Task complete (deal/cx)
  const onTaskComplete = async (t: any) => {
    if (t.kind === "deal") {
      await supabase.from("deal_tasks").update({ stage: "Done" }).eq("id", t.id);
      setDealTasks(prev => prev.map(x => x.id === t.id ? { ...x, stage: "Done" } : x));
    } else {
      await supabase.from("cx_tasks").update({ status: "Done" }).eq("id", t.id);
      setCxTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: "Done" } : x));
    }
    toast.success("Task completed", { action: { label: "Undo", onClick: () => onTaskUncomplete(t) } });
  };
  const onTaskUncomplete = async (t: any) => {
    if (t.kind === "deal") {
      await supabase.from("deal_tasks").update({ stage: "To Do" }).eq("id", t.id);
      loadTasks();
    } else {
      await supabase.from("cx_tasks").update({ status: "Open" }).eq("id", t.id);
      loadTasks();
    }
  };

  // Smart nudges actions
  const refreshNudges = async () => {
    setLoadingNudges(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-smart-nudges");
      if (error) throw error;
      toast.success(`Generated ${data?.count ?? 0} nudges`);
      loadNudges();
    } catch (e: any) {
      toast.error(e.message || "Failed to refresh nudges");
      setLoadingNudges(false);
    }
  };
  const dismissNudge = async (id: string) => {
    setNudges(prev => prev.filter(n => n.id !== id));
    await supabase.from("smart_nudges").update({ dismissed: true }).eq("id", id);
  };
  const snoozeNudge = async (id: string, days: number) => {
    const until = addDays(new Date(), days).toISOString();
    setNudges(prev => prev.filter(n => n.id !== id));
    await supabase.from("smart_nudges").update({ snoozed_until: until }).eq("id", id);
    toast.success(`Snoozed for ${days}d`);
  };

  // Notifications
  const markAllRead = async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("user_notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  };
  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("user_notifications").update({ read: true }).eq("id", id);
  };
  const dismissNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from("user_notifications").delete().eq("id", id);
  };

  // Pins
  const unpin = async (id: string) => {
    setPins(prev => prev.filter(p => p.id !== id));
    await supabase.from("user_pins").delete().eq("id", id);
  };
  const pinFromRecent = async (r: RecentView) => {
    if (!user) return;
    const { error } = await supabase.from("user_pins").insert({
      user_id: user.id, entity_type: r.entity_type, entity_id: r.entity_id, entity_name: r.entity_name,
    });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else { toast.success("Pinned"); loadRecentsAndPins(); }
  };

  // Quota math
  const quotaMath = useMemo(() => {
    if (!quota) return null;
    const start = parseISO(quota.period_start);
    const end = parseISO(quota.period_end);
    const today = new Date();
    const totalDays = Math.max(1, differenceInDays(end, start) + 1);
    const elapsed = Math.max(0, Math.min(totalDays, differenceInDays(today, start) + 1));
    const remaining = Math.max(0, totalDays - elapsed);
    const idealPace = (quota.target_amount * elapsed) / totalDays;
    const pct = quota.target_amount > 0 ? Math.min(100, (closedAmount / quota.target_amount) * 100) : 0;
    const dailyTarget = remaining > 0 ? Math.max(0, quota.target_amount - closedAmount) / remaining : 0;
    const onPace = closedAmount >= idealPace;
    const paceDelta = idealPace > 0 ? Math.round(((closedAmount - idealPace) / quota.target_amount) * totalDays) : 0;
    return { totalDays, elapsed, remaining, idealPace, pct, dailyTarget, onPace, paceDelta };
  }, [quota, closedAmount]);

  // Greeting
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  // Dialog assignees
  const dialogAssignees = useMemo(() => {
    if (!editingDealTask) return [];
    const staffedSet = dealAssignmentsMap[editingDealTask.deal_id] || new Set<string>();
    const staffed: any[] = []; const others: any[] = [];
    allPeople.forEach(p => {
      if (p.tbh) return;
      const item = { id: p.id, name: p.name, staffed: staffedSet.has(p.id), designation: p.designation || "" };
      if (item.staffed) staffed.push(item); else others.push(item);
    });
    return [...staffed, ...others];
  }, [editingDealTask, dealAssignmentsMap, allPeople]);

  const handleDealTaskSave = async (data: any) => {
    if (!editingDealTask) return;
    const list: string[] = (data.assignees && data.assignees.length)
      ? data.assignees
      : (data.assignee ? [data.assignee] : []);
    const { error } = await supabase.from("deal_tasks").update({
      title: data.title, description: data.description, stage: data.stage,
      assignee: list[0] || "", assignees: list,
      start_date: data.startDate || null, end_date: data.endDate || null, urgency: data.urgency,
      estimated_hours: data.estimatedHours, logged_hours: data.loggedHours,
      subtasks: data.subtasks, auto_regen: data.autoRegen,
    }).eq("id", editingDealTask.id);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); loadTasks(); setEditingDealTask(null); }
  };
  const handleDealTaskDelete = async () => {
    if (!editingDealTask) return;
    await supabase.from("deal_tasks").delete().eq("id", editingDealTask.id);
    toast.success("Deleted"); loadTasks(); setEditingDealTask(null);
  };

  // Today's calendar — derive
  const todaysMeetings = useMemo(() => {
    return calEvents.filter(ev => ev.start && isToday(parseISO(ev.start)))
      .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  }, [calEvents]);

  // Combined flags
  const allFlags = useMemo(() => {
    const f: { id: string; severity: "critical" | "warning" | "info"; type: string; title: string; sub: string; href: string }[] = [];
    rgyFlags.forEach(r => f.push({
      id: `rgy-${r.id}`, severity: "critical", type: "complaint",
      title: `RGY issue — ${deals[r.deal_id]?.deal_name || r.deal_id}`,
      sub: r.issue_details ? r.issue_details.slice(0, 100) : "Resolution pending",
      href: `/deals/${r.deal_id}?tab=RGY+Health`,
    }));
    inactivity.forEach(i => f.push({
      id: `inact-${i.id}`, severity: "warning", type: "health_drop",
      title: `Slack inactivity — ${deals[i.deal_id]?.deal_name || i.deal_id}`,
      sub: `${i.message_count} team msg${i.message_count === 1 ? "" : "s"} in last 7d`,
      href: `/deals/${i.deal_id}?tab=MBR`,
    }));
    expiringDeals.forEach(d => {
      const days = differenceInDays(parseISO(d.end_date!), new Date());
      f.push({
        id: `exp-${d.id}`, severity: days <= 7 ? "critical" : "warning", type: "contract_expiry",
        title: `Contract expiring — ${d.deal_name}`,
        sub: `Ends in ${days} day${days === 1 ? "" : "s"}`, href: `/deals/${d.id}`,
      });
    });
    return f;
  }, [rgyFlags, inactivity, expiringDeals, deals]);

  const totalFlags = allFlags.length;
  const unreadCount = notifications.filter(n => !n.read).length;

  const recentColor = (t: string) => ({
    deal: "bg-primary", account: "bg-warning", contact: "bg-positive",
    project: "bg-pink-500", document: "bg-indigo-500",
  } as Record<string, string>)[t] || "bg-muted-foreground";

  return (
    <AppLayout>
      <div className="px-3 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {greeting}{displayName ? `, ${displayName.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              {format(new Date(), "EEEE, dd MMMM yyyy")}
              <span className="inline-flex items-center gap-1 text-[10px] text-positive">
                <Wifi className="h-3 w-3" /> Live
              </span>
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <KpiPill label="Overdue" value={overdue.length} tone="destructive" icon={AlertTriangle}
              onClick={() => { setTaskFilter("overdue"); document.getElementById("my-tasks-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            <KpiPill label="Due Today" value={today.length} tone="warning" icon={Clock}
              onClick={() => { setTaskFilter("today"); document.getElementById("my-tasks-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            <KpiPill label="This Week" value={upcoming.length} tone="primary" icon={CalendarDays}
              onClick={() => { setTaskFilter("upcoming"); document.getElementById("my-tasks-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            <KpiPill label="Open Flags" value={totalFlags} tone="destructive" icon={Flag}
              onClick={() => { document.getElementById("flags-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
          </div>
        </div>

        {/* My Tasks — full-width Kanban (2-way synced with deal tasks) */}
        <Card id="my-tasks-card" className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" /> My Tasks
                <Badge variant="secondary" className="ml-1 text-[10px]">{myKanbanTasks.length}</Badge>
                <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                  Synced with deal tasks · changes here update everywhere
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {isVsdViewer && !isAdmin && (
                  /* Pill segmented filter — matches Clients & Deals BOPM filter.
                     Selecting a BOPM name shows tasks assigned to that BOPM
                     across all deals (independent of VSD-deal scoping). */
                  <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5 overflow-x-auto max-w-full">
                    {[
                      { key: "me", label: "Me" },
                      { key: "all", label: "All" },
                      ...viewAsPeople.map(p => ({ key: p.id, label: p.name })),
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setTaskViewAs(opt.key)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                          taskViewAs === opt.key
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <Select value={taskViewAs} onValueChange={setTaskViewAs}>
                    <SelectTrigger className="h-7 w-[180px] text-[12px]">
                      <SelectValue placeholder="View tasks for…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">Me</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                      {viewAsPeople.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Search by client or deal…"
                  className="h-7 w-56 text-[12px]"
                />
                <Button
                size="sm"
                onClick={() => { setAddTaskDealId(""); setAddingTask(true); }}
                className="h-7 px-2 text-[12px]"
                disabled={isReadOnly}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTasks ? <SkeletonRows /> : myKanbanTasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-positive/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No tasks assigned to you. Tasks created on a deal where you're tagged will appear here.</p>
              </div>
            ) : filteredKanbanTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">No tasks match "{taskSearch}".</p>
              </div>
            ) : (
              <TaskKanban
                tasks={filteredKanbanTasks}
                dealId=""
                assignees={allPeople.filter(p => !p.tbh).map(p => ({ id: p.id, name: p.name }))}
                onAdd={() => { setAddTaskDealId(""); setAddingTask(true); }}
                onUpdate={handleKanbanUpdate}
                onDelete={handleKanbanDelete}
                compact
                dealMeta={dealMeta}
              />
            )}
          </CardContent>
        </Card>

        {/* Financial Summary — clickable tiles open a drill-down */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Financial Summary
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">{format(new Date(), "MMM yyyy")} • {myDeals.length} deal{myDeals.length === 1 ? "" : "s"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                { key: "contraction" as const, label: "Contraction", actual: finSummary.contraction, target: finTargets.contraction },
                { key: "delivery" as const, label: "Delivery", actual: finSummary.delivery, target: finTargets.delivery },
                { key: "invoicing" as const, label: "Invoicing", actual: finSummary.invoicing, target: finTargets.invoicing },
                { key: "receivables" as const, label: "Receivables Outstanding", actual: finSummary.receivables, target: finTargets.receivables },
              ]).map(t => {
                const pct = t.target > 0 ? Math.min(100, Math.round((t.actual / t.target) * 100)) : 0;
                const onTrack = pct >= 85;
                const warn = pct >= 60 && pct < 85;
                const barCls = onTrack ? "bg-positive" : warn ? "bg-warning" : "bg-destructive";
                const pillCls = onTrack
                  ? "bg-positive/10 text-positive"
                  : warn
                  ? "bg-warning/10 text-warning"
                  : "bg-destructive/10 text-destructive";
                return (
                  <button
                    key={t.key}
                    onClick={() => setFinDrill(t.key)}
                    className="group relative rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/5 p-4 text-left transition-all overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t.label}</p>
                      {t.target > 0 && (
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums", pillCls)}>
                          {pct}%
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70">Actual</p>
                        <p className="text-lg font-semibold font-mono tabular-nums text-foreground leading-tight">{formatINR(t.actual)}</p>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-border/40">
                        <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70">Target</p>
                        <p className="text-xs font-medium font-mono tabular-nums text-muted-foreground">{t.target > 0 ? formatINR(t.target) : "—"}</p>
                      </div>
                    </div>
                    {t.target > 0 && (
                      <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", barCls)} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    <ChevronRight className="absolute top-3 right-3 h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {finDrill && (
          <Dialog open={!!finDrill} onOpenChange={(o) => !o && setFinDrill(null)}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="capitalize">{finDrill} by deal</DialogTitle>
              </DialogHeader>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3">Account</th>
                      <th className="text-left py-2 px-3">Deal</th>
                      <th className="text-right py-2 px-3">{finDrill === "receivables" ? "Outstanding" : "Amount"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myDeals
                      .map(d => ({ d, v: finByDeal[d.id]?.[finDrill] || 0 }))
                      .filter(r => r.v > 0)
                      .sort((a, b) => b.v - a.v)
                      .map(({ d, v }) => (
                        <tr key={d.id} className="border-b border-border/40 hover:bg-accent/10">
                          <td className="py-2 px-3">{d.account}</td>
                          <td className="py-2 px-3">
                            <Link to={`/deals/${d.id}`} className="text-primary hover:underline">{d.deal_name}</Link>
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{formatINR(v)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Row 2: Today's Calendar (6) + Smart Nudges (6) */}
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-6 rounded-xl">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Today's calendar
                <Badge variant="secondary" className="ml-1 text-[10px]">{todaysMeetings.length}</Badge>
              </CardTitle>
              <CalendarConnectButton />
            </CardHeader>
            <CardContent className="space-y-2">
              {!calConnected ? (
                <div className="text-center py-6">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Connect your calendar to see today's meetings.</p>
                </div>
              ) : todaysMeetings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No meetings today — a good day for deep work 🌱</p>
              ) : (
                todaysMeetings.slice(0, 4).map(ev => {
                  const startD = parseISO(ev.start);
                  const endD = ev.end ? parseISO(ev.end) : null;
                  const minsTo = differenceInMinutes(startD, now);
                  const isPastMeeting = endD && endD < now;
                  const isSoon = minsTo > 0 && minsTo <= 30;
                  const isCustomer = (ev.attendees || []).some(a => a.email && !a.email.includes("@pepper"));
                  const barCls = isCustomer ? "bg-primary" : "bg-positive";
                  return (
                    <a key={ev.id} href={ev.htmlLink || "#"} target="_blank" rel="noopener noreferrer"
                      className={cn("flex gap-3 rounded-md border border-border bg-card hover:bg-secondary/40 transition-colors p-2.5 group",
                        isPastMeeting && "opacity-60")}>
                      <div className="w-[68px] shrink-0">
                        {isSoon && <div className="text-[9px] font-bold text-primary mb-0.5">IN {minsTo}M</div>}
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {isPastMeeting ? "✓ " : ""}{format(startD, "h:mm a")}
                        </div>
                      </div>
                      <div className={cn("w-[3px] rounded-full", barCls)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-foreground truncate">{ev.summary}</div>
                        {ev.attendees && ev.attendees.length > 0 && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            with {ev.attendees.slice(0, 2).map(a => a.email?.split("@")[0]).join(", ")}
                            {ev.attendees.length > 2 ? ` · ${ev.attendees.length} attendees` : ""}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })
              )}
            </CardContent>
          </Card>

        </div>

        {/* Row 3: Notifications (6) + Flags (6) */}
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-6 rounded-xl">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Notifications & mentions
                {unreadCount > 0 && <Badge className="ml-1 text-[10px] bg-primary">{unreadCount}</Badge>}
              </CardTitle>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground" onClick={markAllRead}>Mark all read</Button>
              )}
            </CardHeader>
            <CardContent>
              <Tabs value={notifTab} onValueChange={(v) => setNotifTab(v as any)}>
                <TabsList className="mb-3 bg-secondary">
                  <TabsTrigger value="activity">Activity ({notifications.length})</TabsTrigger>
                  <TabsTrigger value="mentions">Slack mentions ({mentions.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="activity" className="space-y-1 mt-0">
                  {loadingNotifs ? <SkeletonRows /> : notifications.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="h-8 w-8 text-positive/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">You're all caught up.</p>
                    </div>
                  ) : notifications.slice(0, 5).map(n => (
                    <div key={n.id} className="group flex items-start gap-2 rounded-md hover:bg-secondary/40 px-2 py-2 transition-colors">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                        {n.actor_name ? n.actor_name.slice(0, 2).toUpperCase() : "📬"}
                      </div>
                      <button type="button" onClick={() => { markRead(n.id); if (n.cta_href) navigate(n.cta_href); }} className="flex-1 text-left min-w-0">
                        <p className="text-[12.5px] leading-snug text-foreground line-clamp-2">
                          <span className="font-semibold">{n.actor_name}</span> {n.body}
                          {n.source_entity_name && <span className="font-semibold"> · {n.source_entity_name}</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{format(parseISO(n.created_at), "dd MMM, h:mm a")}</p>
                      </button>
                      {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />}
                      <button onClick={() => dismissNotification(n.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="mentions" className="space-y-1 mt-0">
                  {mentions.length === 0 ? (
                    <div className="text-center py-6">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No Slack mentions yet.</p>
                    </div>
                  ) : mentions.slice(0, 6).map((m: any) => (
                    <button key={m.id} onClick={() => navigate(`/deals/${m.deal_id}?tab=Slack`)}
                      className="w-full text-left flex items-start gap-2 rounded-md hover:bg-secondary/40 px-2 py-2 transition-colors">
                      <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                        {(m.user_name || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] leading-snug text-foreground line-clamp-2">
                          <span className="font-semibold">{m.user_name || "Slack"}</span> mentioned you · <span className="text-muted-foreground">{m.text}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{format(parseISO(m.created_at), "dd MMM, h:mm a")}</p>
                      </div>
                    </button>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card id="flags-card" className="col-span-12 lg:col-span-6 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <Flag className="h-4 w-4 text-destructive" /> Flags & alerts
                {totalFlags > 0 && <Badge variant="destructive" className="ml-1 text-[10px]">{totalFlags}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingFlags ? <SkeletonRows /> : allFlags.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-positive/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">All clear — no open flags on your deals.</p>
                </div>
              ) : allFlags.slice(0, 6).map(f => (
                <Link key={f.id} to={f.href} className={cn(
                  "flex gap-2 rounded-md p-2.5 transition-colors items-start",
                  f.severity === "critical" ? "border-l-[3px] border-destructive bg-destructive/5 hover:bg-destructive/10"
                    : f.severity === "warning" ? "bg-warning/5 hover:bg-warning/10 border border-warning/20"
                    : "bg-muted/40 hover:bg-muted/60",
                )}>
                  <div className={cn("h-7 w-7 rounded flex items-center justify-center shrink-0",
                    f.severity === "critical" ? "bg-destructive/15 text-destructive"
                      : f.severity === "warning" ? "bg-warning/15 text-warning"
                      : "bg-muted text-muted-foreground")}>
                    {f.type === "contract_expiry" ? <Clock className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-foreground truncate">{f.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{f.sub}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Personal To-Do (6) + Recently Viewed (6) */}
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-6 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-positive" /> Personal to-do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input value={newTodo} onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                  placeholder="Add a personal to-do…" className="h-9 text-sm flex-1" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-9 px-2"><CalendarIcon className="h-3.5 w-3.5" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={newTodoDue} onSelect={setNewTodoDue} initialFocus />
                  </PopoverContent>
                </Popover>
                <Button size="sm" onClick={addTodo} disabled={!newTodo.trim()}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="space-y-1 max-h-[280px] overflow-y-auto">
                {loadingTodos ? <SkeletonRows /> : todos.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No personal to-dos yet. Add your first above.</p>
                ) : todos.map(t => (
                  <div key={t.id} className={cn("group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/40 transition-colors", t.done && "opacity-60")}>
                    <Checkbox checked={t.done} onCheckedChange={() => toggleTodo(t)} />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm leading-snug truncate", t.done && "line-through text-muted-foreground")}>{t.title}</div>
                      {t.assigned_by_user_id && t.assigned_by_user_id !== user?.id && (
                        <div className="text-[10px] text-muted-foreground">from {t.assigned_by_name || "teammate"}</div>
                      )}
                      {t.assigned_by_user_id === user?.id && t.user_id !== user?.id && (
                        <div className="text-[10px] text-muted-foreground">to {t.assignee_name || "teammate"}</div>
                      )}
                    </div>
                    <CxDatePickerPopover
                      value={t.due_date}
                      onChange={async (v) => {
                        setTodos(prev => prev.map(x => x.id === t.id ? { ...x, due_date: v } : x));
                        const { error } = await supabase.from("personal_todos").update({ due_date: v }).eq("id", t.id);
                        if (error) toast.error(error.message);
                      }}
                    >
                      <button
                        type="button"
                        className={cn(
                          "text-[10px] font-mono whitespace-nowrap rounded px-1.5 py-0.5 border border-transparent hover:border-border hover:bg-card transition-colors",
                          t.due_date ? "text-muted-foreground" : "text-muted-foreground/50 opacity-0 group-hover:opacity-100"
                        )}
                        aria-label="Set due date"
                      >
                        {t.due_date ? format(parseISO(t.due_date), "dd MMM") : "+ due date"}
                      </button>
                    </CxDatePickerPopover>
                    <button type="button" onClick={() => deleteTodo(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-12 lg:col-span-6 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <ActivityIcon className="h-4 w-4 text-primary" /> Activity in my accounts
                <Badge variant="secondary" className="ml-1 text-[10px]">{activityItems.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivity ? <SkeletonRows /> : activityItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No recent activity on accounts you're tagged into.</p>
              ) : (
                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                  {activityItems.map(a => {
                    const tone =
                      a.kind === "slack" ? "bg-primary/15 text-primary" :
                      a.kind === "rgy" ? "bg-destructive/15 text-destructive" :
                      a.kind === "mbr" ? "bg-warning/15 text-warning" :
                      "bg-positive/15 text-positive";
                    const Icon =
                      a.kind === "slack" ? MessageSquare :
                      a.kind === "rgy" ? Flag :
                      a.kind === "mbr" ? CalendarDays :
                      ListTodo;
                    return (
                      <button key={a.id} onClick={() => navigate(a.href)}
                        className="w-full text-left flex items-start gap-2 rounded-md hover:bg-secondary/40 px-2 py-2 transition-colors">
                        <div className={cn("h-7 w-7 rounded flex items-center justify-center shrink-0", tone)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] leading-snug text-foreground line-clamp-2">
                            <span className="font-semibold">{a.actor}</span> · {a.text}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {a.deal_name}{a.account ? ` · ${a.account}` : ""} · {format(parseISO(a.at), "dd MMM, h:mm a")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 5: My Deals */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> My Deals
              <Badge variant="secondary" className="ml-1 text-[10px]">{myDeals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMyDeals ? <SkeletonRows /> : myDeals.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No deals assigned to you.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left font-medium py-2 px-2">Deal</th>
                      <th className="text-left font-medium py-2 px-2">Account</th>
                      <th className="text-left font-medium py-2 px-2">My Role</th>
                      <th className="text-right font-medium py-2 px-2">MRR</th>
                      <th className="text-right font-medium py-2 px-2">Total Value</th>
                      <th className="text-left font-medium py-2 px-2">End Date</th>
                      <th className="text-left font-medium py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myDeals.map(d => (
                      <tr key={d.id}
                        onClick={() => navigate(`/deals/${d.id}`)}
                        className="border-b border-border/50 hover:bg-secondary/40 cursor-pointer transition-colors">
                        <td className="py-2 px-2 font-medium text-foreground">{d.deal_name}</td>
                        <td className="py-2 px-2 text-muted-foreground">{d.account || "—"}</td>
                        <td className="py-2 px-2">
                          <Badge variant="secondary" className="text-[10px]">{d.my_role}</Badge>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">{d.mrr ? formatINR(d.mrr) : "—"}</td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">{d.total_deal_value ? formatINR(d.total_deal_value) : "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground">{d.end_date ? format(parseISO(d.end_date), "dd MMM yyyy") : "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground text-[12px]">{d.deal_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editingDealTask && (
        <TaskFormDialog open={!!editingDealTask} onOpenChange={(o) => { if (!o) setEditingDealTask(null); }}
          title="Edit Task" assignees={dialogAssignees}
          headerSubtitle={
            deals[editingDealTask.deal_id]
              ? `Client: ${deals[editingDealTask.deal_id].account || "—"} · Deal: ${deals[editingDealTask.deal_id].deal_name}`
              : undefined
          }
          createdAt={editingDealTask.created_at || null}
          createdByName={editingDealTask.created_by_name || null}
          initial={{
            title: editingDealTask.title, description: editingDealTask.description || "",
            stage: editingDealTask.stage, assignee: editingDealTask.assignee,
            assignees: Array.isArray(editingDealTask.assignees) && editingDealTask.assignees.length
              ? editingDealTask.assignees
              : (editingDealTask.assignee ? [editingDealTask.assignee] : []),
            startDate: editingDealTask.start_date || "", endDate: editingDealTask.end_date || "",
            urgency: editingDealTask.urgency,
            estimatedHours: Number(editingDealTask.estimated_hours) || 0,
            subtasks: (Array.isArray(editingDealTask.subtasks) ? editingDealTask.subtasks : []) as any,
            autoRegen: !!editingDealTask.auto_regen,
            loggedHours: Number(editingDealTask.logged_hours) || 0,
          }}
          onSubmit={handleDealTaskSave} onDelete={handleDealTaskDelete} />
      )}

      {/* Add Task — pick a deal first, then fill task form */}
      {addingTask && (
        <AddTaskDialog
          open={addingTask}
          onOpenChange={(o) => { if (!o) { setAddingTask(false); setAddTaskDealId(""); } }}
          deals={allActiveDeals}
          dealId={addTaskDealId}
          onDealChange={setAddTaskDealId}
          assignees={
            (() => {
              const staffedSet = addTaskDealId ? (dealAssignmentsMap[addTaskDealId] || new Set<string>()) : new Set<string>();
              const staffed: any[] = []; const others: any[] = [];
              allPeople.forEach(p => {
                if (p.tbh) return;
                const item = { id: p.id, name: p.name, staffed: staffedSet.has(p.id), designation: p.designation || "" };
                if (item.staffed) staffed.push(item); else others.push(item);
              });
              return [...staffed, ...others];
            })()
          }
          onSubmit={handleAddTaskSubmit}
          onSubmitInternal={handleInternalTaskSubmit}
          defaultAssignee={staffingName || displayName || ""}
        />
      )}
      {/* Unified Slack bubble — choose Channel or DM */}
      <SlackHomeBubble />
    </AppLayout>
  );
}

function KpiPill({ label, value, tone, icon: Icon, onClick }: { label: string; value: number; tone: "destructive" | "warning" | "primary"; icon: any; onClick?: () => void }) {
  const toneCls =
    tone === "destructive" ? "border-destructive/30 bg-destructive/10 text-destructive"
    : tone === "warning" ? "border-warning/30 bg-warning/10 text-warning"
    : "border-primary/30 bg-primary/10 text-primary";
  const Wrap: any = onClick ? "button" : "div";
  return (
    <Wrap onClick={onClick} type={onClick ? "button" : undefined}
      className={cn("rounded-lg border px-3 py-2 flex items-center gap-2 text-left", toneCls,
        onClick && "hover:brightness-105 cursor-pointer transition-all")}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="leading-tight">
        <div className="text-base font-semibold tabular-nums font-mono">{value}</div>
        <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      </div>
    </Wrap>
  );
}

/* ── Add Task Dialog (Home) ─────────────────────────────────────────────── */
function AddTaskDialog({
  open, onOpenChange, deals, dealId, onDealChange, assignees, onSubmit, onSubmitInternal, defaultAssignee,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deals: { id: string; deal_name: string; account: string }[];
  dealId: string;
  onDealChange: (id: string) => void;
  assignees: { id: string; name: string; staffed?: boolean; designation?: string }[];
  onSubmit: (data: any) => void;
  onSubmitInternal: (data: {
    title: string;
    notes?: string;
    dueDate?: string | null;
    priority?: string;
    assigneePersonId?: string | null;
    assigneePersonName?: string | null;
  }) => void | Promise<void>;
  defaultAssignee: string;
}) {
  const [mode, setMode] = useState<"deal" | "internal">("deal");
  // Internal-task local state
  const [iTitle, setITitle] = useState("");
  const [iNotes, setINotes] = useState("");
  const [iDue, setIDue] = useState<string | null>(null);
  const [iPriority, setIPriority] = useState("Medium");
  const [iAssigneeId, setIAssigneeId] = useState<string>(""); // empty = self
  const [iSearch, setISearch] = useState("");

  useEffect(() => {
    if (open) {
      setMode("deal"); setITitle(""); setINotes(""); setIDue(null);
      setIPriority("Medium"); setIAssigneeId(""); setISearch("");
    }
  }, [open]);

  // Search filter for the deal dropdown.
  const [dealQuery, setDealQuery] = useState("");
  const filtered = useMemo(() => {
    const q = dealQuery.trim().toLowerCase();
    if (!q) return deals.slice(0, 200);
    return deals.filter(d =>
      d.deal_name.toLowerCase().includes(q) || (d.account || "").toLowerCase().includes(q),
    ).slice(0, 200);
  }, [deals, dealQuery]);

  // If a deal is picked, defer to the existing TaskFormDialog so the form
  // matches the rest of the app exactly.
  if (mode === "deal" && dealId) {
    const picked = deals.find(d => d.id === dealId);
    return (
      <TaskFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`New Task — ${picked?.deal_name || dealId}`}
        headerSubtitle={picked ? `Client: ${picked.account || "—"} · Deal: ${picked.deal_name}` : undefined}
        assignees={assignees}
        initial={{
          title: "",
          description: "",
          stage: "To Do",
          assignee: defaultAssignee,
          assignees: defaultAssignee ? [defaultAssignee] : [],
          startDate: "",
          endDate: "",
          urgency: "Medium",
          estimatedHours: 0,
          subtasks: [],
          autoRegen: false,
        }}
        onSubmit={onSubmit}
      />
    );
  }

  const filteredAssignees = useMemo(() => {
    const q = iSearch.trim().toLowerCase();
    if (!q) return assignees.slice(0, 100);
    return assignees.filter(p =>
      p.name.toLowerCase().includes(q) || (p.designation || "").toLowerCase().includes(q)
    ).slice(0, 100);
  }, [assignees, iSearch]);
  const pickedAssignee = assignees.find(p => p.id === iAssigneeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base">Add Task</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 p-1 bg-secondary/40 rounded-md w-fit">
          <button
            type="button"
            onClick={() => setMode("deal")}
            className={cn("px-3 py-1 text-xs rounded transition-colors", mode === "deal" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}
          >Client deal</button>
          <button
            type="button"
            onClick={() => setMode("internal")}
            className={cn("px-3 py-1 text-xs rounded transition-colors", mode === "internal" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}
          >Internal</button>
        </div>
        {mode === "deal" ? (
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Search deals or accounts…"
            value={dealQuery}
            onChange={e => setDealQuery(e.target.value)}
          />
          <div className="max-h-[320px] overflow-y-auto border rounded-md divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground text-center">No matching deals</div>
            ) : filtered.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => onDealChange(d.id)}
                className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors"
              >
                <div className="text-sm font-medium truncate">{d.deal_name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{d.account}</div>
              </button>
            ))}
          </div>
        </div>
        ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input autoFocus value={iTitle} onChange={e => setITitle(e.target.value)} placeholder="What needs to be done?" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={iNotes} onChange={e => setINotes(e.target.value)} rows={3} placeholder="Add context…" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={iPriority} onValueChange={setIPriority}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <CxDatePickerPopover value={iDue} onChange={setIDue}>
                <button type="button" className="h-8 w-full px-2 inline-flex items-center justify-start text-xs rounded-md border border-input bg-background">
                  {iDue ? format(parseISO(iDue), "dd MMM yyyy") : <span className="text-muted-foreground">Pick date</span>}
                </button>
              </CxDatePickerPopover>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Assign to</Label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIAssigneeId("")}
                className={cn("px-2 py-1 rounded border", !iAssigneeId ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary/40")}
              >Myself</button>
              {pickedAssignee && (
                <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[11px]">{pickedAssignee.name}</span>
              )}
            </div>
            <Input
              placeholder="Search teammate by name or designation…"
              value={iSearch}
              onChange={e => setISearch(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-[160px] overflow-y-auto border rounded-md divide-y divide-border">
              {filteredAssignees.length === 0 ? (
                <div className="p-2 text-[11px] text-muted-foreground text-center">No matches</div>
              ) : filteredAssignees.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setIAssigneeId(p.id)}
                  className={cn("w-full text-left px-2.5 py-1.5 hover:bg-accent/50 transition-colors text-xs", p.id === iAssigneeId && "bg-primary/10")}
                >
                  <div className="font-medium truncate">{p.name}</div>
                  {p.designation && <div className="text-[10px] text-muted-foreground truncate">{p.designation}</div>}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => onSubmitInternal({
                title: iTitle,
                notes: iNotes,
                dueDate: iDue,
                priority: iPriority,
                assigneePersonId: iAssigneeId || null,
                assigneePersonName: pickedAssignee?.name || null,
              })}
              disabled={!iTitle.trim()}
            >
              {iAssigneeId ? "Assign task" : "Add to my to-dos"}
            </Button>
          </DialogFooter>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuotaDonut({ pct }: { pct: number }) {
  const r = 45, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative h-[110px] w-[110px] shrink-0">
      <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle cx="55" cy="55" r={r} fill="none" stroke="hsl(var(--positive))" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[22px] font-extrabold tabular-nums font-mono">{Math.round(pct)}%</div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">to goal</div>
      </div>
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-border pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums font-semibold">{value}</span>
    </div>
  );
}

function PacePill({ onPace, paceDelta, dailyTarget, elapsed, pct }: { onPace: boolean; paceDelta: number; dailyTarget: number; elapsed: number; pct: number }) {
  if (elapsed === 0) {
    return <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-center text-muted-foreground">Period just started</div>;
  }
  if (pct >= 100) {
    return <div className="mt-3 rounded-lg bg-positive/15 px-3 py-2 text-xs text-center font-semibold text-positive">🎉 Goal achieved</div>;
  }
  if (Math.abs(paceDelta) <= 1) {
    return <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-center text-primary font-semibold">✓ Right on pace</div>;
  }
  if (onPace) {
    return <div className="mt-3 rounded-lg bg-positive/15 px-3 py-2 text-xs text-center text-positive font-semibold">⚡ {Math.abs(paceDelta)} day{Math.abs(paceDelta) === 1 ? "" : "s"} ahead of pace</div>;
  }
  return (
    <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-center text-destructive font-semibold">
      ⚠ {Math.abs(paceDelta)}d behind — need {formatINR(dailyTarget)}/day
    </div>
  );
}

function SkeletonRows() {
  return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

interface TaskRowsProps {
  tasks: { kind: "deal" | "cx"; id: string; title: string; due: string | null; urgency: string; stage: string; parentLabel: string; href: string; raw: any }[];
  onComplete: (t: any) => void;
  onOpenEdit: (t: any) => void;
  emptyText: string;
  readOnly: boolean;
}
function TaskRows({ tasks, onComplete, onOpenEdit, emptyText, readOnly }: TaskRowsProps) {
  if (tasks.length === 0) return <p className="text-xs text-muted-foreground py-3 text-center">{emptyText}</p>;
  return (
    <div className="space-y-1">
      {tasks.slice(0, 5).map(t => (
        <div key={`${t.kind}-${t.id}`} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/40 transition-colors">
          {!readOnly && <Checkbox onCheckedChange={() => onComplete(t)} />}
          <button type="button" onClick={() => t.kind === "deal" && onOpenEdit(t)}
            className={cn("flex-1 text-[13px] text-foreground truncate text-left",
              t.kind === "deal" ? "hover:underline cursor-pointer" : "cursor-default")}>
            {t.title}
          </button>
          <Badge variant="outline" className="text-[10px] shrink-0 max-w-[140px] truncate">{t.parentLabel}</Badge>
          <Badge className={cn("text-[10px]",
            t.urgency === "Critical" || t.urgency === "High" ? "bg-destructive/15 text-destructive"
              : t.urgency === "Medium" ? "bg-warning/15 text-warning"
              : "bg-muted text-muted-foreground")}>{t.urgency}</Badge>
          {t.due && <span className="text-[10px] font-mono text-muted-foreground">{format(parseISO(t.due), "dd MMM")}</span>}
        </div>
      ))}
      {tasks.length > 5 && (
        <p className="text-[11px] text-muted-foreground text-center pt-1">Show {tasks.length - 5} more →</p>
      )}
    </div>
  );
}
