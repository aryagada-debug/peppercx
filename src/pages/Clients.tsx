import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { Search, Plus, Loader2, Trash2, Pencil, Check, X, Building2, Briefcase, Activity, TrendingUp, DollarSign, Settings2 } from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { useClients } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientFormDialog } from "@/components/deals/ClientFormDialog";
import { DealFormWizard } from "@/components/deals/DealFormWizard";
import { AddStaffingMemberDialog } from "@/components/staffing/AddStaffingMemberDialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ColHeader } from "@/components/table/ColHeader";

const VSD_FILTERS = [
  { key: "All", label: "All" },
  { key: "Neema Jayadas", label: "Neema Jayadas" },
  { key: "Aamir Khan", label: "Aamir Khan" },
  { key: "Aditya Shaw", label: "Aditya Shaw" },
  { key: "Sneha Iyer", label: "Sneha Iyer" },
  { key: "Sumit Shekhawat", label: "Sumit Shekhawat" },
  { key: "Other", label: "Other" },
  { key: "Unassigned", label: "Unassigned" },
] as const;
type VsdFilterKey = typeof VSD_FILTERS[number]["key"];
const NAMED_VSDS = new Set(["Neema Jayadas", "Aamir Khan", "Aditya Shaw", "Sneha Iyer", "Sumit Shekhawat"]);
const UNASSIGNED_VSD_VALUES = new Set(["", "Not Assigned", "Unassigned", "Not Applicable", "To Be Assigned", "Yet to be assigned"]);

const DEAL_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal Completed Successfully", "Deal Churned / Lost"] as const;
const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);
const CLOSED_STATUSES = new Set(["Deal Completed Successfully", "Deal Churned / Lost"]);

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

