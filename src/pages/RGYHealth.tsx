import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RGYHeatmap } from "@/components/dashboard/RGYHeatmap";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DealDetailDialog } from "@/components/rgy/DealDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { RGYRow, RGYStatus } from "@/types/dashboard";

const ALL_STATUSES = [
  "Active Deal",
  "Deal Disputed",
  "New Deal in SLA/PO",
  "Deal Completed Successfully",
  "Deal Churned / Lost",
];

const DIMENSIONS = ["Account Health", "Delivery", "Finance/Billing", "Capability-SEO", "Capability-Creative"];

interface DealWithRGY {
  id: string;
  deal_name: string;
  account: string;
  bopm: string;
  deal_status: string;
  pod: string;
  mrr: number | null;
  total_deal_value: number | null;
  vsd: string;
  principal_bopm: string;
  senior_bopm: string;
  start_date: string | null;
  end_date: string | null;
  payment_terms: string;
  account_health?: string;
  delivery?: string;
  finance_billing?: string;
  capability_seo?: string;
  capability_creative?: string;
}

export default function RGYHealth() {
  const [deals, setDeals] = useState<DealWithRGY[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      // Fetch ALL deals (no status filter)
      const { data: dealRows } = await supabase
        .from("staffing_deals")
        .select("id, deal_name, account, bopm, deal_status, pod, mrr, total_deal_value, vsd, principal_bopm, senior_bopm, start_date, end_date, payment_terms")
        .order("deal_name");

      if (!dealRows) { setLoading(false); return; }

      const dealIds = dealRows.map(d => d.id);

      // Fetch in batches of 500 to avoid URI limits
      const rgyMap = new Map<string, { account_health: string; delivery: string; finance_billing: string; capability_seo: string; capability_creative: string }>();
      for (let i = 0; i < dealIds.length; i += 500) {
        const batch = dealIds.slice(i, i + 500);
        const { data: rgyRows } = await supabase
          .from("deal_rgy_weekly")
          .select("deal_id, account_health, delivery, finance_billing, capability_seo, capability_creative, week_start")
          .in("deal_id", batch)
          .order("week_start", { ascending: false });

        if (rgyRows) {
          for (const r of rgyRows) {
            if (!rgyMap.has(r.deal_id)) rgyMap.set(r.deal_id, r);
          }
        }
      }

      const merged: DealWithRGY[] = dealRows.map(d => {
        const rgy = rgyMap.get(d.id);
        return {
          ...d,
          account_health: rgy?.account_health,
          delivery: rgy?.delivery,
          finance_billing: rgy?.finance_billing,
          capability_seo: rgy?.capability_seo,
          capability_creative: rgy?.capability_creative,
        };
      });

      setDeals(merged);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Filter deals by status
  const filteredDeals = statusFilter === "all"
    ? deals
    : deals.filter(d => d.deal_status === statusFilter);

  // Map to RGYRow format
  const rgyData: RGYRow[] = filteredDeals.map(d => ({
    id: d.id,
    deal: d.deal_name,
    client: d.account,
    bopm: d.bopm || "—",
    status: d.deal_status,
    dimensions: {
      "Account Health": (d.account_health || "NA") as RGYStatus,
      "Delivery": (d.delivery || "NA") as RGYStatus,
      "Finance/Billing": (d.finance_billing || "NA") as RGYStatus,
      "Capability-SEO": (d.capability_seo || "NA") as RGYStatus,
      "Capability-Creative": (d.capability_creative || "NA") as RGYStatus,
    },
  }));

  // Compute metrics from filtered view
  const allStatuses = rgyData.flatMap(r => Object.values(r.dimensions));
  const redCount = allStatuses.filter(v => v === "R").length;
  const yellowCount = allStatuses.filter(v => v === "Y").length;
  const greenCount = allStatuses.filter(v => v === "G").length;
  const scored = allStatuses.filter(v => v !== "NA").length;
  const portfolioScore = scored > 0
    ? ((greenCount * 100 + yellowCount * 50) / scored).toFixed(1)
    : "—";

  const selectedDeal = deals.find(d => d.id === selectedDealId) ?? null;

  // Status counts for subtitle
  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = deals.filter(d => d.deal_status === s).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-subhead font-semibold tracking-tight text-foreground">RGY Health Tracker</h1>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({deals.length})</SelectItem>
              {ALL_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{s} ({statusCounts[s] || 0})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-ui text-muted-foreground mb-6">
          Multi-dimensional deal health — showing {filteredDeals.length} of {deals.length} deals
        </p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Red Flags" value={String(redCount)} />
          <MetricCard label="Yellow Warnings" value={String(yellowCount)} />
          <MetricCard label="Green (Healthy)" value={String(greenCount)} />
          <MetricCard label="Portfolio Score" value={String(portfolioScore)} suffix="/ 100" />
        </div>

        <div className="data-card">
          <p className="metric-label mb-4">Deal × Dimension Heatmap</p>
          <RGYHeatmap
            data={rgyData}
            dimensions={DIMENSIONS}
            onDealClick={(dealId) => setSelectedDealId(dealId)}
          />
        </div>

        <DealDetailDialog
          deal={selectedDeal}
          open={!!selectedDealId}
          onOpenChange={(open) => { if (!open) setSelectedDealId(null); }}
        />
      </div>
    </AppLayout>
  );
}
