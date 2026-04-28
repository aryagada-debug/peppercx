import React from "react";
import { formatINR } from "@/lib/csvTargets";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { Search, Plus, Loader2, Trash2, Pencil, Check, X, Building2, Briefcase, Activity, TrendingUp, DollarSign, Settings2 } from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { useClients } from "@/hooks/useClients";
import { useDealAccess } from "@/hooks/useDealAccess";
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
import { useAppUsers, useVsdUsers } from "@/hooks/useAppUsers";
import { ReadOnlyBanner } from "@/components/access/ReadOnlyBanner";

type VsdFilterKey = string;
const UNASSIGNED_VSD_VALUES = new Set(["", "Not Assigned", "Unassigned", "Not Applicable", "To Be Assigned", "Yet to be assigned"]);

const DEAL_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal Completed Successfully", "Deal Churned / Lost"] as const;
const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);
const CLOSED_STATUSES = new Set(["Deal Completed Successfully", "Deal Churned / Lost"]);

const fmtCurrency = (n: number | undefined) => {
  return formatINR(Number(n) || 0);
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
  const { deals: allDeals, people, assignments, loading: staffLoading, refresh: refreshStaffing, updateDeal, addAssignment, updateAssignment, deleteAssignment } = useStaffingData();
  const { clients: allClients, loading: clientsLoading, addClient, deleteClient, deleteDeal, refresh: refreshClients } = useClients();
  const access = useDealAccess();
  const { users: appUsers } = useAppUsers();
  const { vsdUsers, isVsdName, canonVsd } = useVsdUsers();
  const VSD_FILTERS = useMemo(() => {
    const items: { key: string; label: string }[] = [{ key: "All", label: "All" }];
    vsdUsers.forEach((u) => items.push({ key: u.displayName, label: u.displayName }));
    items.push({ key: "Other", label: "Other" });
    items.push({ key: "Unassigned", label: "Unassigned" });
    return items;
  }, [vsdUsers]);
  // Scope deals & clients to what this user is allowed to see.
  const deals = useMemo(
    () => (access.isAdmin ? allDeals : allDeals.filter(d => access.canViewDeal(d.id))),
    [allDeals, access]
  );
  const visibleClientIdSet = useMemo(() => {
    const ids = new Set<string>();
    deals.forEach(d => { if (d.clientId) ids.add(d.clientId); });
    return ids;
  }, [deals]);
  const clients = useMemo(
    () => (access.isAdmin ? allClients : allClients.filter(c => visibleClientIdSet.has(c.id))),
    [allClients, visibleClientIdSet, access.isAdmin]
  );
  const isDealEditable = useCallback(
    (dealId: string) => access.isAdmin || access.canEditDeal(dealId),
    [access]
  );
  const isClientEditable = useCallback(
    (clientId: string) => access.isAdmin || access.canEditClient(clientId),
    [access]
  );

  // Guarded wrappers — silently reject + toast for non-editable deals.
  const guardedUpdateDeal: typeof updateDeal = useCallback((dealId: string, patch: any) => {
    if (!isDealEditable(dealId)) {
      toast.error("View only — you can't edit this deal");
      return Promise.resolve() as any;
    }
    return updateDeal(dealId, patch);
  }, [updateDeal, isDealEditable]);
  const guardedDeleteDeal: typeof deleteDeal = useCallback((dealId: string) => {
    if (!isDealEditable(dealId)) {
      toast.error("View only — you can't delete this deal");
      return Promise.resolve(false) as any;
    }
    return deleteDeal(dealId);
  }, [deleteDeal, isDealEditable]);
  const guardedDeleteClient: typeof deleteClient = useCallback((clientId: string) => {
    if (!isClientEditable(clientId)) {
      toast.error("View only — you can't delete this client");
      return Promise.resolve(false) as any;
    }
    return deleteClient(clientId);
  }, [deleteClient, isClientEditable]);
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
    const map: Record<string, { content?: string; seo?: string; contentAssignmentId?: string; seoAssignmentId?: string }> = {};
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
        return matches[0] ? { name: matches[0].p?.name, assignmentId: matches[0].a.id } : undefined;
      };
      const c = pick("Content");
      const s = pick("SEO");
      map[dealId] = {
        content: c?.name,
        contentAssignmentId: c?.assignmentId,
        seo: s?.name,
        seoAssignmentId: s?.assignmentId,
      };
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
        return !!v && !UNASSIGNED_VSD_VALUES.has(v) && !isVsdName(v);
      });
    } else if (activeVsd !== "All") {
      d = d.filter(deal => canonVsd(deal.vsd) === activeVsd);
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
        const ok = await guardedDeleteClient(client.id);
        if (ok) {
          toast.success(`Client "${deleteTarget.name}" deleted`);
          refreshStaffing();
        } else {
          toast.error("Failed to delete client");
        }
      }
    } else {
      const ok = await guardedDeleteDeal(deleteTarget.id);
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
    guardedUpdateDeal(dealId, { vsd: personName });
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
      guardedUpdateDeal(dealId, { principalBopm: personName });
    } else {
      guardedUpdateDeal(dealId, { seniorBopm: personName });
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

  const handleClearBOPM = async (dealId: string) => {
    if (!isDealEditable(dealId)) {
      toast.error("View only — you can't edit this deal");
      return;
    }
    await guardedUpdateDeal(dealId, { principalBopm: "", seniorBopm: "", bopm: "" });
    const existing = assignments.filter(
      a => a.dealId === dealId && (a.roleKey === "Principal BOPM" || a.roleKey === "Senior BOPM")
    );
    for (const a of existing) {
      await deleteAssignment(a.id);
    }
    toast.success("BOPM removed from deal");
  };

  const handleClearLead = async (dealId: string, kind: "content" | "seo") => {
    if (!isDealEditable(dealId)) {
      toast.error("View only — you can't edit this deal");
      return;
    }
    const lead = leadByDeal[dealId];
    const assignmentId = kind === "content" ? lead?.contentAssignmentId : lead?.seoAssignmentId;
    if (!assignmentId) return;
    await deleteAssignment(assignmentId);
    toast.success(`${kind === "content" ? "Content" : "SEO"} lead removed from deal`);
  };

  const handleMRRSave = (dealId: string, value: string) => {
    guardedUpdateDeal(dealId, { mrr: Number(value) || undefined });
    toast.success("MRR updated");
  };

  const handleTotalRevenueSave = (dealId: string, value: string) => {
    guardedUpdateDeal(dealId, { totalDealValue: Number(value) || undefined });
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
      <div className="px-3 py-4">
        <ReadOnlyBanner routeKey="clients" label="Clients & Deals" />
        {/* Row 1: Title + KPIs + Actions */}
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-subhead font-bold tracking-tight text-foreground whitespace-nowrap">Clients & Deals</h1>
          <div className="flex flex-none gap-1.5 flex-wrap">
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
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-gradient-to-br to-transparent backdrop-blur-sm transition-all hover:shadow-sm",
                  t.bg, t.ring,
                )}
              >
                <div className={cn("rounded-md p-1", t.chip)}>
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
          <div className="flex items-center gap-2 ml-auto">
            {access.isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => setClientDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Client
                </Button>
                <Button size="sm" onClick={() => { setDealWizardClientId(undefined); setDealWizardOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add Deal
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Filters + Search + Closed + Columns */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {access.isAdmin && (
            <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
              {VSD_FILTERS.map(v => (
                <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>{v.label}</button>
              ))}
            </div>
          )}

          <div className="relative max-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search clients or deals..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2 rounded-lg bg-card border border-border text-[12px] text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" />
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer whitespace-nowrap" title="Show closed / completed deals">
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="rounded border-border" />
            Closed
          </label>

          {Object.keys(colFilters).length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="h-8 text-xs gap-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Clear filters ({Object.keys(colFilters).length})
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 ml-auto">
                <Settings2 className="h-3.5 w-3.5" /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-1">Show columns</p>
              <div className="space-y-0.5 max-h-80 overflow-y-auto">
                {ALL_COLS.map(c => (
                  <label
                    key={c.key}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded text-xs",
                      c.required ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-secondary"
                    )}
                  >
                    <Checkbox
                      checked={isVisible(c.key) || !!c.required}
                      disabled={c.required}
                      onCheckedChange={() => toggleCol(c.key, c.required)}
                    />
                    <span className="flex-1">{c.label}</span>
                    {c.required && <span className="text-[9px] text-muted-foreground">locked</span>}
                  </label>
                ))}
              </div>
              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={() => setVisibleCols(DEFAULT_VISIBLE)}
                  className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-secondary text-muted-foreground"
                >
                  Reset to defaults
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Flat Table with column filters */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-ui table-fixed" style={{ width: "100%" }}>
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  {isVisible("account") && <ColHeader label="Client" sortKey="account" colKey="account" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.account} onResizeStart={startResize("account")} />}
                  {isVisible("dealName") && <ColHeader label="Deal Name" sortKey="dealName" colKey="dealName" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.dealName} onResizeStart={startResize("dealName")} />}
                  {isVisible("dealId") && <ColHeader label="Deal ID" sortKey="dealId" colKey="dealId" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.dealId} onResizeStart={startResize("dealId")} />}
                  {isVisible("dealType") && <ColHeader label="Type" sortKey="dealType" colKey="dealType" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["Retainer","Non-Retainer"]} width={colWidths.dealType} onResizeStart={startResize("dealType")} />}
                  {isVisible("dealStatus") && <ColHeader label="Status" sortKey="dealStatus" colKey="dealStatus" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={[...DEAL_STATUSES]} width={colWidths.dealStatus} onResizeStart={startResize("dealStatus")} />}
                  {isVisible("vsd") && <ColHeader label="VSD" sortKey="vsd" colKey="vsd" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.vsd} onResizeStart={startResize("vsd")} />}
                  {isVisible("bopm") && <ColHeader label="P.BOPM / Sr BOPM" colKey="bopm" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.bopm} onResizeStart={startResize("bopm")} />}
                  {isVisible("contentLead") && <ColHeader label="Content Lead" colKey="contentLead" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.contentLead} onResizeStart={startResize("contentLead")} />}
                  {isVisible("seoLead") && <ColHeader label="SEO Lead" colKey="seoLead" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.seoLead} onResizeStart={startResize("seoLead")} />}
                  {isVisible("mrr") && <ColHeader label="MRR" align="right" sortKey="mrr" colKey="mrr" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" width={colWidths.mrr} onResizeStart={startResize("mrr")} />}
                  {isVisible("totalDealValue") && <ColHeader label="Total Revenue" align="right" sortKey="totalDealValue" colKey="totalDealValue" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" width={colWidths.totalDealValue} onResizeStart={startResize("totalDealValue")} />}
                  {isVisible("rag") && <ColHeader label="RGY" align="center" colKey="rag" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["green","amber","red","na","pending"]} width={colWidths.rag} onResizeStart={startResize("rag")} />}
                  <th style={{ width: colWidths.actions, minWidth: colWidths.actions }}></th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(deal => {
                  const clientObj = clients.find(c => c.name === deal.account);
                  const leads = leadByDeal[deal.id] || {};
                  return (
                    <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/10 transition-colors group/row">
                      {isVisible("account") && (
                        <td className="py-2 px-3 truncate" title={deal.account}>
                          <span className="text-xs font-medium text-foreground truncate block">{deal.account}</span>
                        </td>
                      )}
                      {isVisible("dealName") && (
                        <td className="py-2 px-3 truncate">
                          <Link to={`/deals/${deal.id}`} className="text-primary hover:underline text-xs font-medium truncate block" title={deal.dealName}>
                            {deal.dealName}
                          </Link>
                        </td>
                      )}
                      {isVisible("dealId") && <td className="py-2 px-3 text-xs font-mono text-muted-foreground truncate">{deal.dealId}</td>}
                      {isVisible("dealType") && (
                        <td className="py-2 px-3">
                          <Select
                            value={deal.dealType === "Retainer" ? "Retainer" : "Non-Retainer"}
                            onValueChange={(v) => { guardedUpdateDeal(deal.id, { dealType: v as any }); toast.success("Type updated"); }}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-6 w-auto inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border-none shadow-none focus:ring-0 gap-1",
                                (deal.dealType === "Retainer") ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Retainer" className="text-xs">Retainer</SelectItem>
                              <SelectItem value="Non-Retainer" className="text-xs">Non-Retainer</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      {isVisible("dealStatus") && (
                        <td className="py-2 px-3">
                          <Select value={deal.dealStatus || "Active Deal"} onValueChange={(v) => handleStatusChange(deal.id, v)}>
                            <SelectTrigger className="h-6 w-full text-[11px] border-none bg-transparent shadow-none px-1 focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEAL_STATUSES.map(s => (
                                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      {isVisible("vsd") && (
                        <td className="py-2 px-3 truncate">
                          <button
                            onClick={() => setStaffingDialog({ open: true, dealId: deal.id, roleFilter: "Operations", preSelectedName: deal.vsd || undefined })}
                            className="text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate block text-left w-full"
                          >
                            {deal.vsd || <span className="text-muted-foreground">— None —</span>}
                          </button>
                        </td>
                      )}
                      {isVisible("bopm") && (
                        <td className="py-2 px-3 truncate">
                          <div className="flex items-center gap-1 group/cell">
                            <button
                              onClick={() => setStaffingDialog({ open: true, dealId: deal.id, roleFilter: "Operations", preSelectedName: deal.principalBopm || deal.seniorBopm || undefined })}
                              className="text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate block text-left flex-1 min-w-0"
                            >
                              {deal.principalBopm || deal.seniorBopm || <span className="text-muted-foreground">— None —</span>}
                            </button>
                            {(deal.principalBopm || deal.seniorBopm) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleClearBOPM(deal.id); }}
                                className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/cell:opacity-100 transition-opacity flex-none"
                                title="Remove BOPM from this deal"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible("contentLead") && (
                        <td className="py-2 px-3 truncate">
                          <div className="flex items-center gap-1 group/cell">
                            <Link to={`/deals/${deal.id}`} className="text-xs text-foreground hover:text-primary hover:underline truncate block flex-1 min-w-0" title={leads.content || ""}>
                              {leads.content || <span className="text-muted-foreground">— None —</span>}
                            </Link>
                            {leads.content && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleClearLead(deal.id, "content"); }}
                                className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/cell:opacity-100 transition-opacity flex-none"
                                title="Remove Content Lead from this deal"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible("seoLead") && (
                        <td className="py-2 px-3 truncate">
                          <div className="flex items-center gap-1 group/cell">
                            <Link to={`/deals/${deal.id}`} className="text-xs text-foreground hover:text-primary hover:underline truncate block flex-1 min-w-0" title={leads.seo || ""}>
                              {leads.seo || <span className="text-muted-foreground">— None —</span>}
                            </Link>
                            {leads.seo && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleClearLead(deal.id, "seo"); }}
                                className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/cell:opacity-100 transition-opacity flex-none"
                                title="Remove SEO Lead from this deal"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible("mrr") && (
                        <td className="py-2 px-3 text-right">
                          <InlineEditCell value={String(deal.mrr || "")} onSave={v => handleMRRSave(deal.id, v)} type="number" prefix="₹" placeholder="—" />
                        </td>
                      )}
                      {isVisible("totalDealValue") && (
                        <td className="py-2 px-3 text-right">
                          <InlineEditCell value={String(deal.totalDealValue || "")} onSave={v => handleTotalRevenueSave(deal.id, v)} type="number" prefix="₹" placeholder="—" />
                        </td>
                      )}
                      {isVisible("rag") && <td className="py-2 px-3 text-center">{ragDot(deal.rag || "green")}</td>}
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
