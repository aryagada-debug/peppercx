import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DealDetailDialog } from "@/components/rgy/DealDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { RGYStatus } from "@/types/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PODS = ["All", "Integrated", "India B2B", "US B2B", "FMCG", "BFSI", "Unassigned"] as const;
type Pod = typeof PODS[number];

const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);

const DIMENSIONS = [
  { key: "account_health", label: "Account Health" },
  { key: "delivery", label: "Delivery" },
  { key: "finance_billing", label: "Finance/Billing" },
  { key: "capability_seo", label: "Capability-SEO" },
  { key: "capability_creative", label: "Capability-Creative" },
];

const RGY_OPTIONS: { value: RGYStatus; label: string }[] = [
  { value: "G", label: "Green" },
  { value: "Y", label: "Yellow" },
  { value: "R", label: "Red" },
  { value: "NA", label: "N/A" },
];

const cellColors: Record<RGYStatus, string> = {
  R: "rgy-red",
  G: "rgy-green",
  Y: "rgy-yellow",
  NA: "rgy-na",
};

const cellLabels: Record<RGYStatus, string> = {
  R: "R", G: "G", Y: "Y", NA: "—",
};

const statusLabels: Record<RGYStatus, string> = {
  R: "Red", G: "Green", Y: "Yellow", NA: "N/A",
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
  rgy_row_id?: string;
  rgy_week_start?: string;
  account_health: string;
  delivery: string;
  finance_billing: string;
  capability_seo: string;
  capability_creative: string;
}

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

function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

