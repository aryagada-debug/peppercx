import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { format, isToday, isPast, parseISO, isWithinInterval, addDays, startOfDay } from "date-fns";
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
import {
  CalendarDays, AlertTriangle, Flag, ListTodo, Plus, Trash2,
  ExternalLink, MessageSquare, Clock, CheckCircle2, Loader2, CalendarIcon, Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UtilizationBar } from "@/components/dashboard/UtilizationBar";
import { TaskFormDialog, type TaskData } from "@/components/deals/TaskFormDialog";

const DEAL_STAGES = ["To Do", "In Progress", "In Review", "Done", "Dropped"] as const;
const URGENCIES = ["Low", "Medium", "High", "Critical"] as const;
const PRIORITIES = ["Low", "Medium", "High"] as const;

interface DealTaskRow {
  id: string; deal_id: string; title: string; description: string;
  assignee: string; stage: string; start_date: string | null; end_date: string | null;
  urgency: string; estimated_hours: number; logged_hours: number;
  subtasks: any; auto_regen: boolean; sort_order: number; phase: string;
}
interface CxTaskRow {
  id: string; space_id: string; title: string; assignee: string;
  status: string; start_date: string | null; end_date: string | null; urgency: string;
}
interface MeetingRow {
  id: string; deal_id: string; scheduled_date: string | null;
  week_start: string; status: string; mode: string | null;
}
interface RGYFlagRow {
  id: string; deal_id: string; week_start: string; issue_status: string | null;
  resolution_due_date: string | null; issue_details: string | null;
}
interface InactivityRow { id: string; deal_id: string; channel_id: string; week_start: string; message_count: number }
interface PersonalTodo {
  id: string; user_id: string; title: string; notes: string;
  done: boolean; due_date: string | null; priority: string; sort_order: number;
}
interface DealLite { id: string; deal_name: string; account: string }
interface PersonLite { id: string; name: string; designation: string | null; tbh: boolean }

const PRIORITY_TONE: Record<string, string> = {
  High: "bg-destructive/15 text-destructive",
  Medium: "bg-warning/15 text-warning",
  Low: "bg-muted text-muted-foreground",
};
const URGENCY_TONE: Record<string, string> = {
  Critical: "bg-destructive/15 text-destructive",
  High: "bg-destructive/15 text-destructive",
  Medium: "bg-muted text-muted-foreground",
  Low: "bg-muted text-muted-foreground",
};

function isOverdue(s: string | null) { if (!s) return false; const d = parseISO(s); return isPast(d) && !isToday(d); }
function isDueToday(s: string | null) { if (!s) return false; return isToday(parseISO(s)); }
function isDueWithin(s: string | null, days: number) {
  if (!s) return false;
  return isWithinInterval(parseISO(s), { start: startOfDay(new Date()), end: addDays(new Date(), days) });
}

