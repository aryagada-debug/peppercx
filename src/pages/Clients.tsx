import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { Search, ChevronDown, ChevronRight, Building2, Plus, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { useClients } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "@/components/deals/ClientFormDialog";
import { DealFormWizard } from "@/components/deals/DealFormWizard";
import { supabase } from "@/integrations/supabase/client";
import { uid } from "@/data/staffingData";
import { toast } from "sonner";

const PODS = ["All", "Integrated", "India B2B", "US B2B", "FMCG", "BFSI"] as const;
type Pod = typeof PODS[number];

const BU_TO_POD: Record<string, Pod> = {
  "Pepper Creative": "Integrated",
  "Pepper Content": "Integrated",
  "Pepper SEO": "Integrated",
  "India B2B": "India B2B",
  "US B2B": "US B2B",
  "FMCG": "FMCG",
  "BFSI": "BFSI",
};

const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const ragDot = (rag: string) => {
  const colors: Record<string, string> = {
    green: "bg-positive", amber: "bg-warning", red: "bg-destructive",
  };
  return <span className={cn("inline-block w-2 h-2 rounded-full", colors[rag] || "bg-muted-foreground")} />;
};

export default function Clients() {
  const { deals, loading: staffLoading, refresh: refreshStaffing } = useStaffingData();
  const { clients, loading: clientsLoading, addClient, refresh: refreshClients } = useClients();
  const [search, setSearch] = useState("");
  const [activePod, setActivePod] = useState<Pod>("All");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [dealWizardOpen, setDealWizardOpen] = useState(false);
  const [dealWizardClientId, setDealWizardClientId] = useState<string | undefined>();

  const filteredDeals = useMemo(() => {
    let d = deals;
    if (!showClosed) d = d.filter(deal => deal.dealStatusCx !== "Closed" && deal.dealStatus !== "Lost");
    if (activePod !== "All") d = d.filter(deal => (BU_TO_POD[deal.businessUnit] || "Integrated") === activePod);
    if (search) d = d.filter(deal => deal.account.toLowerCase().includes(search.toLowerCase()) || deal.dealName.toLowerCase().includes(search.toLowerCase()));
    return d;
  }, [deals, activePod, search, showClosed]);

  const clientGroups = useMemo(() => {
    const groups: Record<string, typeof filteredDeals> = {};
    filteredDeals.forEach(d => {
      const key = d.account || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredDeals]);

  const kpis = useMemo(() => ({
    clients: clientGroups.length,
    deals: filteredDeals.length,
    activeDeals: filteredDeals.filter(d => d.dealStatusCx === "Active" || d.dealStatus === "Won").length,
    totalMRR: filteredDeals.reduce((s, d) => s + (d.mrr || 0), 0),
    totalValue: filteredDeals.reduce((s, d) => s + (d.totalDealValue || 0), 0),
  }), [clientGroups, filteredDeals]);

  const toggleClient = (name: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const openDealWizardForClient = (clientName: string) => {
    const client = clients.find(c => c.name === clientName);
    setDealWizardClientId(client?.id);
    setDealWizardOpen(true);
  };

  const handleCreateDeal = async (clientId: string, data: any) => {
    const client = clients.find(c => c.id === clientId);
    const newId = uid();
    const dealCount = deals.length + 1;
    const dealIdStr = `D-${String(dealCount).padStart(4, "0")}`;

    const { error } = await supabase.from("staffing_deals").insert({
      id: newId,
      deal_id: dealIdStr,
      deal_name: data.dealName,
      deal_type: data.dealType,
      deal_status: data.dealStatus,
      deal_status_cx: data.dealStatus === "Won" ? "Active" : data.dealStatus,
      account: client?.name || "",
      pc_code: data.pcCode,
      business_unit: data.pepperBusinessUnit,
      capability_line: data.capabilityLine,
      vsd: data.vsd,
      principal_bopm: data.principalBopm,
      senior_bopm: data.seniorBopm,
      bopm: data.bopm,
      mrr: data.mrr ? Number(data.mrr) : null,
      total_deal_value: data.totalDealValue ? Number(data.totalDealValue) : null,
      retainer_deal_value: data.retainerDealValue ? Number(data.retainerDealValue) : null,
      non_retainer_deal_value: data.nonRetainerDealValue ? Number(data.nonRetainerDealValue) : null,
      pod: data.pod,
      customer_type: data.customerType,
      payment_terms: data.paymentTerms,
      pepper_business_unit: data.pepperBusinessUnit,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      projected_outcomes: data.projectedOutcomes ? [{ text: data.projectedOutcomes }] : [],
      success_metrics: data.successMetrics.filter((m: any) => m.name),
      baseline_metrics: data.baselineMetrics,
      client_id: clientId,
    } as any);

    if (error) {
      console.error("Failed to create deal:", error);
      toast.error("Failed to create deal");
      return;
    }

    // Insert SoW items
    const validSow = data.sowItems.filter((s: any) => s.scope);
    if (validSow.length > 0) {
      await supabase.from("deal_sow_items").insert(
        validSow.map((s: any) => ({
          deal_id: newId,
          scope: s.scope,
          revenue_share: s.revenueShare,
          team_capability: s.teamCapability,
        }))
      );
    }

    toast.success("Deal created successfully");
    refreshStaffing();
  };

  const loading = staffLoading || clientsLoading;

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">Clients & Deals</h1>
            <p className="text-ui text-muted-foreground mt-1">{kpis.clients} clients • {kpis.deals} deals</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setClientDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Client
            </Button>
            <Button size="sm" onClick={() => { setDealWizardClientId(undefined); setDealWizardOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Deal
            </Button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: "Clients", value: String(kpis.clients) },
            { label: "Total Deals", value: String(kpis.deals) },
            { label: "Active Deals", value: String(kpis.activeDeals) },
            { label: "Total MRR", value: fmtCurrency(kpis.totalMRR) },
            { label: "Total Value", value: fmtCurrency(kpis.totalValue) },
          ].map(k => (
            <div key={k.label} className="data-card">
              <p className="metric-label">{k.label}</p>
              <p className="text-xl font-semibold font-mono tracking-tight mt-1 text-foreground">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-5 flex-wrap">
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
            Show closed
          </label>
        </div>

        {/* Client List */}
        <div className="space-y-1">
          {clientGroups.map(([clientName, clientDeals]) => {
            const isExpanded = expandedClients.has(clientName);
            const clientMRR = clientDeals.reduce((s, d) => s + (d.mrr || 0), 0);
            const clientValue = clientDeals.reduce((s, d) => s + (d.totalDealValue || 0), 0);
            const vsd = clientDeals[0]?.vsd || "—";
            const principalBopm = clientDeals[0]?.principalBopm || "—";

            return (
              <div key={clientName} className="data-card !p-0 overflow-hidden">
                <button
                  onClick={() => toggleClient(clientName)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{clientName}</span>
                    <span className="ml-2 text-caption text-muted-foreground">{clientDeals.length} deal{clientDeals.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-6 text-ui">
                    <span className="text-muted-foreground text-caption">VSD: <span className="text-foreground font-medium">{vsd}</span></span>
                    <span className="text-muted-foreground text-caption">P.BOPM: <span className="text-foreground font-medium">{principalBopm}</span></span>
                    <span className="font-mono tabular-nums text-foreground">{fmtCurrency(clientMRR)}<span className="text-muted-foreground text-caption">/mo</span></span>
                    <span className="font-mono tabular-nums text-foreground">{fmtCurrency(clientValue)}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border animate-fade-in">
                    <div className="flex items-center justify-end px-4 py-2 bg-accent/10">
                      <Button variant="ghost" size="sm" onClick={() => openDealWizardForClient(clientName)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Deal
                      </Button>
                    </div>
                    <table className="w-full text-ui">
                      <thead>
                        <tr className="bg-accent/20">
                          <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal</th>
                          <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Type</th>
                          <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Status</th>
                          <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">RAG</th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">MRR</th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Total Value</th>
                          <th className="text-left py-2 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">VSD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientDeals.map(deal => (
                          <tr key={deal.id} className="border-t border-border/50 hover:bg-accent/10 transition-colors">
                            <td className="py-2.5 px-4">
                              <Link to={`/deals/${deal.id}`} className="text-primary hover:underline font-medium">
                                {deal.dealName}
                              </Link>
                              <span className="ml-2 text-caption text-muted-foreground font-mono">({deal.dealId})</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
                                deal.dealType === "Retainer" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                              )}>{deal.dealType}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
                                deal.dealStatusCx === "Active" ? "text-positive" : "text-muted-foreground",
                                deal.dealStatusCx === "Active" ? "bg-[hsl(var(--success-bg))]" : "bg-secondary"
                              )}>{deal.dealStatusCx || deal.dealStatus}</span>
                            </td>
                            <td className="py-2.5 px-4">{ragDot(deal.rag || "green")}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-foreground">{fmtCurrency(deal.mrr)}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-foreground">{fmtCurrency(deal.totalDealValue)}</td>
                            <td className="py-2.5 px-4 text-muted-foreground">{deal.vsd}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {clientGroups.length === 0 && (
            <div className="data-card text-center py-12">
              <p className="text-muted-foreground">No clients found matching your filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSubmit={async (client) => {
          const result = await addClient(client);
          if (result) toast.success(`Client "${result.name}" created`);
        }}
      />

      <DealFormWizard
        open={dealWizardOpen}
        onOpenChange={setDealWizardOpen}
        clients={clients}
        preSelectedClientId={dealWizardClientId}
        onCreateClient={() => {
          setDealWizardOpen(false);
          setClientDialogOpen(true);
        }}
        onSubmit={handleCreateDeal}
      />
    </AppLayout>
  );
}