// ── Inline RGY Selector ──
function RGYCell({
  dealId,
  dimKey,
  value,
  label,
  onUpdate,
}: {
  dealId: string;
  dimKey: string;
  value: RGYStatus;
  label: string;
  onUpdate: (dealId: string, dimKey: string, newValue: RGYStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all",
              cellColors[value]
            )}
            aria-label={`${label}: ${statusLabels[value]} — Click to change`}
          >
            {cellLabels[value]}
          </button>
        </TooltipTrigger>
        <TooltipContent><p>{label} · {statusLabels[value]}</p></TooltipContent>
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg shadow-lg p-1 flex gap-1">
            {RGY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(dealId, dimKey, opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-7 h-7 rounded-md text-caption font-semibold transition-all",
                  cellColors[opt.value],
                  value === opt.value && "ring-2 ring-primary"
                )}
                title={opt.label}
              >
                {cellLabels[opt.value]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function RGYHealth() {
  const [deals, setDeals] = useState<DealWithRGY[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [activePod, setActivePod] = useState<Pod>("All");
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const { data: dealRows } = await supabase
      .from("staffing_deals")
      .select("id, deal_id, deal_name, account, bopm, deal_status, pod, mrr, total_deal_value, vsd, principal_bopm, senior_bopm, start_date, end_date, payment_terms")
      .order("deal_name");

    if (!dealRows) { setLoading(false); return; }

    const dealIds = dealRows.map(d => d.id);
    const rgyMap = new Map<string, any>();
    for (let i = 0; i < dealIds.length; i += 500) {
      const batch = dealIds.slice(i, i + 500);
      const { data: rgyRows } = await supabase
        .from("deal_rgy_weekly")
        .select("id, deal_id, account_health, delivery, finance_billing, capability_seo, capability_creative, week_start")
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
        rgy_row_id: rgy?.id,
        rgy_week_start: rgy?.week_start,
        account_health: rgy?.account_health || "NA",
        delivery: rgy?.delivery || "NA",
        finance_billing: rgy?.finance_billing || "NA",
        capability_seo: rgy?.capability_seo || "NA",
        capability_creative: rgy?.capability_creative || "NA",
      };
    });

    setDeals(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRGYUpdate = useCallback(async (dealId: string, dimKey: string, newValue: RGYStatus) => {
    // Optimistically update local state
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, [dimKey]: newValue } : d));

    const deal = deals.find(d => d.id === dealId);
    const weekStart = getCurrentWeekStart();

    if (deal?.rgy_row_id && deal.rgy_week_start === weekStart) {
      // Update existing row for this week
      await supabase.from("deal_rgy_weekly").update({ [dimKey]: newValue } as any).eq("id", deal.rgy_row_id);
    } else {
      // Insert new weekly row
      const currentDeal = deals.find(d => d.id === dealId);
      const { data: inserted } = await supabase.from("deal_rgy_weekly").insert({
        deal_id: dealId,
        week_start: weekStart,
        account_health: dimKey === "account_health" ? newValue : (currentDeal?.account_health || "G"),
        delivery: dimKey === "delivery" ? newValue : (currentDeal?.delivery || "G"),
        finance_billing: dimKey === "finance_billing" ? newValue : (currentDeal?.finance_billing || "G"),
        capability_seo: dimKey === "capability_seo" ? newValue : (currentDeal?.capability_seo || "G"),
        capability_creative: dimKey === "capability_creative" ? newValue : (currentDeal?.capability_creative || "G"),
      }).select("id").single();

      if (inserted) {
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, rgy_row_id: inserted.id, rgy_week_start: weekStart } : d));
      }
    }
  }, [deals]);

  // Filtering
  const filteredDeals = useMemo(() => {
    let d = deals;
    if (!showClosed) d = d.filter(deal => ACTIVE_STATUSES.has(deal.deal_status));
    if (activePod === "Unassigned") {
      d = d.filter(deal => {
        const pod = getPodForDeal(deal.vsd, deal.pod);
        return pod === "Unassigned";
      });
    } else if (activePod !== "All") {
      d = d.filter(deal => getPodForDeal(deal.vsd, deal.pod) === activePod);
    }
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(deal => deal.account.toLowerCase().includes(s) || deal.deal_name.toLowerCase().includes(s) || deal.deal_id.toLowerCase().includes(s));
    }
    return d;
  }, [deals, activePod, search, showClosed]);

  // Group by Client (same as Clients page)
  const groupedDeals = useMemo(() => {
    const map = new Map<string, DealWithRGY[]>();
    filteredDeals.forEach(deal => {
      const existing = map.get(deal.account) || [];
      map.set(deal.account, [...existing, deal]);
    });
    return Array.from(map.entries())
      .map(([client, deals]) => ({ client, deals }))
      .sort((a, b) => a.client.localeCompare(b.client));
  }, [filteredDeals]);

  const toggleClient = (client: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(client)) next.delete(client); else next.add(client);
      return next;
    });
  };

  const expandAll = () => setExpandedClients(new Set(groupedDeals.map(g => g.client)));
  const collapseAll = () => setExpandedClients(new Set());

  // KPIs
  const kpis = useMemo(() => {
    const allDims = filteredDeals.flatMap(d =>
      [d.account_health, d.delivery, d.finance_billing, d.capability_seo, d.capability_creative].map(v => (v || "NA") as RGYStatus)
    );
    const red = allDims.filter(v => v === "R").length;
    const yellow = allDims.filter(v => v === "Y").length;
    const green = allDims.filter(v => v === "G").length;
    const scored = allDims.filter(v => v !== "NA").length;
    const score = scored > 0 ? ((green * 100 + yellow * 50) / scored).toFixed(1) : "—";
    return { red, yellow, green, score, totalDeals: filteredDeals.length };
  }, [filteredDeals]);

  const selectedDeal = deals.find(d => d.id === selectedDealId) ?? null;

  if (loading) {
    return (
      <AppLayout>
        <div className="p-5 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">RGY Health Tracker</h1>
            <p className="text-ui text-muted-foreground mt-0.5">
              {kpis.totalDeals} deals • Click any RGY cell to update
            </p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <MetricCard label="Red Flags" value={String(kpis.red)} />
          <MetricCard label="Yellow Warnings" value={String(kpis.yellow)} />
          <MetricCard label="Green (Healthy)" value={String(kpis.green)} />
          <MetricCard label="Portfolio Score" value={String(kpis.score)} suffix="/ 100" />
        </div>

        {/* Filters — matching Clients page */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {PODS.map(pod => (
              <button key={pod} onClick={() => setActivePod(pod)} className={cn(
                "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                activePod === pod ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{pod}</button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search clients or deals..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" />
          </div>

          <label className="flex items-center gap-2 text-ui text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="rounded border-border" />
            Show closed/completed
          </label>

          <Button variant="ghost" size="sm" onClick={() => expandedClients.size === groupedDeals.length ? collapseAll() : expandAll()} className="text-xs gap-1 text-muted-foreground">
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {expandedClients.size === groupedDeals.length ? "Collapse All" : "Expand All"}
          </Button>
        </div>

        {/* Grouped Table */}
        <TooltipProvider>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-ui">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium w-8"></th>
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Deal Name</th>
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Deal ID</th>
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                    {DIMENSIONS.map(d => (
                      <th key={d.key} className="text-center py-2 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedDeals.map(({ client, deals: clientDeals }) => {
                    const isExpanded = expandedClients.has(client);
                    // Client-level RGY summary
                    const clientDims = clientDeals.flatMap(d =>
                      [d.account_health, d.delivery, d.finance_billing, d.capability_seo, d.capability_creative].map(v => (v || "NA") as RGYStatus)
                    );
                    const clientRed = clientDims.filter(v => v === "R").length;
                    const clientYellow = clientDims.filter(v => v === "Y").length;

                    return (
                      <React.Fragment key={client}>
                        {/* Client parent row */}
                        <tr
                          className="border-b border-border bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-colors"
                          onClick={() => toggleClient(client)}
                        >
                          <td className="py-2 px-3">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </td>
                          <td className="py-2 px-3" colSpan={3}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{client}</span>
                              <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                {clientDeals.length} deal{clientDeals.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </td>
                          {/* RGY summary counts in client row */}
                          <td colSpan={DIMENSIONS.length} className="py-2 px-3">
                            <div className="flex items-center gap-3 justify-end">
                              {clientRed > 0 && <span className="text-[10px] font-medium text-red-600 dark:text-red-400">{clientRed} Red</span>}
                              {clientYellow > 0 && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{clientYellow} Yellow</span>}
                              {clientRed === 0 && clientYellow === 0 && <span className="text-[10px] text-muted-foreground">All Green</span>}
                            </div>
                          </td>
                        </tr>

                        {/* Deal child rows */}
                        {isExpanded && clientDeals.map(deal => (
                          <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/10 transition-colors">
                            <td className="py-2 px-3"></td>
                            <td className="py-2 px-3 pl-6">
                              <Link to={`/deals/${deal.id}`} className="text-primary hover:underline text-xs font-medium">
                                {deal.deal_name}
                              </Link>
                            </td>
                            <td className="py-2 px-3 text-xs font-mono text-muted-foreground">{deal.deal_id || "—"}</td>
                            <td className="py-2 px-3">
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
                            {DIMENSIONS.map(dim => {
                              const val = (deal[dim.key as keyof DealWithRGY] as string || "NA") as RGYStatus;
                              return (
                                <td key={dim.key} className="py-2 px-2 text-center">
                                  <RGYCell
                                    dealId={deal.id}
                                    dimKey={dim.key}
                                    value={val}
                                    label={dim.label}
                                    onUpdate={handleRGYUpdate}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {groupedDeals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No deals found matching your filters.</p>
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