export default function HomePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [staffingName, setStaffingName] = useState("");
  const [staffingPersonId, setStaffingPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dealTasks, setDealTasks] = useState<DealTaskRow[]>([]);
  const [cxTasks, setCxTasks] = useState<CxTaskRow[]>([]);
  const [deals, setDeals] = useState<Record<string, DealLite>>({});
  const [allPeople, setAllPeople] = useState<PersonLite[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [rgyFlags, setRgyFlags] = useState<RGYFlagRow[]>([]);
  const [inactivity, setInactivity] = useState<InactivityRow[]>([]);
  const [allocationPct, setAllocationPct] = useState<number>(0);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [editingDealTask, setEditingDealTask] = useState<DealTaskRow | null>(null);
  const [dealAssignmentsMap, setDealAssignmentsMap] = useState<Record<string, Set<string>>>({});

  // Stable refs for realtime callbacks
  const aliasesRef = useRef<Set<string>>(new Set());

  const computeAliases = useCallback((dn: string, sn: string, email: string | null | undefined): Set<string> => {
    const s = new Set<string>();
    [dn, sn, email || ""].forEach(v => { const t = (v || "").trim().toLowerCase(); if (t) s.add(t); });
    return s;
  }, []);
  const matchesMe = useCallback((assignee: string | null) => {
    if (!assignee) return false;
    return aliasesRef.current.has(assignee.trim().toLowerCase());
  }, []);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, staffing_person_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const dn = profile?.display_name || user.email || "";
    setDisplayName(dn);
    setStaffingPersonId(profile?.staffing_person_id || null);

    let sn = "";
    if (profile?.staffing_person_id) {
      const { data: p } = await supabase
        .from("staffing_people")
        .select("name")
        .eq("id", profile.staffing_person_id)
        .maybeSingle();
      sn = p?.name || "";
    }
    setStaffingName(sn);
    aliasesRef.current = computeAliases(dn, sn, user.email);
    const aliases = Array.from(aliasesRef.current);

    // Tasks where assignee matches any of our aliases
    const orFilter = aliases.map(a => `assignee.ilike.${a}`).join(",");
    const [{ data: dt }, { data: ct }] = await Promise.all([
      supabase.from("deal_tasks")
        .select("id, deal_id, title, description, assignee, stage, start_date, end_date, urgency, estimated_hours, logged_hours, subtasks, auto_regen, sort_order, phase")
        .or(orFilter),
      supabase.from("cx_tasks")
        .select("id, space_id, title, assignee, status, start_date, end_date, urgency")
        .or(orFilter),
    ]);
    setDealTasks((dt as DealTaskRow[]) || []);
    setCxTasks((ct as CxTaskRow[]) || []);

    // Deals lookup
    const dealIds = Array.from(new Set((dt || []).map((t: any) => t.deal_id)));
    if (dealIds.length) {
      const { data: dealRows } = await supabase
        .from("staffing_deals").select("id, deal_name, account").in("id", dealIds);
      const map: Record<string, DealLite> = {};
      (dealRows || []).forEach((d: any) => { map[d.id] = d; });
      setDeals(map);

      // Staffed people per deal (so dialog can prioritize)
      const { data: assigns } = await supabase
        .from("staffing_assignments").select("deal_id, person_id").in("deal_id", dealIds);
      const m: Record<string, Set<string>> = {};
      (assigns || []).forEach((a: any) => {
        if (!m[a.deal_id]) m[a.deal_id] = new Set();
        m[a.deal_id].add(a.person_id);
      });
      setDealAssignmentsMap(m);
    }

    // All people for the assignee combobox in the dialog
    const { data: peopleRows } = await supabase
      .from("staffing_people").select("id, name, designation, tbh");
    setAllPeople((peopleRows as PersonLite[]) || []);

    // Meetings / flags / allocation (only if user is staffed somewhere)
    let myDealIds: string[] = [];
    if (profile?.staffing_person_id) {
      const { data: mine } = await supabase
        .from("staffing_assignments").select("deal_id").eq("person_id", profile.staffing_person_id);
      myDealIds = Array.from(new Set((mine || []).map((a: any) => a.deal_id)));
    }
    if (myDealIds.length) {
      const today = format(new Date(), "yyyy-MM-dd");
      const horizon = format(addDays(new Date(), 14), "yyyy-MM-dd");
      const [{ data: mbrs }, { data: rgy }, { data: inact }] = await Promise.all([
        supabase.from("mbr_entries")
          .select("id, deal_id, scheduled_date, week_start, status, mode")
          .in("deal_id", myDealIds).gte("scheduled_date", today).lte("scheduled_date", horizon),
        supabase.from("deal_rgy_weekly")
          .select("id, deal_id, week_start, issue_status, resolution_due_date, issue_details")
          .in("deal_id", myDealIds).eq("issue_status", "Open"),
        supabase.from("slack_inactivity_nudges")
          .select("id, deal_id, channel_id, week_start, message_count")
          .in("deal_id", myDealIds).gte("week_start", format(addDays(new Date(), -7), "yyyy-MM-dd")),
      ]);
      setMeetings((mbrs as MeetingRow[]) || []);
      setRgyFlags((rgy as RGYFlagRow[]) || []);
      setInactivity((inact as InactivityRow[]) || []);

      const day = new Date().getDay();
      const monday = new Date();
      monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
      const ws = format(monday, "yyyy-MM-dd");
      const { data: alloc } = await supabase
        .from("staffing_weekly_allocations").select("allocation_pct")
        .eq("person_id", profile.staffing_person_id).eq("week_start", ws);
      setAllocationPct(Math.round((alloc || []).reduce((s: number, r: any) => s + (Number(r.allocation_pct) || 0), 0)));
    }

    const { data: tds } = await supabase
      .from("personal_todos").select("*").eq("user_id", user.id)
      .order("done", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setTodos((tds as PersonalTodo[]) || []);

    setLoading(false);
  }, [user, computeAliases]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime: keep deal_tasks / cx_tasks / personal_todos in sync
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`home-sync-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_tasks" }, (payload: any) => {
        if (payload.eventType === "DELETE") {
          setDealTasks(p => p.filter(t => t.id !== payload.old?.id));
          return;
        }
        const row = payload.new as DealTaskRow;
        const mine = matchesMe(row.assignee);
        setDealTasks(prev => {
          const exists = prev.some(t => t.id === row.id);
          if (mine) return exists ? prev.map(t => t.id === row.id ? row : t) : [...prev, row];
          return exists ? prev.filter(t => t.id !== row.id) : prev;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cx_tasks" }, (payload: any) => {
        if (payload.eventType === "DELETE") {
          setCxTasks(p => p.filter(t => t.id !== payload.old?.id));
          return;
        }
        const row = payload.new as CxTaskRow;
        const mine = matchesMe(row.assignee);
        setCxTasks(prev => {
          const exists = prev.some(t => t.id === row.id);
          if (mine) return exists ? prev.map(t => t.id === row.id ? row : t) : [...prev, row];
          return exists ? prev.filter(t => t.id !== row.id) : prev;
        });
      })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "personal_todos", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            setTodos(p => p.filter(t => t.id !== payload.old?.id));
          } else if (payload.eventType === "INSERT") {
            setTodos(p => p.some(t => t.id === payload.new.id) ? p : [payload.new as PersonalTodo, ...p]);
          } else if (payload.eventType === "UPDATE") {
            setTodos(p => p.map(t => t.id === payload.new.id ? payload.new as PersonalTodo : t));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, matchesMe]);

  // Inline edit helpers (optimistic)
  const updateDealTask = async (id: string, patch: Partial<DealTaskRow>) => {
    const prev = dealTasks;
    setDealTasks(p => p.map(t => t.id === id ? { ...t, ...patch } : t));
    const { error } = await supabase.from("deal_tasks").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); setDealTasks(prev); }
  };
  const updateCxTask = async (id: string, patch: Partial<CxTaskRow>) => {
    const prev = cxTasks;
    setCxTasks(p => p.map(t => t.id === id ? { ...t, ...patch } : t));
    const { error } = await supabase.from("cx_tasks").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); setCxTasks(prev); }
  };

  // Unified task buckets
  type Bucket = {
    kind: "deal" | "cx";
    id: string; title: string; due: string | null; urgency: string;
    stage: string; parentId: string; parentLabel: string; href: string;
    raw: DealTaskRow | CxTaskRow;
  };
  const allTasks: Bucket[] = useMemo(() => {
    const fromDeal: Bucket[] = dealTasks
      .filter(t => t.stage !== "Done" && t.stage !== "Dropped")
      .map(t => ({
        kind: "deal", id: t.id, title: t.title, due: t.end_date, urgency: t.urgency, stage: t.stage,
        parentId: t.deal_id, parentLabel: deals[t.deal_id]?.deal_name || t.deal_id,
        href: `/deals/${t.deal_id}?tab=Tasks`, raw: t,
      }));
    const fromCx: Bucket[] = cxTasks
      .filter(t => t.status !== "Done" && t.status !== "Dropped")
      .map(t => ({
        kind: "cx", id: t.id, title: t.title, due: t.end_date, urgency: t.urgency, stage: t.status,
        parentId: t.space_id, parentLabel: "Central Cx",
        href: `/central-cx`, raw: t,
      }));
    return [...fromDeal, ...fromCx];
  }, [dealTasks, cxTasks, deals]);

  const overdue = useMemo(() => allTasks.filter(t => isOverdue(t.due)), [allTasks]);
  const today = useMemo(() => allTasks.filter(t => isDueToday(t.due)), [allTasks]);
  const upcoming = useMemo(
    () => allTasks.filter(t => t.due && !isOverdue(t.due) && !isDueToday(t.due) && isDueWithin(t.due, 7)),
    [allTasks],
  );

  const onComplete = (b: Bucket) => {
    if (b.kind === "deal") updateDealTask(b.id, { stage: "Done" });
    else updateCxTask(b.id, { status: "Done" });
  };
  const onChangeStage = (b: Bucket, v: string) => {
    if (b.kind === "deal") updateDealTask(b.id, { stage: v });
    else updateCxTask(b.id, { status: v });
  };
  const onChangeUrgency = (b: Bucket, v: string) => {
    if (b.kind === "deal") updateDealTask(b.id, { urgency: v });
    else updateCxTask(b.id, { urgency: v });
  };
  const onChangeDue = (b: Bucket, iso: string | null) => {
    if (b.kind === "deal") updateDealTask(b.id, { end_date: iso });
    else updateCxTask(b.id, { end_date: iso });
  };
  const onOpenEdit = (b: Bucket) => {
    if (b.kind === "deal") setEditingDealTask(b.raw as DealTaskRow);
  };

  // Personal todos
  const [newTodo, setNewTodo] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState<string>("Medium");
  const [newTodoDue, setNewTodoDue] = useState<Date | undefined>();
  const addTodo = async () => {
    if (!user || !newTodo.trim()) return;
    const { error } = await supabase.from("personal_todos").insert({
      user_id: user.id, title: newTodo.trim(), priority: newTodoPriority,
      due_date: newTodoDue ? format(newTodoDue, "yyyy-MM-dd") : null, sort_order: 0,
    });
    if (error) { toast.error(error.message); return; }
    setNewTodo(""); setNewTodoDue(undefined); setNewTodoPriority("Medium");
  };
  const toggleTodo = async (t: PersonalTodo) => {
    const { error } = await supabase.from("personal_todos").update({ done: !t.done }).eq("id", t.id);
    if (error) toast.error(error.message);
  };
  const deleteTodo = async (id: string) => {
    const { error } = await supabase.from("personal_todos").delete().eq("id", id);
    if (error) toast.error(error.message);
  };
  const updateTodoPriority = async (id: string, p: string) => {
    const { error } = await supabase.from("personal_todos").update({ priority: p }).eq("id", id);
    if (error) toast.error(error.message);
  };

  // Save edits from full TaskFormDialog
  const handleDealTaskSave = async (data: TaskData) => {
    if (!editingDealTask) return;
    await updateDealTask(editingDealTask.id, {
      title: data.title,
      description: data.description,
      stage: data.stage,
      assignee: data.assignee,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      urgency: data.urgency,
      estimated_hours: data.estimatedHours || 0,
      subtasks: (data.subtasks || []) as any,
      auto_regen: data.autoRegen || false,
    });
    setEditingDealTask(null);
  };
  const handleDealTaskDelete = async () => {
    if (!editingDealTask) return;
    const id = editingDealTask.id;
    setEditingDealTask(null);
    const { error } = await supabase.from("deal_tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Task deleted");
  };

  // Build assignees list for the dialog (staffed-on-deal first, then everyone else)
  const dialogAssignees = useMemo(() => {
    if (!editingDealTask) return [];
    const staffedSet = dealAssignmentsMap[editingDealTask.deal_id] || new Set<string>();
    const staffed: { id: string; name: string; staffed: boolean; designation?: string }[] = [];
    const others: typeof staffed = [];
    allPeople.forEach(p => {
      if (p.tbh) return;
      const item = { id: p.id, name: p.name, staffed: staffedSet.has(p.id), designation: p.designation || "" };
      if (item.staffed) staffed.push(item); else others.push(item);
    });
    return [...staffed, ...others];
  }, [editingDealTask, dealAssignmentsMap, allPeople]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  const totalFlags = rgyFlags.length + inactivity.length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
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

        <div className="grid grid-cols-12 gap-4">
          {/* My Tasks */}
          <Card className="col-span-12 lg:col-span-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" /> My Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={overdue.length ? "overdue" : "today"}>
                <TabsList className="mb-3">
                  <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
                  <TabsTrigger value="today">Today ({today.length})</TabsTrigger>
                  <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="overdue">
                  <TaskRows tasks={overdue} {...{ onComplete, onChangeStage, onChangeUrgency, onChangeDue, onOpenEdit }} emptyText="No overdue tasks. Nice." />
                </TabsContent>
                <TabsContent value="today">
                  <TaskRows tasks={today} {...{ onComplete, onChangeStage, onChangeUrgency, onChangeDue, onOpenEdit }} emptyText="Nothing due today." />
                </TabsContent>
                <TabsContent value="upcoming">
                  <TaskRows tasks={upcoming} {...{ onComplete, onChangeStage, onChangeUrgency, onChangeDue, onOpenEdit }} emptyText="No tasks in the next 7 days." />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Meetings */}
          <Card className="col-span-12 lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Meetings & MBRs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {meetings.length === 0 && <p className="text-xs text-muted-foreground">Nothing scheduled in the next 2 weeks.</p>}
              {meetings.map(m => (
                <Link key={m.id} to={`/deals/${m.deal_id}?tab=MBR`}
                  className="block rounded-md border border-border bg-card hover:bg-secondary/50 transition-colors p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground truncate">
                      {deals[m.deal_id]?.deal_name || m.deal_id}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {m.scheduled_date && format(parseISO(m.scheduled_date), "dd MMM")}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{m.mode || "MBR"}</Badge>
                    <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Flags */}
          <Card className="col-span-12 lg:col-span-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4 text-destructive" /> Flags & Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rgyFlags.length === 0 && inactivity.length === 0 && (
                <p className="text-xs text-muted-foreground">All clear — no open flags on your deals.</p>
              )}
              {rgyFlags.map(f => (
                <Link key={f.id} to={`/deals/${f.deal_id}?tab=RGY+Health`}
                  className="block rounded-md border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground truncate">{deals[f.deal_id]?.deal_name || f.deal_id}</span>
                    <Badge className="text-[10px] bg-destructive/15 text-destructive">RGY Open</Badge>
                  </div>
                  {f.issue_details && <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{f.issue_details}</p>}
                  {f.resolution_due_date && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Due {format(parseISO(f.resolution_due_date), "dd MMM")}</p>
                  )}
                </Link>
              ))}
              {inactivity.map(i => (
                <Link key={i.id} to={`/deals/${i.deal_id}?tab=MBR`}
                  className="block rounded-md border border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" /> {deals[i.deal_id]?.deal_name || i.deal_id}
                    </span>
                    <Badge className="text-[10px] bg-warning/15 text-warning">Slack inactive</Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {i.message_count} team msg{i.message_count === 1 ? "" : "s"} in last 7d
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Personal To-Do */}
          <Card className="col-span-12 lg:col-span-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-positive" /> Personal To-Do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                  placeholder="Add a personal to-do…"
                  className="h-9 text-sm flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-9 px-2">
                      <CalendarIcon className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={newTodoDue} onSelect={setNewTodoDue} initialFocus />
                  </PopoverContent>
                </Popover>
                <Select value={newTodoPriority} onValueChange={setNewTodoPriority}>
                  <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" onClick={addTodo} disabled={!newTodo.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                {todos.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No personal to-dos yet. Add your first above.</p>
                )}
                {todos.map(t => (
                  <div key={t.id} className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/40 transition-colors",
                    t.done && "opacity-60",
                  )}>
                    <Checkbox checked={t.done} onCheckedChange={() => toggleTodo(t)} />
                    <span className={cn("flex-1 text-xs", t.done && "line-through text-muted-foreground")}>{t.title}</span>
                    {t.due_date && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(parseISO(t.due_date), "dd MMM")}
                      </span>
                    )}
                    <Select value={t.priority} onValueChange={(v) => updateTodoPriority(t.id, v)}>
                      <SelectTrigger className={cn("h-6 px-1.5 text-[10px] border-0 rounded", PRIORITY_TONE[t.priority])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                    <button type="button" onClick={() => deleteTodo(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Allocation strip */}
          {staffingPersonId && (
            <Card className="col-span-12">
              <CardContent className="py-3 flex items-center gap-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium shrink-0">
                  My allocation this week
                </div>
                <div className="flex-1 max-w-md">
                  <UtilizationBar value={allocationPct} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Full edit dialog for deal tasks */}
      {editingDealTask && (
        <TaskFormDialog
          open={!!editingDealTask}
          onOpenChange={(o) => { if (!o) setEditingDealTask(null); }}
          title="Edit Task"
          assignees={dialogAssignees}
          initial={{
            title: editingDealTask.title,
            description: editingDealTask.description || "",
            stage: editingDealTask.stage,
            assignee: editingDealTask.assignee,
            startDate: editingDealTask.start_date || "",
            endDate: editingDealTask.end_date || "",
            urgency: editingDealTask.urgency,
            estimatedHours: Number(editingDealTask.estimated_hours) || 0,
            subtasks: (Array.isArray(editingDealTask.subtasks) ? editingDealTask.subtasks : []) as any,
            autoRegen: !!editingDealTask.auto_regen,
            loggedHours: Number(editingDealTask.logged_hours) || 0,
          }}
          onSubmit={handleDealTaskSave}
          onDelete={handleDealTaskDelete}
        />
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
        <div className="text-base font-semibold tabular-nums">{value}</div>
        <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      </div>
    </div>
  );
}

interface TaskRowsProps {
  tasks: {
    kind: "deal" | "cx";
    id: string; title: string; due: string | null; urgency: string; stage: string;
    parentLabel: string; href: string;
    raw: DealTaskRow | CxTaskRow;
  }[];
  onComplete: (t: any) => void;
  onChangeStage: (t: any, v: string) => void;
  onChangeUrgency: (t: any, v: string) => void;
  onChangeDue: (t: any, iso: string | null) => void;
  onOpenEdit: (t: any) => void;
  emptyText: string;
}
function TaskRows({ tasks, onComplete, onChangeStage, onChangeUrgency, onChangeDue, onOpenEdit, emptyText }: TaskRowsProps) {
  if (tasks.length === 0) return <p className="text-xs text-muted-foreground py-3">{emptyText}</p>;
  return (
    <div className="space-y-1">
      {tasks.map(t => (
        <div key={`${t.kind}-${t.id}`} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/40 transition-colors">
          <Checkbox onCheckedChange={() => onComplete(t)} />
          <button
            type="button"
            onClick={() => t.kind === "deal" && onOpenEdit(t)}
            className={cn(
              "flex-1 text-xs text-foreground truncate text-left",
              t.kind === "deal" ? "hover:underline cursor-pointer" : "cursor-default",
            )}
            title={t.kind === "deal" ? "Click to edit" : undefined}
          >
            {t.title}
          </button>
          <Badge variant="outline" className="text-[10px] shrink-0 max-w-[140px] truncate">{t.parentLabel}</Badge>

          {t.kind === "deal" ? (
            <Select value={t.stage} onValueChange={(v) => onChangeStage(t, v)}>
              <SelectTrigger className="h-6 px-2 text-[10px] w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>{DEAL_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="text-[10px]">{t.stage}</Badge>
          )}

          <Select value={t.urgency || "Medium"} onValueChange={(v) => onChangeUrgency(t, v)}>
            <SelectTrigger className={cn("h-6 px-2 text-[10px] w-[90px] border-0", URGENCY_TONE[t.urgency] || "")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{URGENCIES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded hover:bg-secondary",
                  t.due && isOverdue(t.due) ? "text-destructive font-medium" : "text-muted-foreground",
                )}
              >
                {t.due ? format(parseISO(t.due), "dd MMM") : "Set date"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={t.due ? parseISO(t.due) : undefined}
                onSelect={(d) => onChangeDue(t, d ? format(d, "yyyy-MM-dd") : null)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Link to={t.href} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ))}
    </div>
  );
}
