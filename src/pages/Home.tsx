import { useEffect, useMemo, useState, useCallback } from "react";
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
import {
  CalendarDays, AlertTriangle, Flag, ListTodo, Plus, Trash2,
  ExternalLink, MessageSquare, Clock, CheckCircle2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UtilizationBar } from "@/components/dashboard/UtilizationBar";

type Stage = "To Do" | "In Progress" | "In Review" | "Done" | "Dropped";
interface DealTaskRow {
  id: string; deal_id: string; title: string; assignee: string;
  stage: string; start_date: string | null; end_date: string | null;
  urgency: string; sort_order: number;
}
interface CxTaskRow {
  id: string; space_id: string; title: string; assignee: string;
  status: string; start_date: string | null; end_date: string | null;
  urgency: string;
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

const PRIORITY_TONE: Record<string, string> = {
  High: "bg-destructive/15 text-destructive",
  Medium: "bg-warning/15 text-warning",
  Low: "bg-muted text-muted-foreground",
};

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = parseISO(dateStr);
  return isPast(d) && !isToday(d);
}
function isDueToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return isToday(parseISO(dateStr));
}
function isDueWithin(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;
  const d = parseISO(dateStr);
  return isWithinInterval(d, { start: startOfDay(new Date()), end: addDays(new Date(), days) });
}

