import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { Search, ChevronDown, ChevronRight, Building2, Plus, Loader2, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const DEAL_STATUSES = ["Active", "Paused", "Closed", "Lost", "Pipeline", "Won"] as const;

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
  const { clients, loading: clientsLoading, addClient, deleteClient, deleteDeal, refresh: refreshClients } = useClients();
  const [search, setSearch] = useState("");
  const [activePod, setActivePod] = useState<Pod>("All");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [dealWizardOpen, setDealWizardOpen] = useState(false);
  const [dealWizardClientId, setDealWizardClientId] = useState<string | undefined>();

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: "client" | "deal"; id: string; name: string } | null>(null);

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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "client") {
      const client = clients.find(c => c.name === deleteTarget.name);
      if (client) {
        const ok = await deleteClient(client.id);
        if (ok) {
          toast.success(`Client "${deleteTarget.name}" deleted`);
          refreshStaffing();
        } else {
          toast.error("Failed to delete client");
        }
      }
    } else {
      const ok = await deleteDeal(deleteTarget.id);
      if (ok) {
        toast.success(`Deal "${deleteTarget.name}" deleted`);
        refreshStaffing();
      } else {
        toast.error("Failed to delete deal");
      }
    }
    setDeleteTarget(null);
  };

  const handleStatusChange = async (dealId: string, newStatus: string) => {
    await supabase.from("staffing_deals").update({ deal_status_cx: newStatus } as any).eq("id", dealId);
    refreshStaffing();
  };

  const loading = staffLoading || clientsLoading;

  if (loading) {
    return (
      <AppLayout>
        <div className="p-5 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">Clients & Deals</h1>
            <p className="text-ui text-muted-foreground mt-0.5">{kpis.clients} clients • {kpis.deals} deals</p>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
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
            Show closed
          </label>
        </div>

        {/* Client List */}
        <div className="space-y-0.5">
          {clientGroups.map(([clientName, clientDeals]) => {
            const isExpanded = expandedClients.has(clientName);
            const clientMRR = clientDeals.reduce((s, d) => s + (d.mrr || 0), 0);
            const clientValue = clientDeals.reduce((s, d) => s + (d.totalDealValue || 0), 0);
            const vsd = clientDeals[0]?.vsd || "—";
            const principalBopm = clientDeals[0]?.principalBopm || "—";

            return (
              <div key={clientName} className="data-card !p-0 overflow-hidden">
                <div className="flex items-center group">
                  <button
                    onClick={() => toggleClient(clientName)}
                    className="flex-1 flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors text-left"
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ type: "client", id: clientName, name: clientName });
                    }}
                    className="px-2 py-2 mr-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete client"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border animate-fade-in">
                    <div className="flex items-center justify-end px-3 py-1.5 bg-accent/10">
                      <Button variant="ghost" size="sm" onClick={() => openDealWizardForClient(clientName)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Deal
                      </Button>
                    </div>
                    <table className="w-full text-ui">
                      <thead>
                        <tr className="bg-accent/20">
                          <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal</th>
                          <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Type</th>
                          <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Status</th>
                          <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">RAG</th>
                          <th className="text-right py-1.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">MRR</th>
                          <th className="text-right py-1.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Total Value</th>
                          <th className="text-left py-1.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">VSD</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientDeals.map(deal => (
                          <tr key={deal.id} className="border-t border-border/50 hover:bg-accent/10 transition-colors group/row">
                            <td className="py-1.5 px-3">
                              <Link to={`/deals/${deal.id}`} className="text-primary hover:underline font-medium">
                                {deal.dealName}
                              </Link>
                              <span className="ml-2 text-caption text-muted-foreground font-mono">({deal.dealId})</span>
                            </td>
                            <td className="py-1.5 px-3">
                              <span className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
                                deal.dealType === "Retainer" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                              )}>{deal.dealType}</span>
                            </td>
                            <td className="py-1.5 px-3">
                              <Select
                                value={deal.dealStatusCx || deal.dealStatus || "Active"}
                                onValueChange={(v) => handleStatusChange(deal.id, v)}
                              >
                                <SelectTrigger className="h-6 w-[90px] text-[11px] border-none bg-transparent shadow-none px-1 focus:ring-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DEAL_STATUSES.map(s => (
                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-1.5 px-3">{ragDot(deal.rag || "green")}</td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums text-foreground">{fmtCurrency(deal.mrr)}</td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums text-foreground">{fmtCurrency(deal.totalDealValue)}</td>
                            <td className="py-1.5 px-3 text-muted-foreground">{deal.vsd}</td>
                            <td className="py-1.5 px-1">
                              <button
                                onClick={() => setDeleteTarget({ type: "deal", id: deal.id, name: deal.dealName })}
                                className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                                title="Delete deal"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "client" ? "client" : "deal"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "client"
                ? `This will permanently delete "${deleteTarget.name}" and all associated deals, financials, tasks, and MBR entries.`
                : `This will permanently delete deal "${deleteTarget?.name}" and all related data.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