// ── Inline Editable Cell ──
function InlineEditCell({ value, onSave, type = "text", prefix = "", placeholder = "—" }: {
  value: string; onSave: (v: string) => void; type?: string; prefix?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={local} onChange={e => setLocal(e.target.value)} type={type} className="h-6 text-xs w-full min-w-[60px]" autoFocus
          onKeyDown={e => { if (e.key === "Enter") { onSave(local); setEditing(false); } if (e.key === "Escape") { setLocal(value); setEditing(false); } }} />
        <button onClick={() => { onSave(local); setEditing(false); }} className="text-primary"><Check className="h-3 w-3" /></button>
        <button onClick={() => { setLocal(value); setEditing(false); }} className="text-muted-foreground"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  return (
    <div className="group/edit flex items-center gap-1 cursor-pointer" onClick={() => { setLocal(value); setEditing(true); }}>
      <span className={cn("text-xs font-medium font-mono tabular-nums", value ? "text-foreground" : "text-muted-foreground")}>{prefix}{value || placeholder}</span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity" />
    </div>
  );
}

export default function Clients() {
  const { deals, people, assignments, loading: staffLoading, refresh: refreshStaffing, updateDeal, addAssignment, updateAssignment } = useStaffingData();
  const { clients, loading: clientsLoading, addClient, deleteClient, deleteDeal, refresh: refreshClients } = useClients();
  const [search, setSearch] = useState("");
  const [activeVsd, setActiveVsd] = useState<VsdFilterKey>("All");
  const [showClosed, setShowClosed] = useState(false);

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [dealWizardOpen, setDealWizardOpen] = useState(false);
  const [dealWizardClientId, setDealWizardClientId] = useState<string | undefined>();

  const [deleteTarget, setDeleteTarget] = useState<{ type: "client" | "deal"; id: string; name: string } | null>(null);
  const [staffingDialog, setStaffingDialog] = useState<{ open: boolean; dealId: string; roleFilter?: "Operations"; preSelectedName?: string } | null>(null);

  // Per-column filters (text values; numeric filters use min input)
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Column visibility (Client + Deal Name are always on)
  const ALL_COLS = useMemo(() => ([
    { key: "account", label: "Client", required: true },
    { key: "dealName", label: "Deal Name", required: true },
    { key: "dealId", label: "Deal ID" },
    { key: "dealType", label: "Type" },
    { key: "dealStatus", label: "Status" },
    { key: "vsd", label: "VSD" },
    { key: "bopm", label: "P.BOPM / Sr BOPM" },
    { key: "contentLead", label: "Content Lead" },
    { key: "seoLead", label: "SEO Lead" },
    { key: "mrr", label: "MRR" },
    { key: "totalDealValue", label: "Total Revenue" },
    { key: "rag", label: "RGY" },
  ]), []);

  const DEFAULT_VISIBLE = ["account","dealName","dealId","dealType","dealStatus","vsd","bopm","mrr","totalDealValue","rag"];
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("clients-visible-cols");
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_VISIBLE;
  });
  useEffect(() => {
    try { localStorage.setItem("clients-visible-cols", JSON.stringify(visibleCols)); } catch {}
  }, [visibleCols]);
  const isVisible = (k: string) => visibleCols.includes(k);
  const toggleCol = (k: string, required?: boolean) => {
    if (required) return;
    setVisibleCols(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k]);
  };

  // Column widths (resizable)
  const DEFAULT_WIDTHS: Record<string, number> = {
    account: 160, dealName: 200, dealId: 100, dealType: 100, dealStatus: 130,
    vsd: 130, bopm: 150, contentLead: 140, seoLead: 140, mrr: 110, totalDealValue: 130, rag: 70, actions: 40,
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem("clients-col-widths");
      if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_WIDTHS;
  });
  useEffect(() => {
    try { localStorage.setItem("clients-col-widths", JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const startResize = useCallback((key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key, startX: e.clientX, startW: colWidths[key] || 120 };
    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const next = Math.max(60, Math.min(500, r.startW + (ev.clientX - r.startX)));
      setColWidths(prev => ({ ...prev, [r.key]: next }));
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]);

  const setFilter = (key: string, val: string) => setColFilters(prev => ({ ...prev, [key]: val }));
  const clearFilter = (key: string) => setColFilters(prev => { const n = { ...prev }; delete n[key]; return n; });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // People filtered by role for dropdowns
  const vsdPeople = useMemo(() => people.filter(p => (p.roleTitle || "").toLowerCase().includes("vsd")), [people]);
  const bopmPeople = useMemo(() => people.filter(p => {
    const rt = (p.roleTitle || "").toLowerCase();
    return rt.includes("principal bopm") || rt.includes("senior bopm");
  }), [people]);

  // Resolve Content / SEO leads per deal from assignments
  const leadByDeal = useMemo(() => {
    const map: Record<string, { content?: string; seo?: string }> = {};
    const peopleById = new Map(people.map(p => [p.id, p]));
    const grouped: Record<string, typeof assignments> = {};
    for (const a of assignments) {
      (grouped[a.dealId] = grouped[a.dealId] || []).push(a);
    }
    for (const dealId of Object.keys(grouped)) {
      const list = grouped[dealId];
      const pick = (cat: string) => {
        const matches = list
          .map(a => ({ a, p: peopleById.get(a.personId) }))
          .filter(({ p }) => p && (p.roleCategory || "").toLowerCase() === cat.toLowerCase())
          .sort((x, y) => (Number(y.a.allocationPct) || 0) - (Number(x.a.allocationPct) || 0));
        return matches[0]?.p?.name;
      };
      map[dealId] = { content: pick("Content"), seo: pick("SEO") };
    }
    return map;
  }, [assignments, people]);

  const filteredDeals = useMemo(() => {
    let d = deals;
    if (!showClosed) d = d.filter(deal => ACTIVE_STATUSES.has(deal.dealStatus));
    if (activeVsd === "Unassigned") {
      d = d.filter(deal => UNASSIGNED_VSD_VALUES.has((deal.vsd || "").trim()));
    } else if (activeVsd === "Other") {
      d = d.filter(deal => {
        const v = (deal.vsd || "").trim();
        return v && !UNASSIGNED_VSD_VALUES.has(v) && !NAMED_VSDS.has(v);
      });
    } else if (activeVsd !== "All") {
      d = d.filter(deal => (deal.vsd || "").trim() === activeVsd);
    }
    if (search) d = d.filter(deal => deal.account.toLowerCase().includes(search.toLowerCase()) || deal.dealName.toLowerCase().includes(search.toLowerCase()));
    return d;
  }, [deals, activeVsd, search, showClosed]);

  // Apply per-column filters + sort to produce flat row list
  const tableRows = useMemo(() => {
    const matches = (val: any, q: string) => String(val ?? "").toLowerCase().includes(q.toLowerCase());
    let rows = filteredDeals.filter(d => {
      if (colFilters.account && !matches(d.account, colFilters.account)) return false;
      if (colFilters.dealName && !matches(d.dealName, colFilters.dealName)) return false;
      if (colFilters.dealId && !matches(d.dealId, colFilters.dealId)) return false;
      if (colFilters.dealType && d.dealType !== colFilters.dealType) return false;
      if (colFilters.dealStatus && (d.dealStatus || "Active Deal") !== colFilters.dealStatus) return false;
      if (colFilters.vsd && !matches(d.vsd, colFilters.vsd)) return false;
      if (colFilters.bopm && !matches(`${d.principalBopm || ""} ${d.seniorBopm || ""}`, colFilters.bopm)) return false;
      if (colFilters.mrr && (Number(d.mrr) || 0) < Number(colFilters.mrr)) return false;
      if (colFilters.totalDealValue && (Number(d.totalDealValue) || 0) < Number(colFilters.totalDealValue)) return false;
      if (colFilters.rag) {
        const rag = (d.rag || "").toLowerCase();
        if (colFilters.rag === "pending") {
          if (rag) return false;
        } else if (rag !== colFilters.rag) {
          return false;
        }
      }
      return true;
    });
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a: any, b: any) => {
        const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
        if (typeof av === "number" || typeof bv === "number") return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    } else {
      rows = [...rows].sort((a, b) => a.account.localeCompare(b.account) || a.dealName.localeCompare(b.dealName));
    }
    return rows;
  }, [filteredDeals, colFilters, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const clientSet = new Set(filteredDeals.map(d => d.account));
    return {
      clients: clientSet.size,
      deals: filteredDeals.length,
      activeDeals: filteredDeals.filter(d => ACTIVE_STATUSES.has(d.dealStatus)).length,
      totalMRR: filteredDeals.reduce((s, d) => s + (d.mrr || 0), 0),
      totalValue: filteredDeals.reduce((s, d) => s + (d.totalDealValue || 0), 0),
    };
  }, [filteredDeals]);

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
      deal_status_cx: data.dealStatus,
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
    await supabase.from("staffing_deals").update({ deal_status: newStatus, deal_status_cx: newStatus } as any).eq("id", dealId);
    refreshStaffing();
  };

  const handleVSDChange = (dealId: string, personName: string) => {
    updateDeal(dealId, { vsd: personName });
    // Find or create staffing assignment
    const person = people.find(p => p.name === personName);
    if (person) {
      const existing = assignments.find(a => a.dealId === dealId && a.roleKey === "VSD");
      if (existing) {
        updateAssignment(existing.id, { personId: person.id });
      } else {
        addAssignment({ id: uid(), dealId, roleKey: "VSD", personId: person.id, allocationPct: 10 });
      }
    }
    toast.success("VSD updated");
  };

  const handleBOPMChange = (dealId: string, personName: string) => {
    const person = people.find(p => p.name === personName);
    const rt = (person?.roleTitle || "").toLowerCase();
    if (rt.includes("principal")) {
      updateDeal(dealId, { principalBopm: personName });
    } else {
      updateDeal(dealId, { seniorBopm: personName });
    }
    if (person) {
      const existing = assignments.find(a => a.dealId === dealId && (a.roleKey === "Principal BOPM" || a.roleKey === "Senior BOPM"));
      if (existing) {
        updateAssignment(existing.id, { personId: person.id, roleKey: person.roleTitle || "Senior BOPM" });
      } else {
        addAssignment({ id: uid(), dealId, roleKey: person.roleTitle || "Senior BOPM", personId: person.id, allocationPct: 10 });
      }
    }
    toast.success("BOPM updated");
  };

  const handleMRRSave = (dealId: string, value: string) => {
    updateDeal(dealId, { mrr: Number(value) || undefined });
    toast.success("MRR updated");
  };

  const handleTotalRevenueSave = (dealId: string, value: string) => {
    updateDeal(dealId, { totalDealValue: Number(value) || undefined });
    toast.success("Total Revenue updated");
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

        {/* KPI Strip — compact modern cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          {[
            { label: "Clients", value: String(kpis.clients), Icon: Building2, tint: "sky" },
            { label: "Total Deals", value: String(kpis.deals), Icon: Briefcase, tint: "violet" },
            { label: "Active Deals", value: String(kpis.activeDeals), Icon: Activity, tint: "emerald" },
            { label: "Total MRR", value: fmtCurrency(kpis.totalMRR), Icon: TrendingUp, tint: "amber" },
            { label: "Total Value", value: fmtCurrency(kpis.totalValue), Icon: DollarSign, tint: "rose" },
          ].map(({ label, value, Icon, tint }) => {
            const tintMap: Record<string, { bg: string; ring: string; chip: string; icon: string }> = {
              sky: { bg: "from-sky-500/10", ring: "border-sky-500/20", chip: "bg-sky-500/15", icon: "text-sky-500" },
              violet: { bg: "from-violet-500/10", ring: "border-violet-500/20", chip: "bg-violet-500/15", icon: "text-violet-500" },
              emerald: { bg: "from-emerald-500/10", ring: "border-emerald-500/20", chip: "bg-emerald-500/15", icon: "text-emerald-500" },
              amber: { bg: "from-amber-500/10", ring: "border-amber-500/20", chip: "bg-amber-500/15", icon: "text-amber-500" },
              rose: { bg: "from-rose-500/10", ring: "border-rose-500/20", chip: "bg-rose-500/15", icon: "text-rose-500" },
            };
            const t = tintMap[tint];
            return (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-gradient-to-br to-transparent backdrop-blur-sm transition-all hover:shadow-sm hover:-translate-y-0.5",
                  t.bg, t.ring,
                )}
              >
                <div className={cn("rounded-lg p-1.5", t.chip)}>
                  <Icon className={cn("h-4 w-4", t.icon)} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
                  <p className="text-base font-semibold tracking-tight text-foreground font-mono leading-tight truncate">{value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {VSD_FILTERS.map(v => (
              <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{v.label}</button>
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

          {Object.keys(colFilters).length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="text-xs gap-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Clear filters ({Object.keys(colFilters).length})
            </Button>
          )}
        </div>

        {/* Flat Table with column filters */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-ui">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  <ColHeader label="Client" sortKey="account" colKey="account" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} />
                  <ColHeader label="Deal Name" sortKey="dealName" colKey="dealName" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} />
                  <ColHeader label="Deal ID" sortKey="dealId" colKey="dealId" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} />
                  <ColHeader label="Type" sortKey="dealType" colKey="dealType" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["Retainer","Non-Retainer"]} />
                  <ColHeader label="Status" sortKey="dealStatus" colKey="dealStatus" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={[...DEAL_STATUSES]} />
                  <ColHeader label="VSD" sortKey="vsd" colKey="vsd" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} />
                  <ColHeader label="P.BOPM / Sr BOPM" colKey="bopm" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} />
                  <ColHeader label="MRR" align="right" sortKey="mrr" colKey="mrr" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" />
                  <ColHeader label="Total Revenue" align="right" sortKey="totalDealValue" colKey="totalDealValue" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" />
                  <ColHeader label="RGY" align="center" colKey="rag" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["green","amber","red","na","pending"]} />
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(deal => {
                  const clientObj = clients.find(c => c.name === deal.account);
                  return (
                    <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/10 transition-colors group/row">
                      <td className="py-2 px-3">
                        <span className="text-xs font-medium text-foreground truncate max-w-[140px] block" title={deal.account}>{deal.account}</span>
                      </td>
                      <td className="py-2 px-3">
                        <Link to={`/deals/${deal.id}`} className="text-primary hover:underline text-xs font-medium">
                          {deal.dealName}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-xs font-mono text-muted-foreground">{deal.dealId}</td>
                      <td className="py-2 px-3">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium",
                          deal.dealType === "Retainer" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                        )}>{deal.dealType}</span>
                      </td>
                      <td className="py-2 px-3">
                        <Select value={deal.dealStatus || "Active Deal"} onValueChange={(v) => handleStatusChange(deal.id, v)}>
                          <SelectTrigger className="h-6 w-[85px] text-[11px] border-none bg-transparent shadow-none px-1 focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEAL_STATUSES.map(s => (
                              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => setStaffingDialog({ open: true, dealId: deal.id, roleFilter: "Operations", preSelectedName: deal.vsd || undefined })}
                          className="text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate max-w-[110px] block text-left"
                        >
                          {deal.vsd || <span className="text-muted-foreground">— None —</span>}
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => setStaffingDialog({ open: true, dealId: deal.id, roleFilter: "Operations", preSelectedName: deal.principalBopm || deal.seniorBopm || undefined })}
                          className="text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate max-w-[120px] block text-left"
                        >
                          {deal.principalBopm || deal.seniorBopm || <span className="text-muted-foreground">— None —</span>}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <InlineEditCell value={String(deal.mrr || "")} onSave={v => handleMRRSave(deal.id, v)} type="number" prefix="₹" placeholder="—" />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <InlineEditCell value={String(deal.totalDealValue || "")} onSave={v => handleTotalRevenueSave(deal.id, v)} type="number" prefix="₹" placeholder="—" />
                      </td>
                      <td className="py-2 px-3 text-center">{ragDot(deal.rag || "green")}</td>
                      <td className="py-2 px-1">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => setDeleteTarget({ type: "deal", id: deal.id, name: deal.dealName })}
                            className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                            title="Delete deal"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {tableRows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No deals found matching your filters.</p>
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

      {staffingDialog && (
        <AddStaffingMemberDialog
          open={staffingDialog.open}
          onOpenChange={(v) => { if (!v) setStaffingDialog(null); }}
          people={people}
          assignments={assignments}
          deals={deals}
          dealId={staffingDialog.dealId}
          initialCategory={staffingDialog.roleFilter}
          onAdd={(assignment) => {
            const person = people.find(p => p.id === assignment.personId);
            if (!person) return;
            const rt = (person.roleTitle || "").toLowerCase();
            if (rt.includes("vsd")) {
              handleVSDChange(staffingDialog.dealId, person.name);
            } else {
              handleBOPMChange(staffingDialog.dealId, person.name);
            }
            setStaffingDialog(null);
          }}
        />
      )}

    </AppLayout>
  );
}
