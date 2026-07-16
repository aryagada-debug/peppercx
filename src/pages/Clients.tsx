import React from "react";
import { formatINR } from "@/lib/csvTargets";
import { useCurrency, useCurrencyVersion } from "@/contexts/CurrencyContext";
import { dealDisplayCurrency } from "@/lib/dealCurrency";
import { formatMoney } from "@/lib/currency";
import { CURRENCY_SYMBOL, convertFromInr, convertToInr } from "@/lib/currency";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { Search, Plus, Loader2, Trash2, Pencil, Check, X, Building2, Briefcase, Activity, TrendingUp, DollarSign, IndianRupee, Settings2, Paperclip, Download } from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useStaffingQueries } from "@/hooks/queries/useStaffingQueries";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { useClients } from "@/hooks/useClients";
import { useDealAccess } from "@/hooks/useDealAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { submitApprovalRequest } from "@/lib/approvals";
import { sendAppEmail } from "@/lib/appEmail";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollToStartButton } from "@/components/ui/ScrollToStartButton";
import { ClientFormDialog } from "@/components/deals/ClientFormDialog";
import { DealFormWizard } from "@/components/deals/DealFormWizard";
import { DealDocsUpload } from "@/components/deals/DealDocsUpload";
import { AddStaffingMemberDialog } from "@/components/staffing/AddStaffingMemberDialog";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRoleKey, uid, PEPPER_BUSINESS_UNITS, CAPABILITY_LINES } from "@/data/staffingData";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format as formatDate } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { ColHeader } from "@/components/table/ColHeader";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useAppUsers, useVsdUsers, useBopmDirectory, nameKey, useAllPersonNames } from "@/hooks/queries/legacy";
import { ReadOnlyBanner } from "@/components/access/ReadOnlyBanner";
import { BopmFilter, dealMatchesBopm, dealsStaffedByName } from "@/components/access/BopmFilter";
import { useAuth } from "@/components/auth/AuthProvider";
// BopmClientsHeader removed per request — KPIs below now serve that role.
import { useDealRgyRollup, type RgyLetter } from "@/hooks/useDealRgyRollup";
import { useGeoFilter } from "@/contexts/GeoFilterContext";
import { ClientsAnalyticsTab } from "@/components/clients/analytics/ClientsAnalyticsTab";
import { BarChart3, Table as TableIcon } from "lucide-react";

type VsdFilterKey = string;
const UNASSIGNED_VSD_VALUES = new Set(["", "Not Assigned", "Unassigned", "Not Applicable", "To Be Assigned", "Yet to be assigned"]);

const DEAL_STATUSES = ["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal Completed Successfully", "Deal Churned / Lost"] as const;
const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);
const CLOSED_STATUSES = new Set(["Deal Completed Successfully", "Deal Churned / Lost"]);


const RgyBlock = ({ letter }: { letter: RgyLetter | undefined }) => {
  const l = letter || "PENDING";
  if (l === "PENDING") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
        —
      </span>
    );
  }
  if (l === "NA") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-muted text-muted-foreground text-[11px] font-medium">
        —
      </span>
    );
  }
  const cls =
    l === "R" ? "bg-destructive text-destructive-foreground"
    : l === "Y" ? "bg-warning text-warning-foreground"
    : "bg-positive text-positive-foreground";
  return (
    <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-medium", cls)}>
      {l}
    </span>
  );
};