export default function HomePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [staffingPersonId, setStaffingPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dealTasks, setDealTasks] = useState<DealTaskRow[]>([]);
  const [cxTasks, setCxTasks] = useState<CxTaskRow[]>([]);
  const [deals, setDeals] = useState<Record<string, DealLite>>({});
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [rgyFlags, setRgyFlags] = useState<RGYFlagRow[]>([]);
  const [inactivity, setInactivity] = useState<InactivityRow[]>([]);
  const [allocationPct, setAllocationPct] = useState<number>(0);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // 1. profile -> displayName + staffing person id
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, staffing_person_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const name = profile?.display_name || user.email || "";
    setDisplayName(name);
    setStaffingPersonId(profile?.staffing_person_id || null);

    // 2. tasks assigned to me (case-insensitive)
    const [{ data: dt }, { data: ct }] = await Promise.all([
      supabase.from("deal_tasks").select("id, deal_id, title, assignee, stage, start_date, end_date, urgency, sort_order").ilike("assignee", name),
      supabase.from("cx_tasks").select("id, space_id, title, assignee, status, start_date, end_date, urgency").ilike("assignee", name),
    ]);
    setDealTasks((dt as DealTaskRow[]) || []);
    setCxTasks((ct as CxTaskRow[]) || []);

    // 3. deals lookup for chips
    const dealIds = Array.from(new Set((dt || []).map((t: any) => t.deal_id)));
    if (dealIds.length) {
      const { data: dealRows } = await supabase
        .from("staffing_deals")
        .select("id, deal_name, account")
        .in("id", dealIds);
      const map: Record<string, DealLite> = {};
      (dealRows || []).forEach((d: any) => { map[d.id] = d; });
      setDeals(map);
    }

    // 4. MBR meetings (next 14 days) for deals user works on
    let myDealIds: string[] = [];
    if (profile?.staffing_person_id) {
      const { data: assigns } = await supabase
        .from("staffing_assignments")
        .select("deal_id")
        .eq("person_id", profile.staffing_person_id);
      myDealIds = Array.from(new Set((assigns || []).map((a: any) => a.deal_id)));
    }
    if (myDealIds.length) {
      const today = format(new Date(), "yyyy-MM-dd");
      const horizon = format(addDays(new Date(), 14), "yyyy-MM-dd");
      const { data: mbrs } = await supabase
        .from("mbr_entries")
        .select("id, deal_id, scheduled_date, week_start, status, mode")
        .in("deal_id", myDealIds)
        .gte("scheduled_date", today)
        .lte("scheduled_date", horizon);
      setMeetings((mbrs as MeetingRow[]) || []);

      const { data: rgy } = await supabase
        .from("deal_rgy_weekly")
        .select("id, deal_id, week_start, issue_status, resolution_due_date, issue_details")
        .in("deal_id", myDealIds)
        .eq("issue_status", "Open");
      setRgyFlags((rgy as RGYFlagRow[]) || []);

      const since = format(addDays(new Date(), -7), "yyyy-MM-dd");
      const { data: inact } = await supabase
        .from("slack_inactivity_nudges")
        .select("id, deal_id, channel_id, week_start, message_count")
        .in("deal_id", myDealIds)
        .gte("week_start", since);
      setInactivity((inact as InactivityRow[]) || []);

      // current week allocation
      const day = new Date().getDay();
      const monday = new Date();
      monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
      const weekStart = format(monday, "yyyy-MM-dd");
      if (profile.staffing_person_id) {
        const { data: alloc } = await supabase
          .from("staffing_weekly_allocations")
          .select("allocation_pct")
          .eq("person_id", profile.staffing_person_id)
          .eq("week_start", weekStart);
        const total = (alloc || []).reduce((s: number, r: any) => s + (Number(r.allocation_pct) || 0), 0);
        setAllocationPct(Math.round(total));
      }
    }

    // 5. personal todos
    const { data: tds } = await supabase
      .from("personal_todos")
      .select("*")
      .eq("user_id", user.id)
      .order("done", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setTodos((tds as PersonalTodo[]) || []);

    setLoading(false);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Derived task buckets
  const allTasks = useMemo(() => {
    const fromDeal = dealTasks
      .filter((t) => t.stage !== "Done" && t.stage !== "Dropped")
      .map((t) => ({
        kind: "deal" as const,
        id: t.id, title: t.title, due: t.end_date,
        urgency: t.urgency, parentId: t.deal_id,
        parentLabel: deals[t.deal_id]?.deal_name || t.deal_id,
        href: `/deals/${t.deal_id}?tab=Tasks`,
      }));
    const fromCx = cxTasks
      .filter((t) => t.status !== "Done" && t.status !== "Dropped")
      .map((t) => ({
        kind: "cx" as const,
        id: t.id, title: t.title, due: t.end_date,
        urgency: t.urgency, parentId: t.space_id,
        parentLabel: "Central Cx",
        href: `/central-cx`,
      }));
    return [...fromDeal, ...fromCx];
  }, [dealTasks, cxTasks, deals]);

  const overdueTasks = useMemo(() => allTasks.filter((t) => isOverdue(t.due)), [allTasks]);
  const todayTasks = useMemo(() => allTasks.filter((t) => isDueToday(t.due)), [allTasks]);
  const upcomingTasks = useMemo(
    () => allTasks.filter((t) => t.due && !isOverdue(t.due) && !isDueToday(t.due) && isDueWithin(t.due, 7)),
    [allTasks],
  );

  const completeDealTask = async (taskId: string) => {
    const { error } = await supabase.from("deal_tasks").update({ stage: "Done" }).eq("id", taskId);
    if (error) toast.error(error.message);
    else { toast.success("Task completed"); setDealTasks((p) => p.filter((t) => t.id !== taskId)); }
  };
  const completeCxTask = async (taskId: string) => {
    const { error } = await supabase.from("cx_tasks").update({ status: "Done" }).eq("id", taskId);
    if (error) toast.error(error.message);
    else { toast.success("Task completed"); setCxTasks((p) => p.filter((t) => t.id !== taskId)); }
  };

  // Personal todos
  const [newTodo, setNewTodo] = useState("");
  const addTodo = async () => {
    if (!user || !newTodo.trim()) return;
    const { data, error } = await supabase
      .from("personal_todos")
      .insert({ user_id: user.id, title: newTodo.trim(), priority: "Medium", sort_order: 0 })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setTodos((p) => [data as PersonalTodo, ...p]);
    setNewTodo("");
  };
  const toggleTodo = async (todo: PersonalTodo) => {
    const next = !todo.done;
    setTodos((p) => p.map((t) => (t.id === todo.id ? { ...t, done: next } : t)));
    const { error } = await supabase.from("personal_todos").update({ done: next }).eq("id", todo.id);
    if (error) { toast.error(error.message); loadAll(); }
  };
  const deleteTodo = async (id: string) => {
    setTodos((p) => p.filter((t) => t.id !== id));
    const { error } = await supabase.from("personal_todos").delete().eq("id", id);
    if (error) { toast.error(error.message); loadAll(); }
  };

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
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {greeting}{displayName ? `, ${displayName.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <KpiPill label="Overdue" value={overdueTasks.length} tone="destructive" icon={AlertTriangle} />
            <KpiPill label="Due Today" value={todayTasks.length} tone="warning" icon={Clock} />
            <KpiPill label="This Week" value={upcomingTasks.length} tone="primary" icon={CalendarDays} />
            <KpiPill label="Open Flags" value={totalFlags} tone="destructive" icon={Flag} />
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* My Tasks */}
          <Card className="col-span-12 lg:col-span-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" /> My Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={overdueTasks.length ? "overdue" : "today"}>
                <TabsList className="mb-3">
                  <TabsTrigger value="overdue">Overdue ({overdueTasks.length})</TabsTrigger>
                  <TabsTrigger value="today">Today ({todayTasks.length})</TabsTrigger>
                  <TabsTrigger value="upcoming">Upcoming ({upcomingTasks.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="overdue"><TaskList tasks={overdueTasks} onComplete={(t) => t.kind === "deal" ? completeDealTask(t.id) : completeCxTask(t.id)} emptyText="No overdue tasks. " /></TabsContent>
                <TabsContent value="today"><TaskList tasks={todayTasks} onComplete={(t) => t.kind === "deal" ? completeDealTask(t.id) : completeCxTask(t.id)} emptyText="Nothing due today." /></TabsContent>
                <TabsContent value="upcoming"><TaskList tasks={upcomingTasks} onComplete={(t) => t.kind === "deal" ? completeDealTask(t.id) : completeCxTask(t.id)} emptyText="No tasks in the next 7 days." /></TabsContent>
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
              {meetings.map((m) => (
                <Link
                  key={m.id}
                  to={`/deals/${m.deal_id}?tab=MBR`}
                  className="block rounded-md border border-border bg-card hover:bg-secondary/50 transition-colors p-2.5"
                >
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

          {/* Flags & Alerts */}
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
              {rgyFlags.map((f) => (
                <Link
                  key={f.id}
                  to={`/deals/${f.deal_id}?tab=RGY+Health`}
                  className="block rounded-md border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground truncate">
                      {deals[f.deal_id]?.deal_name || f.deal_id}
                    </span>
                    <Badge className="text-[10px] bg-destructive/15 text-destructive">RGY Open</Badge>
                  </div>
                  {f.issue_details && (
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{f.issue_details}</p>
                  )}
                  {f.resolution_due_date && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Due {format(parseISO(f.resolution_due_date), "dd MMM")}</p>
                  )}
                </Link>
              ))}
              {inactivity.map((i) => (
                <Link
                  key={i.id}
                  to={`/deals/${i.deal_id}?tab=MBR`}
                  className="block rounded-md border border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" />
                      {deals[i.deal_id]?.deal_name || i.deal_id}
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
                  className="h-9 text-sm"
                />
                <Button size="sm" onClick={addTodo} disabled={!newTodo.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                {todos.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No personal to-dos yet. Add your first above.</p>
                )}
                {todos.map((t) => (
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
                    <Badge className={cn("text-[10px]", PRIORITY_TONE[t.priority] || "")}>{t.priority}</Badge>
                    <button
                      type="button"
                      onClick={() => deleteTodo(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Delete"
                    >
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
    </AppLayout>
  );
}

function KpiPill({
  label, value, tone, icon: Icon,
}: { label: string; value: number; tone: "destructive" | "warning" | "primary"; icon: any }) {
  const toneCls =
    tone === "destructive"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : tone === "warning"
      ? "border-warning/30 bg-warning/10 text-warning"
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

interface TaskListItem {
  kind: "deal" | "cx";
  id: string; title: string; due: string | null; urgency: string;
  parentLabel: string; href: string;
}
function TaskList({ tasks, onComplete, emptyText }: {
  tasks: TaskListItem[];
  onComplete: (t: TaskListItem) => void;
  emptyText: string;
}) {
  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{emptyText}</p>;
  }
  return (
    <div className="space-y-1">
      {tasks.map((t) => (
        <div key={`${t.kind}-${t.id}`} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/40 transition-colors">
          <Checkbox onCheckedChange={() => onComplete(t)} />
          <span className="flex-1 text-xs text-foreground truncate">{t.title}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">{t.parentLabel}</Badge>
          {t.urgency && t.urgency !== "Medium" && (
            <Badge className={cn(
              "text-[10px] shrink-0",
              t.urgency === "High" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
            )}>{t.urgency}</Badge>
          )}
          {t.due && (
            <span className={cn(
              "text-[10px] tabular-nums shrink-0",
              isOverdue(t.due) ? "text-destructive font-medium" : "text-muted-foreground",
            )}>
              {format(parseISO(t.due), "dd MMM")}
            </span>
          )}
          <Link to={t.href} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ))}
    </div>
  );
}
