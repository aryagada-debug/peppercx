import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon, Loader2, ArrowRight, ListTodo, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDealAccess } from "@/hooks/useDealAccess";
import { useCapability } from "@/hooks/useCapability";

interface DealRow { id: string; deal_name: string; account: string; rag: string }
interface TaskRow { id: string; title: string; stage: string; deal_id: string; end_date: string | null }
interface MbrRow { id: string; deal_id: string; week_start: string; status: string }

export function CapabilityMemberDashboard() {
  const { visibleDealIds, loading: accessLoading } = useDealAccess();
  const { myPersonId, loading: capLoading } = useCapability();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [mbrs, setMbrs] = useState<MbrRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accessLoading || capLoading) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const ids = Array.from(visibleDealIds);
      if (ids.length === 0) {
        if (!cancelled) { setDeals([]); setTasks([]); setMbrs([]); setLoading(false); }
        return;
      }
      const [{ data: dData }, { data: tData }, { data: mData }] = await Promise.all([
        supabase.from("staffing_deals").select("id, deal_name, account, rag").in("id", ids),
        supabase.from("deal_tasks").select("id, title, stage, deal_id, end_date").in("deal_id", ids).neq("stage", "Done").order("end_date", { ascending: true }).limit(50),
        supabase.from("mbr_entries").select("id, deal_id, week_start, status").in("deal_id", ids).order("week_start", { ascending: false }).limit(20),
      ]);
      if (cancelled) return;
      setDeals(((dData || []) as any[]) as DealRow[]);
      setTasks(((tData || []) as any[]) as TaskRow[]);
      setMbrs(((mData || []) as any[]) as MbrRow[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [accessLoading, capLoading, visibleDealIds]);

  if (accessLoading || capLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-medium tracking-tight">My Work</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {deals.length} deals · {tasks.length} open tasks
          </p>
        </div>

        {!myPersonId && (
          <Card className="p-4 border-amber-500/30 bg-amber-500/5">
            <div className="text-sm">Your account isn't linked to a staffing record yet — ask an admin to map you in <Link to="/settings" className="text-primary hover:underline">Settings → Users &amp; Roles</Link>.</div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><ListTodo className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-medium">My open tasks</h2></div>
            </div>
            <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
              {tasks.length === 0 && <div className="text-xs text-muted-foreground py-6 text-center">No open tasks.</div>}
              {tasks.map((t) => (
                <Link key={t.id} to={`/deals/${t.deal_id}`} className="flex items-center justify-between py-2 hover:bg-muted/40 px-1 rounded transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{t.title || "Untitled"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{t.stage}{t.end_date ? ` · due ${t.end_date}` : ""}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.stage}</Badge>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-medium">My deals</h2></div>
              <Link to="/clients" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Open Clients <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
              {deals.length === 0 && <div className="text-xs text-muted-foreground py-6 text-center">You're not staffed on any deals yet.</div>}
              {deals.map((d) => (
                <Link key={d.id} to={`/deals/${d.id}`} className="flex items-center justify-between py-2 hover:bg-muted/40 px-1 rounded transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{d.deal_name || d.account}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{d.account}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{d.rag || "—"}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Upcoming MBRs (read-only)</div>
          <div className="text-xs text-muted-foreground">
            {mbrs.length === 0 ? "No MBRs scheduled." : `${mbrs.length} MBR${mbrs.length === 1 ? "" : "s"} on your deals — your BOPM owns scheduling and notes.`}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}