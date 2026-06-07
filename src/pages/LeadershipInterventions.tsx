import { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useIsLeadershipViewer } from "@/hooks/useIsLeadershipViewer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, MessageSquare, Search, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { InterventionDrawer, type Intervention } from "@/components/rgy/InterventionDrawer";
import { RaiseInterventionDialog } from "@/components/rgy/RaiseInterventionDialog";
import { Navigate } from "react-router-dom";

type Row = Intervention & {
  deal_label: string;
  comments_count: number;
};

const urgencyClass = (u: string) =>
  u === "High" ? "bg-destructive/10 text-destructive border-destructive/30"
  : u === "Medium" ? "bg-warning/10 text-warning border-warning/30"
  : "bg-muted text-muted-foreground border-border";

const statusClass = (s: string) =>
  s === "Resolved" ? "bg-positive/10 text-positive border-positive/30"
  : s === "In Progress" ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
  : s === "Acknowledged" ? "bg-warning/10 text-warning border-warning/30"
  : "bg-destructive/10 text-destructive border-destructive/30";

const URG_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export default function LeadershipInterventions() {
  const { user } = useAuth();
  const isLeader = useIsLeadershipViewer();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Open + In Progress");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("All");
  const [mineOnly, setMineOnly] = useState(false);
  const [drawerRow, setDrawerRow] = useState<Row | null>(null);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: items } = await supabase
      .from("rgy_leadership_interventions")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (items || []) as Intervention[];

    const dealIds = Array.from(new Set(list.map((i) => i.deal_id)));
    const dealMap = new Map<string, string>();
    if (dealIds.length) {
      const { data: deals } = await supabase
        .from("staffing_deals")
        .select("id, deal_name, account")
        .in("id", dealIds);
      (deals || []).forEach((d: any) => {
        dealMap.set(d.id, [d.account, d.deal_name].filter(Boolean).join(" — ") || d.id);
      });
    }

    const ids = list.map((i) => i.id);
    const countMap = new Map<string, number>();
    if (ids.length) {
      const { data: cmts } = await supabase
        .from("rgy_leadership_intervention_comments")
        .select("intervention_id")
        .in("intervention_id", ids);
      (cmts || []).forEach((c: any) => {
        countMap.set(c.intervention_id, (countMap.get(c.intervention_id) || 0) + 1);
      });
    }

    setRows(list.map((i) => ({
      ...i,
      deal_label: dealMap.get(i.deal_id) || i.deal_id,
      comments_count: countMap.get(i.id) || 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (mineOnly && r.raised_by_user_id !== user?.id) return false;
        if (statusFilter === "Open + In Progress" && !(r.status === "Open" || r.status === "Acknowledged" || r.status === "In Progress")) return false;
        if (statusFilter !== "All" && statusFilter !== "Open + In Progress" && r.status !== statusFilter) return false;
        if (urgencyFilter !== "All" && r.urgency !== urgencyFilter) return false;
        if (q && !(r.title.toLowerCase().includes(q) || r.deal_label.toLowerCase().includes(q) || r.raised_by_name.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => {
        const ua = URG_ORDER[a.urgency] ?? 99;
        const ub = URG_ORDER[b.urgency] ?? 99;
        if (ua !== ub) return ua - ub;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [rows, search, statusFilter, urgencyFilter, mineOnly, user?.id]);

  // Guard — non-leadership users still get redirected away (their own raised items
  // are visible on the deal RGY tab; this central queue is leadership-only).
  if (!isLeader) return <Navigate to="/home" replace />;

  return (
    <AppLayout>
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Leadership Interventions
            </h1>
            <p className="text-sm text-muted-foreground">Requests raised across deals that need leadership help.</p>
          </div>
          <Button onClick={() => setRaiseOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Raise intervention
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-[420px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, deal, raiser…"
              className="pl-8 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Open + In Progress">Open + In Progress</SelectItem>
              <SelectItem value="All">All statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Acknowledged">Acknowledged</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All urgencies</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={mineOnly ? "default" : "outline"} size="sm" onClick={() => setMineOnly((m) => !m)}>
            Raised by me
          </Button>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Urgency</th>
                  <th className="px-3 py-2 font-medium">Deal</th>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Raised by</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Raised on</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-1.5" />Loading…
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No interventions match your filters.</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/40 cursor-pointer" onClick={() => setDrawerRow(r)}>
                    <td className="px-3 py-2"><Badge variant="outline" className={urgencyClass(r.urgency)}>{r.urgency}</Badge></td>
                    <td className="px-3 py-2 max-w-[260px] truncate" title={r.deal_label}>{r.deal_label}</td>
                    <td className="px-3 py-2 max-w-[360px] truncate" title={r.title}>{r.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.raised_by_name || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={statusClass(r.status)}>{r.status}</Badge></td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />{r.comments_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <InterventionDrawer
        open={!!drawerRow}
        onOpenChange={(o) => { if (!o) setDrawerRow(null); }}
        intervention={drawerRow}
        dealLabel={drawerRow?.deal_label}
        onChanged={load}
      />
      <RaiseInterventionDialog
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        onCreated={load}
      />
    </AppLayout>
  );
}