// ── Inline Editable Cell ──
function InlineEditCell({ value, onSave, type = "text", prefix = "", placeholder = "—", displayClassName }: {
  value: string; onSave: (v: string) => void; type?: string; prefix?: string; placeholder?: string; displayClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (type === "date") {
    const parsed = value ? new Date(value + "T00:00:00") : undefined;
    const display = parsed && !Number.isNaN(parsed.getTime())
      ? formatDate(parsed, "dd MMM yyyy")
      : (placeholder || "—");
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group/edit inline-flex items-center gap-1 text-xs font-medium tabular-nums cursor-pointer",
              parsed ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span>{display}</span>
            <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={parsed}
            onSelect={(d) => { if (d) onSave(formatDate(d, "yyyy-MM-dd")); }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={local}
          onChange={e => {
            const next = e.target.value;
            setLocal(next);
          }}
          type={type}
          className="h-6 text-xs w-full min-w-[60px]"
          autoFocus
          onKeyDown={e => { if (e.key === "Enter") { onSave(local); setEditing(false); } if (e.key === "Escape") { setLocal(value); setEditing(false); } }}
        />
        <button onClick={() => { onSave(local); setEditing(false); }} className="text-primary"><Check className="h-3 w-3" /></button>
        <button onClick={() => { setLocal(value); setEditing(false); }} className="text-muted-foreground"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  return (
    <div className="group/edit flex items-center gap-1 cursor-pointer" onClick={() => { setLocal(value); setEditing(true); }}>
      <span className={cn(
        displayClassName ?? "text-xs font-medium font-mono tabular-nums",
        value ? "text-foreground" : "text-muted-foreground",
        "truncate",
      )}>{prefix}{value || placeholder}</span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground/70 opacity-60 group-hover/edit:opacity-100 group-hover/edit:text-primary transition-all shrink-0" />
    </div>
  );
}

export default function Clients() {
  useCurrencyVersion();
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const { currency, fxRate, format } = useCurrency();
  const fmtCurrency = (n: number | undefined) => format(Number(n) || 0);
  const ValueIcon = currency === "USD" ? DollarSign : IndianRupee;
  const { deals: allDeals, people, assignments, loading: staffLoading, refresh: refreshStaffing } = useStaffingQueries();
  const { updateDeal, addAssignment, updateAssignment, deleteAssignment } = useStaffingMutations();
  const { clients: allClients, loading: clientsLoading, addClient, updateClient, deleteClient, deleteDeal, refresh: refreshClients } = useClients();
  const access = useDealAccess();
  const { matchesDeal: geoMatchesDeal, geo: geoFilter } = useGeoFilter();
  const isCentralCx = access.isAdmin;
  const [view, setView] = useState<"analytics" | "table">("table");
  const { canEditAll, role } = useUserRole();
  const isCapLead = role === "capability_lead";
  const isCapMember = role === "capability_member";
  const isBopm = role === "user" || isCapMember;
  const { users: appUsers } = useAppUsers();
  const { vsdUsers, isVsdName, canonVsd } = useVsdUsers();
  const { bopmUsersForVsd } = useBopmDirectory();
  const allPersonNames = useAllPersonNames();
  const { user: authUser } = useAuth();
  const [myVsdName, setMyVsdName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authUser) { setMyVsdName(null); return; }
      const { data: profile } = await supabase
        .from("profiles").select("staffing_person_id").eq("user_id", authUser.id).maybeSingle();
      const personId = (profile as any)?.staffing_person_id;
      if (!personId) { if (!cancelled) setMyVsdName(null); return; }
      const { data: person } = await supabase
        .from("staffing_people").select("name, role_title, designation").eq("id", personId).maybeSingle();
      const p: any = person;
      if (!p) { if (!cancelled) setMyVsdName(null); return; }
      const looksLikeVsd = /\bvsd\b|vertical service delivery|service delivery (leader|director)/i
        .test(`${p.role_title || ""} ${p.designation || ""}`);
      const canon = canonVsd(p.name);
      if (!cancelled) setMyVsdName(looksLikeVsd && canon ? canon : null);
    })();
    return () => { cancelled = true; };
  }, [authUser, canonVsd]);
  const isVsdViewer = !access.isAdmin && !!myVsdName;
  // True BOPMs are view-only on Type / Status / MRR / Total Revenue —
  // they cannot edit and cannot submit a change request for these fields.
  const isBopmViewOnly = isBopm && !isVsdViewer;
  const myBopms = useMemo(
    () => (myVsdName ? bopmUsersForVsd(myVsdName).map((p) => p.name) : []),
    [myVsdName, bopmUsersForVsd]
  );
  const VSD_FILTERS = useMemo(() => {
    const items: { key: string; label: string }[] = [{ key: "All", label: "All" }];
    vsdUsers.forEach((u) => items.push({ key: u.displayName, label: u.displayName }));
    items.push({ key: "Other", label: "Other" });
    items.push({ key: "Unassigned", label: "Unassigned" });
    return items;
  }, [vsdUsers]);
  // Scope deals & clients to what this user is allowed to see.
  const deals = useMemo(
    () => {
      const visible = access.isAdmin ? allDeals : allDeals.filter(d => access.canViewDeal(d.id));
      return visible.filter(d => geoMatchesDeal(d));
    },
    [allDeals, access, geoMatchesDeal]
  );
  const dealIdList = useMemo(() => deals.map(d => d.id), [deals]);
  const { rgyRollup } = useDealRgyRollup(dealIdList);
  const rgyLetterToFilter = (l: RgyLetter | undefined): string => {
    if (!l || l === "PENDING") return "pending";
    if (l === "NA") return "na";
    if (l === "R") return "red";
    if (l === "Y") return "amber";
    return "green";
  };
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
    (_dealId: string) => access.isAdmin,
    [access]
  );
  const isClientEditable = useCallback(
    (_clientId: string) => true,
    []
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
  const [activeBopm, setActiveBopm] = useState<string>("All");
  const [showClosed, setShowClosed] = useState(false);

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [dealWizardOpen, setDealWizardOpen] = useState(false);
  const [dealWizardClientId, setDealWizardClientId] = useState<string | undefined>();

  const [deleteTarget, setDeleteTarget] = useState<{ type: "client" | "deal"; id: string; name: string } | null>(null);
  const [staffingDialog, setStaffingDialog] = useState<{ open: boolean; dealId: string; roleFilter?: "Operations" | "Content" | "SEO"; preSelectedName?: string } | null>(null);

  // Per-column filters (text values; numeric filters use min input)
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [renewalFilter, setRenewalFilter] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Column visibility (Client + Deal Name are always on)
  const ALL_COLS = useMemo(() => ([
    { key: "account", label: "Client", required: true },
    { key: "dealName", label: "Deal Name", required: true },
    { key: "dealId", label: "Deal ID" },
    { key: "pcCode", label: "PC Code" },
    { key: "monthClosedWon", label: "Month of Closed Won" },
    { key: "dealType", label: "Type" },
    { key: "dealStatus", label: "Status" },
    { key: "pepperBusinessUnit", label: "Pepper BU" },
    { key: "capabilityLine", label: "Capability Line" },
    { key: "vsd", label: "VSD" },
    { key: "bopm", label: "P.BOPM / Sr BOPM" },
    { key: "bopmOnly", label: "BOPM" },
    { key: "contentLead", label: "Content Lead" },
    { key: "seoLead", label: "SEO Lead" },
    { key: "mrr", label: "MRR" },
    { key: "retainerDealValue", label: "Retainer Deal Value" },
    { key: "nonRetainerDealValue", label: "Non-Retainer Deal Value" },
    { key: "totalDealValue", label: "Total Revenue" },
    { key: "duration", label: "Duration" },
    { key: "rag", label: "RGY" },
  ]), []);

  const DEFAULT_VISIBLE = ["rag","account","dealName","dealId","pcCode","monthClosedWon","dealType","dealStatus","pepperBusinessUnit","capabilityLine","vsd","bopm","bopmOnly","contentLead","seoLead","mrr","totalDealValue","duration"];
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("clients-visible-cols-v3");
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_VISIBLE;
  });
  useEffect(() => {
    try { localStorage.setItem("clients-visible-cols-v3", JSON.stringify(visibleCols)); } catch {}
  }, [visibleCols]);
  const isVisible = (k: string) => visibleCols.includes(k);
  const toggleCol = (k: string, required?: boolean) => {
    if (required) return;
    setVisibleCols(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k]);
  };

  // Non-admin users get a curated, locked column set focused on what they need
  // (per-deal ownership + revenue + RGY). Central CX (admin) keeps the full
  // customizable column picker.
  const NON_ADMIN_COLS = useMemo(() => ([
    "rag", "account", "dealName", "dealType", "dealStatus", "pepperBusinessUnit",
    "vsd", "bopm", "contentLead", "seoLead", "mrr", "totalDealValue",
  ]), []);
  const effectiveVisibleCols = isCentralCx ? visibleCols : NON_ADMIN_COLS;

  // Column reordering via drag and drop on headers
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleColDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setVisibleCols(prev => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  }, []);
  const resetColOrder = () => setVisibleCols(DEFAULT_VISIBLE);

  // Column widths (resizable)
  const DEFAULT_WIDTHS: Record<string, number> = {
    account: 160, dealName: 200, dealId: 100, dealType: 100, dealStatus: 130,
    pepperBusinessUnit: 150, capabilityLine: 200,
    vsd: 130, bopm: 150, bopmOnly: 130, contentLead: 140, seoLead: 140, mrr: 110, totalDealValue: 130, duration: 130, rag: 70, actions: 40,
    pcCode: 110, monthClosedWon: 140, retainerDealValue: 140, nonRetainerDealValue: 160,
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
  const activeAssignments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return assignments.filter((a) => !a.endDate || a.endDate >= today);
  }, [assignments]);

  const leadByDeal = useMemo(() => {
    const map: Record<string, { content?: string; seo?: string; contentAssignmentId?: string; seoAssignmentId?: string }> = {};
    const peopleById = new Map(people.map(p => [p.id, p]));
    const grouped: Record<string, typeof assignments> = {};
    for (const a of activeAssignments) {
      (grouped[a.dealId] = grouped[a.dealId] || []).push(a);
    }
    const CONTENT_ROLE_KEYS = new Set([
      // Normalized (rt_*) keys produced by dbToAssignment + legacy raw keys as a safety net.
      "rt_content_lead", "rt_content_capability_leader", "rt_content_editor",
      "content_lead", "content_lead_2026", "senior_editor", "managing_editor", "content_capability_leader",
    ]);
    const SEO_ROLE_KEYS = new Set([
      "rt_seo_capability_leader", "rt_seo_growth_lead", "rt_seo_operations",
      "seo_leader", "seo_group_head", "sr_seo_manager", "seo_manager",
      "sr_seo_analyst", "seo_analyst", "seo_operations", "seo_capability_leader",
    ]);
    for (const dealId of Object.keys(grouped)) {
      const list = grouped[dealId];
      const pick = (cat: string, roleKeys: Set<string>) => {
        const matches = list
          .map(a => ({ a, p: peopleById.get(a.personId) }))
          .filter(({ a, p }) => {
            if (!p) return false;
            const rk = (a.roleKey || "").toLowerCase();
            if (rk && roleKeys.has(rk)) return true;
            return (p.roleCategory || "").toLowerCase() === cat.toLowerCase();
          })
          .sort((x, y) => (Number(y.a.allocationPct) || 0) - (Number(x.a.allocationPct) || 0));
        return matches[0] ? { name: matches[0].p?.name, assignmentId: matches[0].a.id } : undefined;
      };
      const c = pick("Content", CONTENT_ROLE_KEYS);
      const s = pick("SEO", SEO_ROLE_KEYS);
      map[dealId] = {
        content: c?.name,
        contentAssignmentId: c?.assignmentId,
        seo: s?.name,
        seoAssignmentId: s?.assignmentId,
      };
    }
    return map;
  }, [activeAssignments, people]);

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
    if (activeBopm !== "All") {
      const staffed = dealsStaffedByName(activeBopm, people, assignments);
      d = d.filter(deal => dealMatchesBopm(deal as any, activeBopm, allPersonNames, staffed));
    }
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(deal =>
        (deal.account || "").toLowerCase().includes(q) ||
        (deal.dealName || "").toLowerCase().includes(q) ||
        String((deal as any).id || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [deals, activeVsd, activeBopm, search, showClosed, allPersonNames, people, assignments]);

  // Build dropdown options from people actually assigned to the visible deals
  const peopleColOptions = useMemo(() => {
    const vsd = new Set<string>();
    const bopm = new Set<string>();
    const bopmOnly = new Set<string>();
    const content = new Set<string>();
    const seo = new Set<string>();
    for (const d of filteredDeals) {
      const v = (d.vsd || "").trim(); if (v) vsd.add(v);
      const pb = (d.principalBopm || "").trim(); if (pb) bopm.add(pb);
      const sb = (d.seniorBopm || "").trim(); if (sb) bopm.add(sb);
      const bo = ((d as any).bopm || "").trim(); if (bo) bopmOnly.add(bo);
      const leads = leadByDeal[d.id];
      if (leads?.content) content.add(leads.content);
      if (leads?.seo) seo.add(leads.seo);
    }
    const sortArr = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
    return { vsd: sortArr(vsd), bopm: sortArr(bopm), bopmOnly: sortArr(bopmOnly), content: sortArr(content), seo: sortArr(seo) };
  }, [filteredDeals, leadByDeal]);

  // Deals up for renewal within 90 days (used by both KPI and renewals filter)
  const renewingIds = useMemo(() => {
    const now = new Date();
    const in90 = new Date(); in90.setDate(in90.getDate() + 90);
    const ids = new Set<string>();
    filteredDeals.forEach(d => {
      if (!ACTIVE_STATUSES.has(d.dealStatus) || !d.endDate) return;
      const end = new Date(d.endDate as string);
      if (!isNaN(end.getTime()) && end >= now && end <= in90) ids.add(d.id);
    });
    return ids;
  }, [filteredDeals]);

  // Apply per-column filters + sort to produce flat row list
  const tableRows = useMemo(() => {
    const matches = (val: any, q: string) => String(val ?? "").toLowerCase().includes(q.toLowerCase());
    let rows = filteredDeals.filter(d => {
      if (renewalFilter && !renewingIds.has(d.id)) return false;
      if (colFilters.account && !matches(d.account, colFilters.account)) return false;
      if (colFilters.dealName && !matches(d.dealName, colFilters.dealName)) return false;
      if (colFilters.dealId && !matches(d.dealId, colFilters.dealId)) return false;
      if (colFilters.pcCode && !matches(d.pcCode, colFilters.pcCode)) return false;
      if (colFilters.monthClosedWon && !matches(d.monthClosedWon, colFilters.monthClosedWon)) return false;
      if (colFilters.dealType && d.dealType !== colFilters.dealType) return false;
      if (colFilters.dealStatus && (d.dealStatus || "Active Deal") !== colFilters.dealStatus) return false;
      if (colFilters.pepperBusinessUnit && (d.pepperBusinessUnit || "") !== colFilters.pepperBusinessUnit) return false;
      if (colFilters.capabilityLine && (d.capabilityLine || "") !== colFilters.capabilityLine) return false;
      if (colFilters.vsd && !matches(d.vsd, colFilters.vsd)) return false;
      if (colFilters.bopm && !matches(`${d.principalBopm || ""} ${d.seniorBopm || ""}`, colFilters.bopm)) return false;
      if (colFilters.bopmOnly && !matches((d as any).bopm || "", colFilters.bopmOnly)) return false;
      if (colFilters.contentLead) {
        const name = leadByDeal[d.id]?.content || "";
        if (!matches(name, colFilters.contentLead)) return false;
      }
      if (colFilters.seoLead) {
        const name = leadByDeal[d.id]?.seo || "";
        if (!matches(name, colFilters.seoLead)) return false;
      }
      if (colFilters.mrr && convertFromInr(Number(d.mrr) || 0, currency, fxRate) < Number(colFilters.mrr)) return false;
      if (colFilters.retainerDealValue && convertFromInr(Number(d.retainerDealValue) || 0, currency, fxRate) < Number(colFilters.retainerDealValue)) return false;
      if (colFilters.nonRetainerDealValue && convertFromInr(Number(d.nonRetainerDealValue) || 0, currency, fxRate) < Number(colFilters.nonRetainerDealValue)) return false;
      if (colFilters.totalDealValue && convertFromInr(Number(d.totalDealValue) || 0, currency, fxRate) < Number(colFilters.totalDealValue)) return false;
      if (colFilters.rag) {
        const rag = rgyLetterToFilter(rgyRollup.get(d.id));
        if (rag !== colFilters.rag) return false;
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
      rows = [...rows].sort((a, b) => (a.account ?? "").localeCompare(b.account ?? "") || (a.dealName ?? "").localeCompare(b.dealName ?? ""));
    }
    return rows;
    }, [filteredDeals, colFilters, sortKey, sortDir, rgyRollup, renewalFilter, renewingIds, leadByDeal, currency, fxRate]);

  // ── CSV export of currently-filtered rows ──
  const exportCsv = useCallback(() => {
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const money = (n: any) => {
      const x = convertFromInr(Number(n) || 0, currency, fxRate);
      return Number.isFinite(x) ? x.toFixed(2) : "";
    };
    const headers = [
      "Client", "Deal Name", "Deal ID", "PC Code", "Month Closed Won",
      "Type", "Status", "Pepper BU", "Capability Line",
      "VSD", "P.BOPM / Sr BOPM", "BOPM", "Content Lead", "SEO Lead",
      `MRR (${currency})`, `Retainer Deal Value (${currency})`, `Non-Retainer Deal Value (${currency})`, `Total Revenue (${currency})`,
      "Start Date", "End Date", "Duration (days)", "RGY",
    ];
    const rows = (tableRows as any[]).map(d => {
      const leads = leadByDeal[d.id] || {};
      const psb = [d.principalBopm, d.seniorBopm].filter(Boolean).join(" / ");
      let duration = "";
      if (d.startDate && d.endDate) {
        const s = new Date(d.startDate).getTime();
        const e = new Date(d.endDate).getTime();
        if (!isNaN(s) && !isNaN(e)) duration = String(Math.max(0, Math.round((e - s) / 86400000)));
      }
      return [
        d.account || "", d.dealName || "", d.dealId || "", d.pcCode || "", d.monthClosedWon || "",
        d.dealType || "", d.dealStatus || "", d.pepperBusinessUnit || "", d.capabilityLine || "",
        d.vsd || "", psb, (d as any).bopm || "", leads.content || "", leads.seo || "",
        money(d.mrr), money(d.retainerDealValue), money(d.nonRetainerDealValue), money(d.totalDealValue),
        d.startDate || "", d.endDate || "", duration, rgyRollup.get(d.id) || "PENDING",
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-deals-${formatDate(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }, [tableRows, leadByDeal, rgyRollup, currency, fxRate]);

  const kpis = useMemo(() => {
    const clientSet = new Set(filteredDeals.map(d => d.account));
    // Renewals < 90 days — active deals whose endDate is within next 90d
    const now = new Date();
    const renewing = filteredDeals
      .filter(d => renewingIds.has(d.id) && d.endDate)
      .map(d => ({ d, end: new Date(d.endDate as string) }))
      .sort((a, b) => a.end.getTime() - b.end.getTime());
    const nextRenewal = renewing[0];
    const nextRenewalDays = nextRenewal
      ? Math.max(0, Math.round((nextRenewal.end.getTime() - now.getTime()) / 86400000))
      : null;
    // Clients new this quarter (by deal startDate)
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const newClientsThisQ = new Set(
      filteredDeals
        .filter(d => d.startDate && new Date(d.startDate) >= qStart)
        .map(d => d.account)
    ).size;
    // At-risk active deals (computed rollup === R)
    const atRisk = filteredDeals.filter(d => ACTIVE_STATUSES.has(d.dealStatus) && rgyRollup.get(d.id) === "R").length;
    // Top deal by total value
    const topDeal = [...filteredDeals].sort((a, b) => (Number(b.totalDealValue) || 0) - (Number(a.totalDealValue) || 0))[0];
    return {
      clients: clientSet.size,
      deals: filteredDeals.length,
      activeDeals: filteredDeals.filter(d => ACTIVE_STATUSES.has(d.dealStatus)).length,
      totalMRR: filteredDeals.reduce((s, d) => s + (d.mrr || 0), 0),
      totalValue: filteredDeals.reduce((s, d) => s + (d.totalDealValue || 0), 0),
      renewals90: renewing.length,
      nextRenewalLabel: nextRenewal
        ? `${nextRenewal.d.account} in ${nextRenewalDays}d`
        : "None upcoming",
      newClientsThisQ,
      atRisk,
      topDealLabel: topDeal ? `Top: ${topDeal.account} ${fmtCurrency(topDeal.totalDealValue || 0)}` : "—",
    };
  }, [filteredDeals, rgyRollup, renewingIds]);

  const handleCreateDeal = async (clientId: string, data: any) => {
    const client = clients.find(c => c.id === clientId);
    const newId = uid();
    const dealCount = deals.length + 1;
    const dealIdStr = `D-${String(dealCount).padStart(4, "0")}`;
    const userDealId = (data.dealId || "").trim();

    const dealRow: any = {
      id: newId,
      new_deal_id_temp: dealIdStr,
      new_deal_id_formulated: userDealId || null,
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
      input_currency: data.inputCurrency || "INR",
      pod: data.pod,
      customer_type: data.customerType,
      payment_terms: data.paymentTerms,
      pepper_business_unit: data.pepperBusinessUnit,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      duration: data.duration || null,
      projected_outcomes: data.projectedOutcomes ? [{ text: data.projectedOutcomes }] : [],
      success_metrics: data.successMetrics.filter((m: any) => m.name),
      baseline_metrics: data.baselineMetrics,
      client_id: clientId,
    };

    if (!canEditAll) {
      await submitApprovalRequest({
        type: "deal.create",
        targetKind: "deal",
        targetId: newId,
        payload: { ...dealRow, _sow_items: data.sowItems?.filter?.((s: any) => s.scope) || [] },
      });
      return;
    }

    const { error } = await supabase.from("staffing_deals").insert(dealRow);

    if (error) {
      console.error("Failed to create deal:", error);
      toast.error("Failed to create deal");
      return;
    }

    // Fire deal.created notification (Arya + VSD + capability lead).
    try { sendAppEmail({ event: "deal_created", dealId: newId }); } catch { /* best-effort */ }

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

    // Auto-seed staffing assignments for VSD / BOPM-family roles with 0%
    // allocation so they show up on the Staffing tab without consuming
    // capacity. The sync_bopm_fields_from_assignment trigger keeps the
    // matching deal columns in sync.
    const norm = (s: string) => (s || "").trim().toLowerCase();
    const seedRoles: { name: string; roleKey: "vsd" | "principal_bopm" | "senior_bopm" | "bopm" }[] = [
      { name: data.vsd, roleKey: "vsd" },
      { name: data.principalBopm, roleKey: "principal_bopm" },
      { name: data.seniorBopm, roleKey: "senior_bopm" },
      { name: data.bopm, roleKey: "bopm" },
    ];
    for (const { name, roleKey } of seedRoles) {
      if (!name) continue;
      const person = people.find(p => norm(p.name) === norm(name));
      if (!person) continue;
      try {
        await addAssignment({ id: uid(), dealId: newId, roleKey, personId: person.id, allocationPct: 0 });
      } catch (e) {
        console.warn("Failed to seed staffing assignment", roleKey, e);
      }
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
    // BOPMs are view-only on Status — block silently with a toast.
    if (isBopmViewOnly) {
      toast.error("View only — Status can't be changed by BOPMs");
      return;
    }
    await supabase.from("staffing_deals").update({ deal_status: newStatus, deal_status_cx: newStatus } as any).eq("id", dealId);
    refreshStaffing();
  };

  const handleVSDChange = (dealId: string, personName: string) => {
    guardedUpdateDeal(dealId, { vsd: personName });
    // Find or create staffing assignment
    const person = people.find(p => p.name === personName);
    if (person) {
      const existing = assignments.find(a => a.dealId === dealId && normalizeRoleKey(a.roleKey) === "vsd");
      if (existing) {
        updateAssignment(existing.id, { personId: person.id });
      } else {
        addAssignment({ id: uid(), dealId, roleKey: "vsd", personId: person.id, allocationPct: 10 });
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
      const targetRoleKey = rt.includes("principal") ? "principal_bopm" : "senior_bopm";
      const existing = assignments.find(a => a.dealId === dealId && ["principal_bopm", "senior_bopm"].includes(normalizeRoleKey(a.roleKey)));
      if (existing) {
        updateAssignment(existing.id, { personId: person.id, roleKey: targetRoleKey });
      } else {
        addAssignment({ id: uid(), dealId, roleKey: targetRoleKey, personId: person.id, allocationPct: 10 });
      }
    }
    toast.success("BOPM updated");
  };

  const handleLeadChange = async (dealId: string, kind: "Content" | "SEO", personId: string) => {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    const existing = assignments.find(a => {
      if (a.dealId !== dealId) return false;
      const p = people.find(pp => pp.id === a.personId);
      return ((p?.roleCategory || "").toLowerCase() === kind.toLowerCase());
    });
    if (existing) {
      await updateAssignment(existing.id, { personId: person.id, roleKey: normalizeRoleKey(person.roleTitle || kind) });
    } else {
      await addAssignment({ id: uid(), dealId, roleKey: normalizeRoleKey(person.roleTitle || kind), personId: person.id, allocationPct: 10 });
    }
    toast.success(`${kind} lead updated`);
  };

  const handleClearBOPM = async (dealId: string) => {
    if (!isDealEditable(dealId)) {
      toast.error("View only — you can't edit this deal");
      return;
    }
    await guardedUpdateDeal(dealId, { principalBopm: "", seniorBopm: "", bopm: "" });
    const existing = assignments.filter(
      a => a.dealId === dealId && ["principal_bopm", "senior_bopm", "bopm"].includes(normalizeRoleKey(a.roleKey))
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

  const handleMRRSave = (dealId: string, value: string, ccy: "INR" | "USD" = currency) => {
    const entered = Number(value);
    const inInr = Number.isFinite(entered) && entered !== 0
      ? Math.round(convertToInr(entered, ccy, fxRate))
      : undefined;
    guardedUpdateDeal(dealId, { mrr: inInr });
    toast.success("MRR updated");
  };

  const handleTotalRevenueSave = (dealId: string, value: string, ccy: "INR" | "USD" = currency) => {
    const entered = Number(value);
    const inInr = Number.isFinite(entered) && entered !== 0
      ? Math.round(convertToInr(entered, ccy, fxRate))
      : undefined;
    guardedUpdateDeal(dealId, { totalDealValue: inInr });
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
        <div className="flex items-start gap-4 mb-3 flex-wrap">
          <h1 className="text-subhead font-bold tracking-tight text-foreground whitespace-nowrap mt-2">Clients & Deals</h1>
          <div className="flex flex-1 gap-2.5 flex-nowrap min-w-0 overflow-hidden">
          {([
            {
              key: "clients",
              label: "Clients", value: String(kpis.clients), Icon: Building2, tint: "sky",
              insight: kpis.newClientsThisQ > 0 ? `${kpis.newClientsThisQ} new this quarter` : "No new this quarter",
              tone: "muted" as const,
            },
            {
              key: "renewals",
              label: "Renewals < 90d", value: String(kpis.renewals90), Icon: Briefcase, tint: "violet",
              insight: kpis.nextRenewalLabel,
              tone: kpis.renewals90 > 0 ? "warning" as const : "muted" as const,
              onClick: () => setRenewalFilter(v => !v),
              active: renewalFilter,
            },
            {
              key: "active",
              label: "Active Deals", value: String(kpis.activeDeals), Icon: Activity, tint: "emerald",
              insight: kpis.atRisk > 0 ? `${kpis.atRisk} at risk` : "All on track",
              tone: kpis.atRisk > 0 ? "destructive" as const : "muted" as const,
            },
            {
              key: "mrr",
              label: "Total MRR", value: fmtCurrency(kpis.totalMRR), Icon: TrendingUp, tint: "amber",
              insight: `${kpis.activeDeals} active contributing`,
              tone: "muted" as const,
            },
            {
              key: "value",
              label: "Total Value", value: fmtCurrency(kpis.totalValue), Icon: ValueIcon, tint: "rose",
              insight: kpis.topDealLabel,
              tone: "muted" as const,
            },
          ] as any[])
            .filter((k) => isCentralCx || ["active", "renewals", "mrr", "value"].includes(k.key))
            .map(({ key, label, value, Icon, tint, insight, tone, onClick, active }: any) => {
            const tintMap: Record<string, { bg: string; ring: string; icon: string }> = {
              sky: { bg: "from-sky-500/10", ring: "border-sky-500/20", icon: "text-sky-500" },
              violet: { bg: "from-violet-500/10", ring: "border-violet-500/20", icon: "text-violet-500" },
              emerald: { bg: "from-emerald-500/10", ring: "border-emerald-500/20", icon: "text-emerald-500" },
              amber: { bg: "from-amber-500/10", ring: "border-amber-500/20", icon: "text-amber-500" },
              rose: { bg: "from-rose-500/10", ring: "border-rose-500/20", icon: "text-rose-500" },
            };
            const t = tintMap[tint];
            const toneClass =
              tone === "destructive" ? "text-destructive"
              : tone === "warning" ? "text-warning"
              : "text-muted-foreground";
            return (
              <button
                type="button"
                key={key || label}
                onClick={onClick}
                disabled={!onClick}
                aria-pressed={!!active}
                title={onClick ? (active ? "Click to clear renewals filter" : "Click to show only deals up for renewal") : undefined}
                className={cn(
                  "flex flex-1 min-w-0 flex-col px-3 py-2 rounded-xl border bg-gradient-to-br to-transparent text-left transition-colors",
                  t.bg, t.ring,
                  onClick && "cursor-pointer hover:border-foreground/30",
                  active && "ring-2 ring-violet-500/40 border-violet-500/40",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", t.icon)} />
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight truncate">{label}</p>
                  {active && <span className="ml-auto text-[9px] text-violet-500 font-medium">FILTERED</span>}
                </div>
                <p className="text-xl font-semibold tracking-tight text-foreground font-mono leading-tight truncate mt-1" title={value}>{value}</p>
                <p className={cn("text-[10px] mt-0.5 truncate", toneClass)} title={insight}>{insight}</p>
              </button>
            );
          })}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={exportCsv} title="Download filtered rows as CSV">
              <Download className="h-4 w-4 mr-1" /> Download CSV
            </Button>
            {isCentralCx && (
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

        {isCentralCx && (
          <div
            role="tablist"
            aria-label="Clients & Deals view"
            className="inline-flex items-center gap-1 mb-3 p-1 rounded-lg bg-secondary border border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "table"}
              onClick={() => setView("table")}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors",
                view === "table"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TableIcon className="h-4 w-4" /> Deals Table
              <span className={cn(
                "ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded text-[10px] font-medium",
                view === "table" ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground",
              )}>
                {filteredDeals.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "analytics"}
              onClick={() => setView("analytics")}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors",
                view === "analytics"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BarChart3 className="h-4 w-4" /> Analytics
            </button>
          </div>
        )}

        {view === "analytics" && (
          <ClientsAnalyticsTab
            deals={deals}
            onDrill={(f) => {
              if (f.vsd) setActiveVsd(f.vsd);
              if (f.bopm) setActiveBopm(f.bopm);
              if (f.bu || f.capability) setSearch(f.bu || f.capability || "");
              setView("table");
            }}
          />
        )}

        {view === "table" && (
        <>
        {/* Row 2: Filters + Search + Closed + Columns */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {(access.isAdmin || isCapLead) && (
            <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
              {VSD_FILTERS.map(v => (
                <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>{v.label}</button>
              ))}
            </div>
          )}

          {!isVsdViewer && (
            <BopmFilter
              value={activeBopm}
              onChange={setActiveBopm}
              scopedVsd={(access.isAdmin || isCapLead) && activeVsd !== "All" && activeVsd !== "Other" && activeVsd !== "Unassigned" ? activeVsd : undefined}
            />
          )}

          {isVsdViewer ? (
            <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5 overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveBopm("All")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  activeBopm === "All" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                All BOPMs
              </button>
              {myBopms.map((b) => (
                <button
                  key={nameKey(b)}
                  onClick={() => setActiveBopm(b)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                    activeBopm === b ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          ) : (
            <div className="relative flex-1 min-w-[280px] max-w-[480px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search clients, deals or deal ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-9 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer whitespace-nowrap" title="Show closed / completed deals">
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="rounded border-border" />
            Closed
          </label>

          <div className="flex items-center gap-1.5">
            <Select
              value={colFilters.dealType || "__all__"}
              onValueChange={v => v === "__all__" ? clearFilter("dealType") : setFilter("dealType", v)}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Types</SelectItem>
                {["Retainer","Non-Retainer","Pilot"].map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={colFilters.dealStatus || "__all__"}
              onValueChange={v => v === "__all__" ? clearFilter("dealStatus") : setFilter("dealStatus", v)}
            >
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {DEAL_STATUSES.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={colFilters.pepperBusinessUnit || "__all__"}
              onValueChange={v => v === "__all__" ? clearFilter("pepperBusinessUnit") : setFilter("pepperBusinessUnit", v)}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Pepper BU" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Pepper BUs</SelectItem>
                {PEPPER_BUSINESS_UNITS.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {Object.keys(colFilters).length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="h-8 text-xs gap-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Clear filters ({Object.keys(colFilters).length})
            </Button>
          )}

          {isCentralCx && (
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
                <button
                  onClick={resetColOrder}
                  className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-secondary text-muted-foreground"
                >
                  Reset column order
                </button>
              </div>
            </PopoverContent>
          </Popover>
          )}
        </div>

        {/* Flat Table with column filters */}
        <div className="bg-card border border-border rounded-xl relative">
          <div ref={tableScrollRef} className="overflow-auto overscroll-x-contain max-h-[calc(100vh-220px)] rounded-xl">
            <table className="text-ui table-fixed" style={{ width: "100%" }}>
              <thead className="sticky top-0 z-20">
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleColDragEnd}>
                  <SortableContext items={effectiveVisibleCols} strategy={horizontalListSortingStrategy}>
                    <tr className="bg-secondary border-b border-border group/headrow">
                      {(() => {
                        const headerByKey: Record<string, React.ReactNode> = {
                          account: <ColHeader key="account" sortableId="account" label="Client" sortKey="account" colKey="account" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.account} onResizeStart={startResize("account")} />,
                          dealName: <ColHeader key="dealName" sortableId="dealName" label="Deal Name" sortKey="dealName" colKey="dealName" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.dealName} onResizeStart={startResize("dealName")} />,
                          dealId: <ColHeader key="dealId" sortableId="dealId" label="Deal ID" sortKey="dealId" colKey="dealId" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.dealId} onResizeStart={startResize("dealId")} />,
                          pcCode: <ColHeader key="pcCode" sortableId="pcCode" label="PC Code" sortKey="pcCode" colKey="pcCode" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.pcCode} onResizeStart={startResize("pcCode")} />,
                          monthClosedWon: <ColHeader key="monthClosedWon" sortableId="monthClosedWon" label="Month of Closed Won" sortKey="monthClosedWon" colKey="monthClosedWon" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.monthClosedWon} onResizeStart={startResize("monthClosedWon")} />,
                          dealType: <ColHeader key="dealType" sortableId="dealType" label="Type" sortKey="dealType" colKey="dealType" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["Retainer","Non-Retainer","Pilot"]} width={colWidths.dealType} onResizeStart={startResize("dealType")} />,
                          dealStatus: <ColHeader key="dealStatus" sortableId="dealStatus" label="Status" sortKey="dealStatus" colKey="dealStatus" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={[...DEAL_STATUSES]} width={colWidths.dealStatus} onResizeStart={startResize("dealStatus")} />,
                          pepperBusinessUnit: <ColHeader key="pepperBusinessUnit" sortableId="pepperBusinessUnit" label="Pepper BU" sortKey="pepperBusinessUnit" colKey="pepperBusinessUnit" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={[...PEPPER_BUSINESS_UNITS]} width={colWidths.pepperBusinessUnit} onResizeStart={startResize("pepperBusinessUnit")} />,
                          capabilityLine: <ColHeader key="capabilityLine" sortableId="capabilityLine" label="Capability Line" sortKey="capabilityLine" colKey="capabilityLine" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={[...CAPABILITY_LINES]} width={colWidths.capabilityLine} onResizeStart={startResize("capabilityLine")} />,
                          vsd: <ColHeader key="vsd" sortableId="vsd" label="VSD" sortKey="vsd" colKey="vsd" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={peopleColOptions.vsd} width={colWidths.vsd} onResizeStart={startResize("vsd")} />,
                          bopm: <ColHeader key="bopm" sortableId="bopm" label="P.BOPM / Sr BOPM" colKey="bopm" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={peopleColOptions.bopm} width={colWidths.bopm} onResizeStart={startResize("bopm")} />,
                          bopmOnly: <ColHeader key="bopmOnly" sortableId="bopmOnly" label="BOPM" colKey="bopmOnly" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={peopleColOptions.bopmOnly} width={colWidths.bopmOnly} onResizeStart={startResize("bopmOnly")} />,
                          contentLead: <ColHeader key="contentLead" sortableId="contentLead" label="Content Lead" colKey="contentLead" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={peopleColOptions.content} width={colWidths.contentLead} onResizeStart={startResize("contentLead")} />,
                          seoLead: <ColHeader key="seoLead" sortableId="seoLead" label="SEO Lead" colKey="seoLead" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={peopleColOptions.seo} width={colWidths.seoLead} onResizeStart={startResize("seoLead")} />,
                          mrr: <ColHeader key="mrr" sortableId="mrr" label="MRR" align="right" sortKey="mrr" colKey="mrr" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" width={colWidths.mrr} onResizeStart={startResize("mrr")} />,
                          retainerDealValue: <ColHeader key="retainerDealValue" sortableId="retainerDealValue" label="Retainer Deal Value" align="right" sortKey="retainerDealValue" colKey="retainerDealValue" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" width={colWidths.retainerDealValue} onResizeStart={startResize("retainerDealValue")} />,
                          nonRetainerDealValue: <ColHeader key="nonRetainerDealValue" sortableId="nonRetainerDealValue" label="Non-Retainer Deal Value" align="right" sortKey="nonRetainerDealValue" colKey="nonRetainerDealValue" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" width={colWidths.nonRetainerDealValue} onResizeStart={startResize("nonRetainerDealValue")} />,
                          totalDealValue: <ColHeader key="totalDealValue" sortableId="totalDealValue" label="Total Revenue" align="right" sortKey="totalDealValue" colKey="totalDealValue" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" width={colWidths.totalDealValue} onResizeStart={startResize("totalDealValue")} />,
                          duration: <ColHeader key="duration" sortableId="duration" label="Duration" colKey="duration" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.duration} onResizeStart={startResize("duration")} />,
                          rag: <ColHeader key="rag" sortableId="rag" label="RGY" align="center" colKey="rag" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["green","amber","red","na","pending"]} width={colWidths.rag} onResizeStart={startResize("rag")} />,
                        };
                        return effectiveVisibleCols.filter(k => k in headerByKey).map(k => headerByKey[k]);
                      })()}
                      <th style={{ width: colWidths.actions, minWidth: colWidths.actions }}></th>
                    </tr>
                  </SortableContext>
                </DndContext>
              </thead>
              <tbody>
                {tableRows.map(deal => {
                  const clientObj =
                    (deal.clientId && allClients.find(c => c.id === deal.clientId)) ||
                    allClients.find(c => c.name === deal.account);
                  const leads = leadByDeal[deal.id] || {};
                  const dealCcy = dealDisplayCurrency(deal as any, currency);
                  const sym = CURRENCY_SYMBOL[dealCcy];
                  const mrrVal = deal.mrr ? Math.round(convertFromInr(Number(deal.mrr), dealCcy, fxRate)) : 0;
                  const retainerVal = deal.retainerDealValue ? Math.round(convertFromInr(Number(deal.retainerDealValue), dealCcy, fxRate)) : 0;
                  const nonRetainerVal = deal.nonRetainerDealValue ? Math.round(convertFromInr(Number(deal.nonRetainerDealValue), dealCcy, fxRate)) : 0;
                  const totalVal = deal.totalDealValue ? Math.round(convertFromInr(Number(deal.totalDealValue), dealCcy, fxRate)) : 0;
                  const cellByKey: Record<string, React.ReactNode> = {
                    account: (
                      <td key="account" className="py-2 px-3 truncate" title={deal.account}>
                        {isBopmViewOnly ? (
                          <span className="text-xs font-medium truncate block">{deal.account || "—"}</span>
                        ) : (
                        <InlineEditCell
                          value={deal.account || ""}
                          displayClassName="text-xs font-medium"
                          onSave={async (v) => {
                            const next = v.trim();
                            if (!next || next === deal.account) return;
                            if (clientObj) {
                              await updateClient(clientObj.id, { name: next });
                              await refreshClients();
                            } else {
                              await updateDeal(deal.id, { account: next } as any);
                            }
                            toast.success("Client name updated");
                          }}
                          placeholder="—"
                        />
                        )}
                      </td>
                    ),
                    dealName: (
                      <td key="dealName" className="py-2 px-3 truncate">
                        <Link to={`/deals/${deal.id}`} className="text-primary hover:underline text-xs font-medium truncate block" title={deal.dealName}>
                          {deal.dealName}
                        </Link>
                      </td>
                    ),
                    dealId: (
                      <td key="dealId" className="py-2 px-3 text-xs font-mono text-muted-foreground truncate">
                        {access.isAdmin ? (
                          <InlineEditCell
                            value={deal.dealId || ""}
                            onSave={(v) => { guardedUpdateDeal(deal.id, { dealId: v.trim() } as any); toast.success("Deal ID updated"); }}
                            placeholder="—"
                          />
                        ) : (
                          deal.dealId || "—"
                        )}
                      </td>
                    ),
                    pcCode: (
                      <td key="pcCode" className="py-2 px-3 text-xs font-mono text-muted-foreground truncate" title={deal.pcCode || ""}>
                        {deal.pcCode || <span className="text-muted-foreground">—</span>}
                      </td>
                    ),
                    monthClosedWon: (
                      <td key="monthClosedWon" className="py-2 px-3 text-xs text-foreground truncate" title={deal.monthClosedWon || ""}>
                        {deal.monthClosedWon || <span className="text-muted-foreground">—</span>}
                      </td>
                    ),
                    dealType: (
                      <td key="dealType" className="py-2 px-3">
                        {isBopmViewOnly ? (
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                              (deal.dealType === "Retainer") ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                            )}
                          >
                            {deal.dealType === "Retainer" ? "Retainer" : "Non-Retainer"}
                          </span>
                        ) : (
                          <Select
                            value={deal.dealType === "Retainer" ? "Retainer" : "Non-Retainer"}
                            onValueChange={async (v) => {
                              if (isBopm) {
                                await submitApprovalRequest({
                                  type: "deal.update",
                                  targetKind: "deal",
                                  targetId: deal.id,
                                  dealId: deal.id,
                                  payload: { deal_type: v },
                                  previous: { deal_type: deal.dealType },
                                } as any);
                                return;
                              }
                              guardedUpdateDeal(deal.id, { dealType: v as any });
                              toast.success("Type updated");
                            }}
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
                        )}
                      </td>
                    ),
                    dealStatus: (
                      <td key="dealStatus" className="py-2 px-3">
                        {isBopmViewOnly ? (
                          <span className="text-[11px] text-foreground px-1">{deal.dealStatus || "Active Deal"}</span>
                        ) : (
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
                        )}
                      </td>
                    ),
                    pepperBusinessUnit: (
                      <td key="pepperBusinessUnit" className="py-2 px-3 truncate" title={deal.pepperBusinessUnit || ""}>
                        {access.isAdmin ? (
                          <Select
                            value={deal.pepperBusinessUnit || undefined}
                            onValueChange={(v) => { guardedUpdateDeal(deal.id, { pepperBusinessUnit: v }); toast.success("Pepper BU updated"); }}
                          >
                            <SelectTrigger className="h-6 w-full text-[11px] border-none bg-transparent shadow-none px-1 focus:ring-0">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {PEPPER_BUSINESS_UNITS.map(s => (
                                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-foreground">
                            {deal.pepperBusinessUnit || <span className="text-muted-foreground">—</span>}
                          </span>
                        )}
                      </td>
                    ),
                    capabilityLine: (
                      <td key="capabilityLine" className="py-2 px-3 truncate" title={deal.capabilityLine || ""}>
                        {access.isAdmin ? (
                          <Select
                            value={deal.capabilityLine || undefined}
                            onValueChange={(v) => { guardedUpdateDeal(deal.id, { capabilityLine: v }); toast.success("Capability Line updated"); }}
                          >
                            <SelectTrigger className="h-6 w-full text-[11px] border-none bg-transparent shadow-none px-1 focus:ring-0">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {CAPABILITY_LINES.map(s => (
                                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-foreground">
                            {deal.capabilityLine || <span className="text-muted-foreground">—</span>}
                          </span>
                        )}
                      </td>
                    ),
                    vsd: (
                      <td key="vsd" className="py-2 px-3 truncate">
                        <button
                          onClick={() => setStaffingDialog({ open: true, dealId: deal.id, roleFilter: "Operations", preSelectedName: deal.vsd || undefined })}
                          className="text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate block text-left w-full"
                        >
                          {deal.vsd || <span className="text-muted-foreground">— None —</span>}
                        </button>
                      </td>
                    ),
                    bopm: (
                      <td key="bopm" className="py-2 px-3 truncate">
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
                    ),
                    bopmOnly: (
                      <td key="bopmOnly" className="py-2 px-3 truncate">
                        <button
                          onClick={() => setStaffingDialog({ open: true, dealId: deal.id, roleFilter: "Operations", preSelectedName: (deal as any).bopm || undefined })}
                          className="text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate block text-left w-full"
                          title={(deal as any).bopm || ""}
                        >
                          {(deal as any).bopm || <span className="text-muted-foreground">— None —</span>}
                        </button>
                      </td>
                    ),
                    contentLead: (
                      <td key="contentLead" className="py-2 px-3 truncate">
                        <div className="flex items-center gap-1 group/cell">
                          <button
                            onClick={() => setStaffingDialog({ open: true, dealId: deal.id, roleFilter: "Content", preSelectedName: leads.content || undefined })}
                            className="text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate block text-left flex-1 min-w-0"
                            title={leads.content || ""}
                          >
                            {leads.content || <span className="text-muted-foreground">— None —</span>}
                          </button>
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
                    ),
                    seoLead: (
                      <td key="seoLead" className="py-2 px-3 truncate">
                        <div className="flex items-center gap-1 group/cell">
                          <button
                            onClick={() => setStaffingDialog({ open: true, dealId: deal.id, roleFilter: "SEO", preSelectedName: leads.seo || undefined })}
                            className="text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate block text-left flex-1 min-w-0"
                            title={leads.seo || ""}
                          >
                            {leads.seo || <span className="text-muted-foreground">— None —</span>}
                          </button>
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
                    ),
                    mrr: (
                      <td key="mrr" className={cn("py-2 px-3 text-right", !isCentralCx && "bg-primary/5 font-medium")}>
                        {isBopmViewOnly ? (
                          <span className="text-xs text-foreground">
                            {deal.mrr ? `${sym}${mrrVal.toLocaleString()}` : "—"}
                          </span>
                        ) : (
                          <InlineEditCell value={deal.mrr ? String(mrrVal) : ""} onSave={v => handleMRRSave(deal.id, v, dealCcy)} type="number" prefix={sym} placeholder="—" />
                        )}
                      </td>
                    ),
                    retainerDealValue: (
                      <td key="retainerDealValue" className="py-2 px-3 text-right text-xs text-foreground">
                        {deal.retainerDealValue ? `${sym}${retainerVal.toLocaleString()}` : <span className="text-muted-foreground">—</span>}
                      </td>
                    ),
                    nonRetainerDealValue: (
                      <td key="nonRetainerDealValue" className="py-2 px-3 text-right text-xs text-foreground">
                        {deal.nonRetainerDealValue ? `${sym}${nonRetainerVal.toLocaleString()}` : <span className="text-muted-foreground">—</span>}
                      </td>
                    ),
                    totalDealValue: (
                      <td key="totalDealValue" className={cn("py-2 px-3 text-right", !isCentralCx && "bg-primary/5 font-medium")}>
                        {isBopmViewOnly ? (
                          <span className="text-xs text-foreground">
                            {deal.totalDealValue ? `${sym}${totalVal.toLocaleString()}` : "—"}
                          </span>
                        ) : (
                          <InlineEditCell value={deal.totalDealValue ? String(totalVal) : ""} onSave={v => handleTotalRevenueSave(deal.id, v, dealCcy)} type="number" prefix={sym} placeholder="—" />
                        )}
                      </td>
                    ),
                    duration: (
                      <td key="duration" className="py-2 px-3 text-xs text-muted-foreground truncate" title={`${deal.startDate || "—"} → ${deal.endDate || "—"}`}>
                        {isBopmViewOnly ? (
                          (() => {
                            const sd = deal.startDate ? new Date(deal.startDate) : null;
                            const ed = deal.endDate ? new Date(deal.endDate) : null;
                            if (sd && ed && !isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
                              const months = Math.max(0, Math.round((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
                              return <span className="text-foreground">{months} mo</span>;
                            }
                            if (ed && !isNaN(ed.getTime())) return <span>ends {ed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>;
                            return <span className="text-muted-foreground">—</span>;
                          })()
                        ) : (
                          <div className="flex items-center gap-1">
                            <InlineEditCell
                              value={deal.startDate ? String(deal.startDate).slice(0, 10) : ""}
                              onSave={v => { updateDeal(deal.id, { startDate: v || undefined } as any); toast.success("Updated"); }}
                              type="date"
                              placeholder="start"
                            />
                            <span className="text-muted-foreground">→</span>
                            <InlineEditCell
                              value={deal.endDate ? String(deal.endDate).slice(0, 10) : ""}
                              onSave={v => { updateDeal(deal.id, { endDate: v || undefined } as any); toast.success("Updated"); }}
                              type="date"
                              placeholder="end"
                            />
                          </div>
                        )}
                      </td>
                    ),
                    rag: (
                      <td key="rag" className="py-2 px-3 text-center"><RgyBlock letter={rgyRollup.get(deal.id)} /></td>
                    ),
                  };
                  return (
                    <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/10 transition-colors group/row">
                      {effectiveVisibleCols.filter(k => k in cellByKey).map(k => cellByKey[k])}
                      <td className="py-2 px-1">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="text-muted-foreground/60 hover:text-foreground transition-colors"
                                title="Contract & SoW documents"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72 p-3 space-y-3">
                              <DealDocsUpload dealId={deal.id} variant="contract" />
                              <div className="h-px bg-border" />
                              <DealDocsUpload dealId={deal.id} variant="sow" />
                            </PopoverContent>
                          </Popover>
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
          <ScrollToStartButton scrollRef={tableScrollRef} />

          {tableRows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No deals found matching your filters.</p>
            </div>
          )}
        </div>
        </>
        )}
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
          if (!canEditAll) {
            await submitApprovalRequest({
              type: "client.create",
              targetKind: "client",
              payload: client,
            });
            return;
          }
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
            const cat = (person.roleCategory || "").toLowerCase();
            const rt = (person.roleTitle || "").toLowerCase();
            if (cat === "content") {
              handleLeadChange(staffingDialog.dealId, "Content", person.id);
            } else if (cat === "seo") {
              handleLeadChange(staffingDialog.dealId, "SEO", person.id);
            } else if (rt.includes("vsd")) {
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
