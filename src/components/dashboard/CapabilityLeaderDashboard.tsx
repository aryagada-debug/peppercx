import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, ArrowRight, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCapability } from "@/hooks/useCapability";
import { useDealAccess } from "@/hooks/useDealAccess";
import { Loader2 } from "lucide-react";

interface PersonRow {
  id: string;
  name: string;
  designation: string;
  utilizationPct: number;
}
interface DealCard { id: string; deal_name: string; account: string; rag: string; vsd: string }

export function CapabilityLeaderDashboard() {
  const { loading: capLoading, myCapabilities, myTeamPersonIds, isLead } = useCapability();
  const { visibleDealIds, loading: accessLoading } = useDealAccess();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [deals, setDeals] = useState<DealCard[]>([]);
  const [loading, setLoading] = useState(true);

  const teamIds = useMemo(() => Array.from(myTeamPersonIds), [myTeamPersonIds]);

  useEffect(() => {
    if (capLoading || accessLoading) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const dealIdList = Array.from(visibleDealIds);

      const peopleP = teamIds.length
        ? supabase.from("staffing_people").select("id, name, designation").in("id", teamIds)
        : Promise.resolve({ data: [] as any[] });
      const allocsP = teamIds.length
        ? supabase.from("staffing_assignments").select("person_id, allocation_pct").in("person_id", teamIds)
        : Promise.resolve({ data: [] as any[] });
      const dealsP = dealIdList.length
        ? supabase.from("staffing_deals").select("id, deal_name, account, rag, vsd").in("id", dealIdList)
        : Promise.resolve({ data: [] as any[] });

      const [{ data: pData }, { data: aData }, { data: dData }] = await Promise.all([peopleP, allocsP, dealsP]);

      const utilByPerson = new Map<string, number>();
      (aData || []).forEach((a: any) => {
        utilByPerson.set(a.person_id, (utilByPerson.get(a.person_id) || 0) + Number(a.allocation_pct || 0));
      });

      if (cancelled) return;
      setPeople(((pData || []) as any[]).map((p) => ({
        id: p.id, name: p.name, designation: p.designation || "",
        utilizationPct: Math.round(utilByPerson.get(p.id) || 0),
      })).sort((a, b) => b.utilizationPct - a.utilizationPct));
      setDeals(((dData || []) as any[]) as DealCard[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [capLoading, accessLoading, teamIds, visibleDealIds]);

  if (capLoading || accessLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  const overUtil = people.filter((p) => p.utilizationPct > 100).length;
  const underUtil = people.filter((p) => p.utilizationPct < 60).length;
  const ragCount = (s: string) => deals.filter((d) => (d.rag || "").toLowerCase() === s).length;

  const utilTone = (pct: number) =>
    pct > 100 ? "bg-destructive/15 text-destructive" :
    pct >= 85 ? "bg-warning/15 text-warning-foreground" :
    pct >= 60 ? "bg-positive/15 text-positive" :
    "bg-muted text-muted-foreground";

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-medium tracking-tight">My Team</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isLead ? "Capability Leader · " : ""}
              {myCapabilities.map((c) => c.name).join(" · ") || "No capability assigned"} ·{" "}
              {people.length} {people.length === 1 ? "person" : "people"} · {deals.length} active deals
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Team size</div><div className="text-2xl font-medium mt-1">{people.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Deals in flight</div><div className="text-2xl font-medium mt-1">{deals.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Over-allocated (&gt;100%)</div><div className="text-2xl font-medium mt-1 text-destructive">{overUtil}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Under-allocated (&lt;60%)</div><div className="text-2xl font-medium mt-1 text-muted-foreground">{underUtil}</div></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-medium">Team utilisation</h2></div>
              <Link to="/staffing" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Open Staffing <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {people.length === 0 && <div className="text-xs text-muted-foreground py-6 text-center">No team members yet.</div>}
              {people.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.designation}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${utilTone(p.utilizationPct)}`}>{p.utilizationPct}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-medium">Deals by health</h2></div>
              <Link to="/rgy-health" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Open RGY <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-md border border-border p-3 text-center"><div className="text-[11px] text-muted-foreground">Green</div><div className="text-lg font-medium text-positive">{ragCount("green")}</div></div>
              <div className="rounded-md border border-border p-3 text-center"><div className="text-[11px] text-muted-foreground">Amber</div><div className="text-lg font-medium text-warning-foreground">{ragCount("amber") + ragCount("yellow")}</div></div>
              <div className="rounded-md border border-border p-3 text-center"><div className="text-[11px] text-muted-foreground">Red</div><div className="text-lg font-medium text-destructive">{ragCount("red")}</div></div>
            </div>
            <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
              {deals.slice(0, 30).map((d) => (
                <Link key={d.id} to={`/deals/${d.id}`} className="flex items-center justify-between py-2 hover:bg-muted/40 px-1 rounded transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{d.deal_name || d.account}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{d.account} · VSD {d.vsd || "—"}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{d.rag || "—"}</Badge>
                </Link>
              ))}
              {deals.length === 0 && <div className="text-xs text-muted-foreground py-6 text-center">No deals — your team isn't staffed on anything yet.</div>}
            </div>
          </Card>
        </div>

      </div>
    </AppLayout>
  );
}