import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { formatINR } from "@/lib/csvTargets";
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

const DEAL_STAGES = ["To Do", "In Progress", "In Review", "Done", "Dropped"] as const;

interface DealTaskRow {
  id: string; deal_id: string; title: string; description: string;
  assignee: string; stage: string; start_date: string | null; end_date: string | null;
  urgency: string; estimated_hours: number; logged_hours: number;
  subtasks: any; auto_regen: boolean; sort_order: number; phase: string;
}
interface CxTaskRow { id: string; space_id: string; title: string; assignee: string; status: string; start_date: string | null; end_date: string | null; urgency: string; }
interface PersonalTodo { id: string; user_id: string; title: string; notes: string; done: boolean; due_date: string | null; priority: string; sort_order: number; }
interface RGYFlagRow { id: string; deal_id: string; week_start: string; issue_status: string | null; resolution_due_date: string | null; issue_details: string | null; }
interface InactivityRow { id: string; deal_id: string; channel_id: string; week_start: string; message_count: number; }
interface DealLite { id: string; deal_name: string; account: string; end_date?: string | null; }
interface PersonLite { id: string; name: string; designation: string | null; tbh: boolean; }
interface SmartNudge { id: string; type: string; text: string; target_entity_type: string; target_entity_id: string; target_entity_name: string; primary_action_label: string; primary_action_href: string; confidence: number; generated_at: string; snoozed_until: string | null; }
interface UserNotification { id: string; type: string; actor_name: string; body: string; source_entity_type: string; source_entity_id: string; source_entity_name: string; cta_href: string; read: boolean; created_at: string; }
interface RecentView { id: string; entity_type: string; entity_id: string; entity_name: string; viewed_at: string; }
interface UserPin { id: string; entity_type: string; entity_id: string; entity_name: string; pinned_at: string; }
interface QuotaRow { id: string; period_type: string; period_start: string; period_end: string; target_amount: number; }
interface MyDeal { id: string; deal_name: string; account: string; deal_status: string; mrr: number | null; total_deal_value: number | null; end_date: string | null; my_role: string; }

function isOverdue(s: string | null) { if (!s) return false; const d = parseISO(s); return isPast(d) && !isToday(d); }
function isDueToday(s: string | null) { if (!s) return false; return isToday(parseISO(s)); }
function isDueWithin(s: string | null, days: number) {
  if (!s) return false;
  return isWithinInterval(parseISO(s), { start: startOfDay(new Date()), end: addDays(new Date(), days) });
}

