import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DealDetailDialog } from "@/components/rgy/DealDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { RGYStatus } from "@/types/dashboard";

const ALL_STATUSES = [
  "Active Deal",
  "Deal Disputed",
  "New Deal in SLA/PO",
  "Deal Completed Successfully",
  "Deal Churned / Lost",
];

const DIMENSIONS = ["Account Health", "Delivery", "Finance/Billing", "Capability-SEO", "Capability-Creative"];

const POD_ORDER = ["FMCG", "Integrated", "US B2B", "India B2B", "BFSI", "Unassigned"];

interface DealWithRGY {
  id: string;
  deal_id: string;
  deal_name: string;
  account: string;
  bopm: string;
  deal_status: string;
  pod: string;
  vsd: string;
  mrr: number | null;
  total_deal_value: number | null;
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

const cellColors: Record<RGYStatus, string> = {
  R: "rgy-red",
  G: "rgy-green",
  Y: "rgy-yellow",
  NA: "rgy-na",
};

const cellLabels: Record<RGYStatus, string> = {
  R: "R",
  G: "G",
  Y: "Y",
  NA: "—",
};

const statusLabels: Record<RGYStatus, string> = {
  R: "Red",
  G: "Green",
  Y: "Yellow",
  NA: "N/A",
};

const statusBadgeStyles: Record<string, string> = {
  "Active Deal": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "Deal Disputed": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "New Deal in SLA/PO": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Deal Completed Successfully": "bg-muted text-muted-foreground border-border",
  "Deal Churned / Lost": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const statusShortLabels: Record<string, string> = {
  "Active Deal": "Active",
  "Deal Disputed": "Disputed",
  "New Deal in SLA/PO": "New/SLA",
  "Deal Completed Successfully": "Completed",
  "Deal Churned / Lost": "Churned",
};

function getPodForDeal(vsd: string, pod: string): string {
  if (pod && pod !== "" && pod !== "Not Assigned" && pod !== "Unassigned" && pod !== "Not Applicable") return pod;
  const vsdMap: Record<string, string> = {
    "Sneha Iyer": "FMCG",
    "Aamir Khan": "Integrated",
    "Neema Jayadas": "US B2B",
    "Sumit Shekhawat": "India B2B",
    "Aditya Shaw": "BFSI",
  };
  return vsdMap[vsd] || "Unassigned";
}

export default function RGYHealth() {
  const [deals, setDeals] = useState<DealWithRGY[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [collapsedPods, setCollapsedPods] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      const { data: dealRows } = await supabase
        .from("staffing_deals")
        .select("id, deal_id, deal_name, account, bopm, deal_status, pod, mrr, total_deal_value, vsd, principal_bopm, senior_bopm, start_date, end_date, payment_terms")
        .order("deal_name");

      if (!dealRows) { setLoading(false); return; }

      const dealIds = dealRows.map(d => d.id);

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
            if (!rgyMap.has(r.deal_id)) rgyMap.set(r.deal_id, r as any);
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

  const filteredDeals = statusFilter === "all"
    ? deals
    : deals.filter(d => d.deal_status === statusFilter);

  // Group by POD
  const podGroups = useMemo(() => {
    const groups = new Map<string, DealWithRGY[]>();
    for (const d of filteredDeals) {
      const pod = getPodForDeal(d.vsd, d.pod);
      if (!groups.has(pod)) groups.set(pod, []);
      groups.get(pod)!.push(d);
    }
    // Sort by POD_ORDER
    return POD_ORDER
      .filter(p => groups.has(p))
      .map(p => ({ pod: p, deals: groups.get(p)! }))
      .concat(
        [...groups.entries()]
          .filter(([k]) => !POD_ORDER.includes(k))
          .map(([pod, deals]) => ({ pod, deals }))
      );
  }, [filteredDeals]);

  // Compute metrics
  const allStatuses = filteredDeals.flatMap(d => {
    const dims = [d.account_health, d.delivery, d.finance_billing, d.capability_seo, d.capability_creative];
    return dims.map(v => (v || "NA") as RGYStatus);
  });
  const redCount = allStatuses.filter(v => v === "R").length;
  const yellowCount = allStatuses.filter(v => v === "Y").length;
  const greenCount = allStatuses.filter(v => v === "G").length;
  const scored = allStatuses.filter(v => v !== "NA").length;
  const portfolioScore = scored > 0
    ? ((greenCount * 100 + yellowCount * 50) / scored).toFixed(1)
    : "—";

  const selectedDeal = deals.find(d => d.id === selectedDealId) ?? null;

  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = deals.filter(d => d.deal_status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const togglePod = (pod: string) => {
    setCollapsedPods(prev => {
      const next = new Set(prev);
      if (next.has(pod)) next.delete(pod);
      else next.add(pod);
      return next;
    });
  };

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
          Multi-dimensional deal health — showing {filteredDeals.length} of {deals.length} deals, grouped by POD
        </p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Red Flags" value={String(redCount)} />
          <MetricCard label="Yellow Warnings" value={String(yellowCount)} />
          <MetricCard label="Green (Healthy)" value={String(greenCount)} />
          <MetricCard label="Portfolio Score" value={String(portfolioScore)} suffix="/ 100" />
        </div>

        <TooltipProvider>
          <div className="space-y-4">
            {podGroups.map(({ pod, deals: podDeals }) => {
              const isCollapsed = collapsedPods.has(pod);
              // Pod-level RGY counts
              const podDims = podDeals.flatMap(d => [d.account_health, d.delivery, d.finance_billing, d.capability_seo, d.capability_creative].map(v => (v || "NA") as RGYStatus));
              const podRed = podDims.filter(v => v === "R").length;
              const podYellow = podDims.filter(v => v === "Y").length;

              return (
                <div key={pod} className="data-card overflow-hidden">
                  {/* POD Header */}
                  <button
                    onClick={() => togglePod(pod)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-semibold text-foreground">{pod}</span>
                    <span className="text-xs text-muted-foreground">({podDeals.length} deals)</span>
                    <div className="flex items-center gap-2 ml-auto">
                      {podRed > 0 && <span className="text-xs font-medium text-red-600 dark:text-red-400">{podRed} Red</span>}
                      {podYellow > 0 && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{podYellow} Yellow</span>}
                    </div>
                  </button>

                  {/* Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-ui" aria-label={`RGY Heatmap — ${pod}`}>
                        <thead>
                          <tr className="border-t border-b border-border">
                            <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Client</th>
                            <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal ID</th>
                            <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal Name</th>
                            <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Status</th>
                            {DIMENSIONS.map(d => (
                              <th key={d} className="text-center py-2 px-2 font-medium text-muted-foreground text-caption uppercase tracking-wider whitespace-nowrap">{d}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {podDeals.map(deal => {
                            const dims: Record<string, RGYStatus> = {
                              "Account Health": (deal.account_health || "NA") as RGYStatus,
                              "Delivery": (deal.delivery || "NA") as RGYStatus,
                              "Finance/Billing": (deal.finance_billing || "NA") as RGYStatus,
                              "Capability-SEO": (deal.capability_seo || "NA") as RGYStatus,
                              "Capability-Creative": (deal.capability_creative || "NA") as RGYStatus,
                            };

                            return (
                              <tr key={deal.id} className="border-b border-border/50 transition-colors hover:bg-secondary/50">
                                <td className="py-2 px-4 text-muted-foreground whitespace-nowrap">{deal.account}</td>
                                <td className="py-2 px-4 text-muted-foreground whitespace-nowrap font-mono text-xs">{deal.deal_id || "—"}</td>
                                <td className="py-2 px-4 whitespace-nowrap">
                                  <button
                                    type="button"
                                    className="font-medium text-primary hover:underline text-left"
                                    onClick={() => setSelectedDealId(deal.id)}
                                  >
                                    {deal.deal_name}
                                  </button>
                                </td>
                                <td className="py-2 px-4 whitespace-nowrap">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0 font-medium border",
                                      statusBadgeStyles[deal.deal_status] || "bg-muted text-muted-foreground border-border"
                                    )}
                                  >
                                    {statusShortLabels[deal.deal_status] || deal.deal_status || "—"}
                                  </Badge>
                                </td>
                                {DIMENSIONS.map(d => {
                                  const status = dims[d];
                                  return (
                                    <td key={d} className="py-2 px-2 text-center">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className={cn(
                                              "inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold",
                                              cellColors[status]
                                            )}
                                            aria-label={`${d}: ${statusLabels[status]}`}
                                          >
                                            {cellLabels[status]}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{d} · {statusLabels[status]}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {podGroups.length === 0 && (
              <div className="flex items-center justify-center py-12 text-ui text-muted-foreground">
                No deals to display for this filter
              </div>
            )}
          </div>
        </TooltipProvider>

        <DealDetailDialog
          deal={selectedDeal}
          open={!!selectedDealId}
          onOpenChange={(open) => { if (!open) setSelectedDealId(null); }}
        />
      </div>
    </AppLayout>
  );
}