export default function HomePage() {
  const { user } = useAuth();
  const { isAdmin, isReadOnly } = useUserRole();
  const navigate = useNavigate();

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
  const [nudges, setNudges] = useState<SmartNudge[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [quota, setQuota] = useState<QuotaRow | null>(null);
  const [closedAmount, setClosedAmount] = useState(0);
  const [periodType, setPeriodType] = useState<"month" | "year">("month");
  const [taskFilter, setTaskFilter] = useState<"all" | "overdue" | "today" | "upcoming">("today");
  const [notifTab, setNotifTab] = useState<"activity" | "mentions">("activity");
  const [mentions, setMentions] = useState<any[]>([]);
  const [recents, setRecents] = useState<RecentView[]>([]);
  const [pins, setPins] = useState<UserPin[]>([]);
  const [myDeals, setMyDeals] = useState<MyDeal[]>([]);
  const [loadingMyDeals, setLoadingMyDeals] = useState(true);

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
    const aliasSet = aliasesRef.current;
    const isMine = (a: string | null) => !!a && aliasSet.has((a || "").trim().toLowerCase());
    const [{ data: dtAll }, { data: ctAll }] = await Promise.all([
      supabase.from("deal_tasks")
        .select("id, deal_id, title, description, assignee, stage, start_date, end_date, urgency, estimated_hours, logged_hours, subtasks, auto_regen, sort_order, phase")
        .neq("assignee", ""),
      supabase.from("cx_tasks").select("id, space_id, title, assignee, status, start_date, end_date, urgency").neq("assignee", ""),
    ]);
    const dt = (dtAll || []).filter((t: any) => isMine(t.assignee));
    const ct = (ctAll || []).filter((t: any) => isMine(t.assignee));
    setDealTasks(dt as DealTaskRow[]);
    setCxTasks(ct as CxTaskRow[]);
    const dealIds = Array.from(new Set(dt.map((t: any) => t.deal_id)));
    if (dealIds.length) {
      const { data: dealRows } = await supabase.from("staffing_deals").select("id, deal_name, account, end_date").in("id", dealIds);
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
  }, [user]);

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
    const mine: MyDeal[] = (data || [])
      .filter((d: any) => inAliases(d.vsd) || inAliases(d.principal_bopm) || inAliases(d.senior_bopm) || inAliases(d.bopm))
      .map((d: any) => {
        let role = "";
        if (inAliases(d.vsd)) role = "VSD";
        else if (inAliases(d.principal_bopm)) role = "Principal BOPM";
        else if (inAliases(d.senior_bopm)) role = "Senior BOPM";
        else if (inAliases(d.bopm)) role = "BOPM";
        return { id: d.id, deal_name: d.deal_name, account: d.account, deal_status: d.deal_status, mrr: d.mrr, total_deal_value: d.total_deal_value, end_date: d.end_date, my_role: role };
      })
      .sort((a, b) => (b.mrr || 0) - (a.mrr || 0));
    setMyDeals(mine);
    setLoadingMyDeals(false);
  }, [user]);

  const loadTodos = useCallback(async () => {
    if (!user) return;
    setLoadingTodos(true);
    const { data } = await supabase.from("personal_todos").select("*").eq("user_id", user.id).order("sort_order");
    setTodos((data as PersonalTodo[]) || []);
    setLoadingTodos(false);
  }, [user]);

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

  const loadQuota = useCallback(async () => {
    if (!user) return;
    setLoadingQuota(true);
    const today = new Date();
    let start: Date, end: Date;
    if (periodType === "month") { start = startOfMonth(today); end = endOfMonth(today); }
    else { start = startOfYear(today); end = endOfYear(today); }

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

  // Initial load - staggered
  useEffect(() => {
    if (!user) return;
    (async () => {
      await loadProfile();
      // Fast cards first
      loadQuota();
      loadTasks();
      loadTodos();
      loadRecentsAndPins();
      // Then signals
      setTimeout(() => { loadFlags(); loadNotifications(); loadMyDeals(); }, 100);
    })();
  }, [user, loadProfile, loadQuota, loadTasks, loadTodos, loadFlags, loadNotifications, loadRecentsAndPins, loadMyDeals]);

  useEffect(() => { if (user) loadQuota(); }, [periodType, user, loadQuota]);

  // Realtime: notifications + nudges
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`home-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => loadNotifications())
      .on("postgres_changes", { event: "*", schema: "public", table: "smart_nudges", filter: `user_id=eq.${user.id}` },
        () => loadNudges())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadNotifications, loadNudges]);

  // Combined task list
  const allMyTasks = useMemo(() => {
    const dt = dealTasks.filter(t => t.stage !== "Done" && t.stage !== "Dropped").map(t => ({
      kind: "deal" as const, id: t.id, title: t.title, due: t.end_date, urgency: t.urgency, stage: t.stage,
      parentLabel: deals[t.deal_id]?.deal_name || t.deal_id, href: `/deals/${t.deal_id}`, raw: t,
    }));
    const ct = cxTasks.filter(t => t.status !== "Done" && t.status !== "Closed").map(t => ({
      kind: "cx" as const, id: t.id, title: t.title, due: t.end_date, urgency: t.urgency, stage: t.status,
      parentLabel: "CX Task", href: `/central-cx`, raw: t,
    }));
    return [...dt, ...ct];
  }, [dealTasks, cxTasks, deals]);

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
    const { error } = await supabase.from("deal_tasks").update({
      title: data.title, description: data.description, stage: data.stage, assignee: data.assignee,
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
            <KpiPill label="Overdue" value={overdue.length} tone="destructive" icon={AlertTriangle} />
            <KpiPill label="Due Today" value={today.length} tone="warning" icon={Clock} />
            <KpiPill label="This Week" value={upcoming.length} tone="primary" icon={CalendarDays} />
            <KpiPill label="Open Flags" value={totalFlags} tone="destructive" icon={Flag} />
          </div>
        </div>

        {/* Row 1: Quota (4) + My Tasks (8) */}
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-4 rounded-xl">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                {periodType === "month" ? "Monthly Target" : "Annual Target"}
              </CardTitle>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
                <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Annual</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loadingQuota ? <Skeleton className="h-32" /> : !quota ? (
                <div className="text-center py-6">
                  <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No quota assigned for this {periodType}.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Ask your admin to set a quota.</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-4">
                    <QuotaDonut pct={quotaMath?.pct || 0} />
                    <div className="flex-1 space-y-2 text-xs">
                      <KvRow label="Closed" value={formatINR(closedAmount)} />
                      <KvRow label="Target" value={formatINR(quota.target_amount)} />
                      <KvRow label="Days left" value={String(quotaMath?.remaining || 0)} />
                    </div>
                  </div>
                  {quotaMath && (
                    <PacePill
                      onPace={quotaMath.onPace}
                      paceDelta={quotaMath.paceDelta}
                      dailyTarget={quotaMath.dailyTarget}
                      elapsed={quotaMath.elapsed}
                      pct={quotaMath.pct}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-12 lg:col-span-8 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" /> My Tasks
                <Badge variant="secondary" className="ml-1 text-[10px]">{allMyTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTasks ? <SkeletonRows /> : (
                <Tabs defaultValue={overdue.length ? "overdue" : "today"}>
                  <TabsList className="mb-3 bg-secondary">
                    <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
                    <TabsTrigger value="today">Today ({today.length})</TabsTrigger>
                    <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overdue">
                    <TaskRows tasks={overdue} onComplete={onTaskComplete} onOpenEdit={(t) => t.kind === "deal" && setEditingDealTask(t.raw)} emptyText="All caught up ✨" readOnly={isReadOnly} />
                  </TabsContent>
                  <TabsContent value="today">
                    <TaskRows tasks={today} onComplete={onTaskComplete} onOpenEdit={(t) => t.kind === "deal" && setEditingDealTask(t.raw)} emptyText="Nothing due today. Nice." readOnly={isReadOnly} />
                  </TabsContent>
                  <TabsContent value="upcoming">
                    <TaskRows tasks={upcoming} onComplete={onTaskComplete} onOpenEdit={(t) => t.kind === "deal" && setEditingDealTask(t.raw)} emptyText="Plan something for the week →" readOnly={isReadOnly} />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

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

          <Card className="col-span-12 lg:col-span-6 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" /> Quick stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">See your assigned deals at the bottom of this page.</p>
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
            <CardContent className="space-y-1">
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
            </CardContent>
          </Card>

          <Card className="col-span-12 lg:col-span-6 rounded-xl">
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
                    <span className={cn("flex-1 text-sm leading-snug", t.done && "line-through text-muted-foreground")}>{t.title}</span>
                    {t.due_date && (
                      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                        {format(parseISO(t.due_date), "dd MMM")}
                      </span>
                    )}
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
                <Clock3 className="h-4 w-4 text-primary" /> Recently viewed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingRecents ? <SkeletonRows /> : recents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Records you visit will appear here for quick access.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {recents.map(r => (
                    <button key={r.id} onClick={() => navigate(`/${r.entity_type === "deal" ? "deals" : "clients"}/${r.entity_id}`)}
                      onContextMenu={(e) => { e.preventDefault(); pinFromRecent(r); }}
                      title={`Viewed ${format(parseISO(r.viewed_at), "dd MMM, h:mm a")} · right-click to pin`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary hover:bg-card hover:border-border border border-transparent px-3 py-1 text-xs text-foreground transition-colors max-w-[200px]">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", recentColor(r.entity_type))} />
                      <span className="truncate">{r.entity_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {pins.length > 0 && (
                <>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
                      <Pin className="h-3 w-3" /> Pinned
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pins.map(p => (
                        <button key={p.id} onClick={() => navigate(`/${p.entity_type === "deal" ? "deals" : "clients"}/${p.entity_id}`)}
                          onContextMenu={(e) => { e.preventDefault(); unpin(p.id); }}
                          title="Right-click to unpin"
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary/20 px-3 py-1 text-xs text-primary transition-colors max-w-[200px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="truncate">{p.entity_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
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
          initial={{
            title: editingDealTask.title, description: editingDealTask.description || "",
            stage: editingDealTask.stage, assignee: editingDealTask.assignee,
            startDate: editingDealTask.start_date || "", endDate: editingDealTask.end_date || "",
            urgency: editingDealTask.urgency,
            estimatedHours: Number(editingDealTask.estimated_hours) || 0,
            subtasks: (Array.isArray(editingDealTask.subtasks) ? editingDealTask.subtasks : []) as any,
            autoRegen: !!editingDealTask.auto_regen,
            loggedHours: Number(editingDealTask.logged_hours) || 0,
          }}
          onSubmit={handleDealTaskSave} onDelete={handleDealTaskDelete} />
      )}
    </AppLayout>
  );
}

function KpiPill({ label, value, tone, icon: Icon }: { label: string; value: number; tone: "destructive" | "warning" | "primary"; icon: any }) {
  const toneCls =
    tone === "destructive" ? "border-destructive/30 bg-destructive/10 text-destructive"
    : tone === "warning" ? "border-warning/30 bg-warning/10 text-warning"
    : "border-primary/30 bg-primary/10 text-primary";
  return (
    <div className={cn("rounded-lg border px-3 py-2 flex items-center gap-2", toneCls)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="leading-tight">
        <div className="text-base font-semibold tabular-nums font-mono">{value}</div>
        <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      </div>
    </div>
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
