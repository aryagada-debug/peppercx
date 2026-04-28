import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { formatINR } from "@/lib/csvTargets";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Search, Loader2, Eye, CalendarDays, List, X, Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useMBRData, type MBREntry, type MBRDeal, type VSDSummary } from "@/hooks/useMBRData";
import { MBRDetailDialog } from "@/components/mbr/MBRDetailDialog";
import { ScheduleOnlyDialog } from "@/components/mbr/ScheduleOnlyDialog";
import { supabase } from "@/integrations/supabase/client";
import { ColHeader } from "@/components/table/ColHeader";
import { CalendarConnectButton } from "@/components/calendar/CalendarConnectButton";
import { useAppUsers, useVsdUsers } from "@/hooks/useAppUsers";

type VsdFilterKey = string;
const UNASSIGNED_VSD_VALUES = new Set(["", "Not Assigned", "Unassigned", "Not Applicable", "To Be Assigned", "Yet to be assigned"]);

const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

const sentimentDot = (s: string | null) => {
  if (!s) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = { Green: "bg-positive", Yellow: "bg-warning", Red: "bg-destructive" };
  return <span className={cn("w-3 h-3 rounded-full inline-block", colors[s] || "bg-muted")} title={s} />;
};

const formatCurrency = (v: number | null) => {
  return formatINR(Number(v) || 0);
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "w-3 h-3 rounded-full inline-block",
        status === "Done" && "bg-positive",
        status === "Not Done" && "bg-destructive",
        status === "Pending" && "bg-warning",
        status === "Not Required" && "bg-muted",
      )}
      title={status}
    />
  );
}

interface MBRDealWithPod extends MBRDeal {
  pod: string;
  dealStatus: string;
}

export default function MBRTracker() {
  const { deals, entries, loading, upsertEntry, vsdSummary, totals, entriesByMonth, availableMonths, refresh } = useMBRData();
  const { users: appUsers, isRegisteredName } = useAppUsers();
  const { vsdUsers, isVsdName, canonVsd } = useVsdUsers();
  const VSD_FILTERS = useMemo(() => {
    const items: { key: string; label: string }[] = [{ key: "All", label: "All" }];
    vsdUsers.forEach((u) => items.push({ key: u.displayName, label: u.displayName }));
    items.push({ key: "Other", label: "Other" });
    items.push({ key: "Unassigned", label: "Unassigned" });
    return items;
  }, [vsdUsers]);

  const [activeVsd, setActiveVsd] = useState<VsdFilterKey>("All");
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [viewDeal, setViewDeal] = useState<{ deal: MBRDeal; entry: MBREntry | null } | null>(null);
  const [scheduleDeal, setScheduleDeal] = useState<{ deal: MBRDeal; entry: MBREntry | null } | null>(null);
  const [viewMode, setViewMode] = useState<"current" | "mom">("current");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  // Drill-down for VSD/BOPM Insights numeric cells
  type DrillMetric = "total" | "done" | "notDone" | "pending" | "green" | "yellow" | "red" | "scheduled";
  const [drill, setDrill] = useState<{ rowKey: string; rowLabel: string; metric: DrillMetric } | null>(null);
  // Column filter/sort state
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const setFilter = (k: string, v: string) => setColFilters(p => ({ ...p, [k]: v }));
  const clearFilter = (k: string) => setColFilters(p => { const n = { ...p }; delete n[k]; return n; });
  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  // Column widths (resizable)
  const DEFAULT_WIDTHS: Record<string, number> = {
    account: 160, dealName: 200, vsd: 140, seniorBopm: 150, mrr: 110,
    status: 110, sentiment: 110, scheduledDate: 130,
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem("mbr-col-widths");
      if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_WIDTHS;
  });
  useEffect(() => {
    try { localStorage.setItem("mbr-col-widths", JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);
  const resizingRef = useRef<{ key: string; startX: number; startW: number; latest: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const startResize = useCallback((key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = colWidths[key] || 120;
    resizingRef.current = { key, startX: e.clientX, startW, latest: startW };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      r.latest = Math.max(60, Math.min(500, r.startW + (ev.clientX - r.startX)));
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const cur = resizingRef.current;
          if (!cur) return;
          setColWidths(prev => (prev[cur.key] === cur.latest ? prev : { ...prev, [cur.key]: cur.latest }));
        });
      }
    };
    const onUp = () => {
      resizingRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]);

  // Set default selected month to the latest available
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths, selectedMonth]);

  // Fetch pod/status info from staffing_deals
  const [dealMeta, setDealMeta] = useState<Map<string, { pod: string; dealStatus: string }>>(new Map());

  useEffect(() => {
    if (deals.length === 0) return;
    const ids = deals.map(d => d.id);
    supabase
      .from("staffing_deals")
      .select("id, pod, deal_status, vsd")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const m = new Map<string, { pod: string; dealStatus: string }>();
        for (const row of data) {
          m.set(row.id, {
            pod: getPodForDeal(row.vsd || "", row.pod || ""),
            dealStatus: row.deal_status || "",
          });
        }
        setDealMeta(m);
      });
  }, [deals]);

  const entryMap = useMemo(() => new Map(entries.map(e => [e.dealId, e])), [entries]);

  // For current view with month selector: get entries for selected month
  const monthEntryMap = useMemo(() => {
    if (!selectedMonth) return entryMap;
    const monthData = entriesByMonth.get(selectedMonth);
    return monthData || new Map<string, MBREntry>();
  }, [selectedMonth, entriesByMonth, entryMap]);

  // Use monthEntryMap for current view instead of entryMap
  const activeEntryMap = viewMode === "current" ? monthEntryMap : entryMap;

  // Filter deals
  const filteredDeals = useMemo(() => {
    let d = deals;
    if (!showClosed) {
      d = d.filter(deal => {
        const meta = dealMeta.get(deal.id);
        return meta ? ACTIVE_STATUSES.has(meta.dealStatus) : true;
      });
    }
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
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(deal => deal.account.toLowerCase().includes(s) || deal.dealName.toLowerCase().includes(s));
    }
    return d;
  }, [deals, dealMeta, activeVsd, search, showClosed]);

  // Group by client
  const groupedDeals = useMemo(() => {
    const map = new Map<string, MBRDeal[]>();
    filteredDeals.forEach(deal => {
      const existing = map.get(deal.account) || [];
      map.set(deal.account, [...existing, deal]);
    });
    return Array.from(map.entries())
      .map(([client, deals]) => ({ client, deals }))
      .sort((a, b) => a.client.localeCompare(b.client));
  }, [filteredDeals]);

  // Apply per-column filters + sort to produce flat row list (current view)
  const tableRows = useMemo(() => {
    const matches = (val: any, q: string) => String(val ?? "").toLowerCase().includes(q.toLowerCase());
    let rows = filteredDeals.map(d => ({ deal: d, entry: activeEntryMap.get(d.id) || null }));
    rows = rows.filter(({ deal, entry }) => {
      if (colFilters.account && !matches(deal.account, colFilters.account)) return false;
      if (colFilters.dealName && !matches(deal.dealName, colFilters.dealName)) return false;
      if (colFilters.vsd && !matches(deal.vsd, colFilters.vsd)) return false;
      if (colFilters.seniorBopm && !matches(deal.seniorBopm, colFilters.seniorBopm)) return false;
      if (colFilters.mrr && (Number(deal.mrr) || 0) < Number(colFilters.mrr)) return false;
      if (colFilters.status && (entry?.status || "Pending") !== colFilters.status) return false;
      if (colFilters.sentiment && (entry?.sentiment || "") !== colFilters.sentiment) return false;
      if (colFilters.scheduledDate && !matches(entry?.scheduledDate, colFilters.scheduledDate)) return false;
      return true;
    });
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = (a.deal as any)[sortKey] ?? (a.entry as any)?.[sortKey] ?? "";
        const bv = (b.deal as any)[sortKey] ?? (b.entry as any)?.[sortKey] ?? "";
        if (typeof av === "number" || typeof bv === "number") return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    } else {
      rows = [...rows].sort((a, b) => a.deal.account.localeCompare(b.deal.account) || a.deal.dealName.localeCompare(b.deal.dealName));
    }
    return rows;
  }, [filteredDeals, activeEntryMap, colFilters, sortKey, sortDir]);

  // KPIs from filtered deals (use activeEntryMap for current view)
  const kpis = useMemo(() => {
    const filteredIds = new Set(filteredDeals.map(d => d.id));
    const relevantEntries = Array.from(activeEntryMap.values()).filter(e => filteredIds.has(e.dealId));
    const done = relevantEntries.filter(e => e.status === "Done").length;
    const notDone = relevantEntries.filter(e => e.status === "Not Done").length;
    const notRequired = relevantEntries.filter(e => e.status === "Not Required").length;
    const pending = filteredDeals.length - done - notDone - notRequired;
    const compliance = filteredDeals.length > 0 ? Math.round((done / filteredDeals.length) * 100) : 0;
    return { retainerAccounts: filteredDeals.length, done, notDone, pending, compliance };
  }, [filteredDeals, activeEntryMap]);

  const handleSave = async (params: any) => {
    await upsertEntry(params);
    await refresh();
  };

  const handleRowClick = (deal: MBRDeal, entry?: MBREntry | null) => {
    setViewDeal({ deal, entry: entry || null });
  };

  // VSD insights from filtered deals
  const vsdInsights = useMemo(() => {
    const vsdMap = new Map<string, { vsd: string; total: number; done: number; notDone: number; pending: number; green: number; yellow: number; red: number; scheduled: number }>();
    for (const deal of filteredDeals) {
      const raw = (deal.vsd || "").trim();
      let bucket: string;
      if (!raw || UNASSIGNED_VSD_VALUES.has(raw)) bucket = "Unassigned";
      else if (isVsdName(raw)) bucket = canonVsd(raw) || "Other";
      else bucket = "Other";
      if (!vsdMap.has(bucket)) vsdMap.set(bucket, { vsd: bucket, total: 0, done: 0, notDone: 0, pending: 0, green: 0, yellow: 0, red: 0, scheduled: 0 });
      const s = vsdMap.get(bucket)!;
      s.total++;
      const entry = activeEntryMap.get(deal.id);
      if (entry) {
        if (entry.status === "Done") s.done++;
        else if (entry.status === "Not Done") s.notDone++;
        if (entry.sentiment === "Green") s.green++;
        else if (entry.sentiment === "Yellow") s.yellow++;
        else if (entry.sentiment === "Red") s.red++;
        if (entry.scheduledDate) s.scheduled++;
      }
    }
    for (const s of vsdMap.values()) {
      s.pending = s.total - s.done - s.notDone;
    }
    return Array.from(vsdMap.values()).filter(s => s.total > 0).sort((a, b) => b.total - a.total);
  }, [filteredDeals, activeEntryMap, isVsdName, canonVsd]);

  // BOPM insights (Sr / Principal) — used when a specific VSD is selected.
  // Only includes BOPMs mapped to ≥1 active deal in the current scope.
  const bopmInsights = useMemo(() => {
    type Row = { name: string; total: number; done: number; notDone: number; pending: number; green: number; yellow: number; red: number; scheduled: number };
    const map = new Map<string, Row>();
    const overall: Row = { name: "Pod Overall", total: 0, done: 0, notDone: 0, pending: 0, green: 0, yellow: 0, red: 0, scheduled: 0 };
    for (const deal of filteredDeals) {
      const raw = (deal.principalBopm || deal.seniorBopm || "").trim();
      if (!raw) continue;
      const bucket = isRegisteredName(raw) ? raw : "Other";
      if (!map.has(bucket)) map.set(bucket, { name: bucket, total: 0, done: 0, notDone: 0, pending: 0, green: 0, yellow: 0, red: 0, scheduled: 0 });
      const s = map.get(bucket)!;
      const tally = (r: Row) => {
        r.total++;
        const entry = activeEntryMap.get(deal.id);
        if (entry) {
          if (entry.status === "Done") r.done++;
          else if (entry.status === "Not Done") r.notDone++;
          if (entry.sentiment === "Green") r.green++;
          else if (entry.sentiment === "Yellow") r.yellow++;
          else if (entry.sentiment === "Red") r.red++;
          if (entry.scheduledDate) r.scheduled++;
        }
      };
      tally(s);
      tally(overall);
    }
    for (const s of map.values()) s.pending = s.total - s.done - s.notDone;
    overall.pending = overall.total - overall.done - overall.notDone;
    const rows = Array.from(map.values()).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
    return overall.total > 0 ? [overall, ...rows] : rows;
  }, [filteredDeals, activeEntryMap, isRegisteredName]);

  const showBopmInsights = activeVsd !== "All" && activeVsd !== "Other" && activeVsd !== "Unassigned";

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-3 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">MBR Tracker</h1>
            <p className="text-ui text-muted-foreground mt-0.5">
              {kpis.retainerAccounts} retainer accounts • {viewMode === "current" ? (selectedMonth ? formatMonthLabel(selectedMonth) : "Latest") : "Month-on-Month"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarConnectButton />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const t = toast.loading("Sending MBR reminders…");
                const { data, error } = await supabase.functions.invoke("mbr-reminders", { body: {} });
                toast.dismiss(t);
                if (error) {
                  toast.error(error.message || "Failed to run reminders");
                  return;
                }
                const sent = data?.sent?.length || 0;
                const skipped = data?.skipped?.length || 0;
                const errs = data?.errors?.length || 0;
                toast.success(`Reminders run: ${sent} sent, ${skipped} skipped, ${errs} errors`);
              }}
              className="h-8 gap-1.5"
            >
              <Bell className="h-3.5 w-3.5" />
              Run reminders
            </Button>
            <div className="flex gap-1 bg-secondary rounded-lg p-1">
              <button
                onClick={() => setViewMode("current")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors",
                  viewMode === "current" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-3.5 w-3.5" />
                Current
              </button>
              <button
                onClick={() => setViewMode("mom")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors",
                  viewMode === "mom" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Month-on-Month
              </button>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <MetricCard label="Retainer Accounts" value={String(kpis.retainerAccounts)} />
          <MetricCard label="Done" value={String(kpis.done)} />
          <MetricCard label="Not Done" value={String(kpis.notDone)} />
          <MetricCard label="Pending" value={String(kpis.pending)} />
          <MetricCard label="Compliance" value={`${kpis.compliance}%`} />
        </div>

        {/* VSD Insights — moved to top */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">
            {showBopmInsights ? `BOPM Insights — ${activeVsd}` : "VSD Insights"}
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-ui">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  {[showBopmInsights ? "Sr / Principal BOPM" : "VSD", "Accounts", "Done", "Not Done", "Pending", "🟢", "🟡", "🔴", "Scheduled"].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showBopmInsights ? bopmInsights.map(b => ({ vsd: b.name, ...b })) : vsdInsights).map(v => {
                  const schedCompliance = v.total > 0 ? `${v.scheduled}/${v.total}` : "—";
                  const isOverall = v.vsd === "Pod Overall";
                  const rowLabel = v.vsd;
                  const openDrill = (metric: DrillMetric) => setDrill({ rowKey: rowLabel, rowLabel, metric });
                  const NumBtn = ({ value, metric, className }: { value: number; metric: DrillMetric; className?: string }) => (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (value > 0) openDrill(metric); }}
                      className={cn(
                        "font-mono tabular-nums text-xs",
                        value > 0 ? "hover:underline cursor-pointer" : "cursor-default opacity-70",
                        className,
                      )}
                    >
                      {value}
                    </button>
                  );
                  return (
                    <tr key={v.vsd} className={cn(
                      "border-b border-border/50 hover:bg-secondary/30 transition-colors",
                      isOverall && "bg-primary/5 font-semibold"
                    )}>
                      <td className="py-2.5 px-3 font-semibold text-foreground text-xs">{v.vsd}</td>
                      <td className="py-2.5 px-3"><NumBtn value={v.total} metric="total" className="text-foreground" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={v.done} metric="done" className="text-positive font-semibold" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={v.notDone} metric="notDone" className="text-destructive font-semibold" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={v.pending} metric="pending" className="text-warning font-semibold" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={v.green} metric="green" className="text-positive" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={v.yellow} metric="yellow" className="text-warning" /></td>
                      <td className="py-2.5 px-3"><NumBtn value={v.red} metric="red" className="text-destructive" /></td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (v.scheduled > 0) openDrill("scheduled"); }}
                          className={cn("font-mono tabular-nums text-foreground text-xs", v.scheduled > 0 ? "hover:underline cursor-pointer" : "cursor-default opacity-70")}
                        >
                          {schedCompliance}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {((showBopmInsights ? bopmInsights : vsdInsights).length === 0) && (
                  <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
            {VSD_FILTERS.map(v => (
              <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{v.label}</button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search clients or deals..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" />
          </div>

          {viewMode === "current" && availableMonths.length > 0 && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m} className="text-xs">{formatMonthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <label className="flex items-center gap-2 text-ui text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="rounded border-border" />
            Show closed/completed
          </label>

          {viewMode === "current" && (
            Object.keys(colFilters).length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setColFilters({})} className="text-xs gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Clear filters ({Object.keys(colFilters).length})
              </Button>
            )
          )}
        </div>

        {/* ========== CURRENT VIEW ========== */}
        {viewMode === "current" && (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border">
                      <ColHeader label="Client" colKey="account" sortKey="account" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.account} onResizeStart={startResize("account")} />
                      <ColHeader label="Deal Name" colKey="dealName" sortKey="dealName" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.dealName} onResizeStart={startResize("dealName")} />
                      <ColHeader label="VSD" colKey="vsd" sortKey="vsd" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.vsd} onResizeStart={startResize("vsd")} />
                      <ColHeader label="Sr. BOPM" colKey="seniorBopm" sortKey="seniorBopm" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} width={colWidths.seniorBopm} onResizeStart={startResize("seniorBopm")} />
                      <ColHeader label="MRR" colKey="mrr" sortKey="mrr" align="right" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} numeric placeholder="≥ amount" width={colWidths.mrr} onResizeStart={startResize("mrr")} />
                      <ColHeader label="Status" colKey="status" align="center" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["Done","Not Done","Pending","Not Required"]} width={colWidths.status} onResizeStart={startResize("status")} />
                      <ColHeader label="Sentiment" colKey="sentiment" align="center" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} options={["Green","Yellow","Red"]} width={colWidths.sentiment} onResizeStart={startResize("sentiment")} />
                      <ColHeader label="Scheduled" colKey="scheduledDate" sortState={{sortKey, sortDir}} onSort={toggleSort} colFilters={colFilters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilter={setFilter} clearFilter={clearFilter} placeholder="YYYY-MM-DD" width={colWidths.scheduledDate} onResizeStart={startResize("scheduledDate")} />
                      <th className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Anirudh</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(({ deal, entry }) => {
                      const status = entry?.status || "Pending";
                      return (
                        <tr
                                key={deal.id}
                                className="border-b border-border/50 hover:bg-accent/10 transition-colors cursor-pointer group"
                                onClick={() => handleRowClick(deal, entry)}
                              >
                                <td className="py-2 px-3">
                                  <span className="text-xs font-medium text-foreground truncate max-w-[140px] block" title={deal.account}>{deal.account}</span>
                                </td>
                                <td className="py-2 px-3">
                                  <Link to={`/deals/${deal.id}?tab=MBR`} className="text-primary hover:underline text-xs font-medium">{deal.dealName}</Link>
                                </td>
                                <td className="py-2 px-3 text-xs text-foreground whitespace-nowrap">{deal.vsd}</td>
                                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{deal.seniorBopm}</td>
                                <td className="py-2 px-3 text-xs font-mono tabular-nums text-foreground text-right">{formatCurrency(deal.mrr)}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={cn(
                                    "text-[10px] font-semibold rounded px-2 py-1 inline-block",
                                    status === "Done" && "bg-positive/15 text-positive",
                                    status === "Not Done" && "bg-destructive/15 text-destructive",
                                    status === "Not Required" && "bg-muted text-muted-foreground",
                                    status === "Pending" && "bg-warning/15 text-warning",
                                  )}>{status}</span>
                                </td>
                                <td className="py-2 px-3 text-center">{sentimentDot(entry?.sentiment ?? null)}</td>
                                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{entry?.scheduledDate || "—"}</td>
                                <td className="py-2 px-3 text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    {entry?.anirudhAdded ? <span className="text-positive font-bold text-[10px]">A</span> : null}
                                    {entry?.anirudhJoining ? <span className="text-positive font-bold text-[10px]">J</span> : null}
                                    {!entry?.anirudhAdded && !entry?.anirudhJoining && <span className="text-muted-foreground text-xs">—</span>}
                                  </div>
                                </td>
                                <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] gap-1"
                                      onClick={() => setScheduleDeal({ deal, entry: entry || null })}
                                      title="Schedule only"
                                    >
                                      <CalendarDays className="h-3 w-3" />
                                      Schedule
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] gap-1"
                                      onClick={() => handleRowClick(deal, entry)}
                                      title="Record MBR"
                                    >
                                      <Eye className="h-3 w-3" />
                                      Record
                                    </Button>
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
          </>
        )}

        {/* ========== MONTH-ON-MONTH VIEW ========== */}
        {viewMode === "mom" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-ui">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium sticky left-0 bg-secondary/40 z-10 min-w-[200px]">Client / Deal</th>
                    {availableMonths.map(m => (
                      <th key={m} className="text-center py-2 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-w-[70px]">
                        {formatMonthLabel(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedDeals.map(({ client, deals: clientDeals }) => (
                    <React.Fragment key={client}>
                      {/* Client header row */}
                      <tr className="border-b border-border bg-secondary/20">
                        <td className="py-2 px-3 sticky left-0 bg-secondary/20 z-10">
                          <span className="text-xs font-semibold text-foreground">{client}</span>
                          <span className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                            {clientDeals.length}
                          </span>
                        </td>
                        {availableMonths.map(m => {
                          const monthData = entriesByMonth.get(m);
                          const doneCount = clientDeals.filter(d => monthData?.get(d.id)?.status === "Done").length;
                          const pct = clientDeals.length > 0 ? Math.round((doneCount / clientDeals.length) * 100) : 0;
                          return (
                            <td key={m} className="text-center py-2 px-2" title={`${doneCount}/${clientDeals.length} done (${pct}%)`} />
                          );
                        })}
                      </tr>
                      {/* Deal rows */}
                      {clientDeals.map(deal => (
                        <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/10 transition-colors">
                          <td className="py-1.5 px-3 pl-6 sticky left-0 bg-card z-10">
                            <Link to={`/deals/${deal.id}?tab=MBR`} className="text-primary hover:underline text-xs font-medium truncate block max-w-[180px]" title={deal.dealName}>
                              {deal.dealName}
                            </Link>
                          </td>
                          {availableMonths.map(m => {
                            const monthData = entriesByMonth.get(m);
                            const entry = monthData?.get(deal.id);
                            const status = entry?.status || "Pending";
                            return (
                              <td
                                key={m}
                                className="text-center py-1.5 px-2 cursor-pointer hover:bg-accent/20 transition-colors"
                                onClick={() => handleRowClick(deal, entry || null)}
                                title={`${deal.dealName} — ${formatMonthLabel(m)}: ${status}`}
                              >
                                <StatusDot status={status} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {groupedDeals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No deals found matching your filters.</p>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-secondary/20">
              <span className="text-[10px] text-muted-foreground font-medium">Legend:</span>
              <div className="flex items-center gap-1.5"><StatusDot status="Done" /><span className="text-[10px] text-muted-foreground">Done</span></div>
              <div className="flex items-center gap-1.5"><StatusDot status="Not Done" /><span className="text-[10px] text-muted-foreground">Not Done</span></div>
              <div className="flex items-center gap-1.5"><StatusDot status="Pending" /><span className="text-[10px] text-muted-foreground">Pending</span></div>
              <div className="flex items-center gap-1.5"><StatusDot status="Not Required" /><span className="text-[10px] text-muted-foreground">Not Required</span></div>
            </div>
          </div>
        )}
      </div>

      {/* MBR Detail Dialog */}
      {viewDeal && (
        <MBRDetailDialog
          open={!!viewDeal}
          onClose={() => setViewDeal(null)}
          deal={viewDeal.deal}
          entry={viewDeal.entry}
          onSave={handleSave}
        />
      )}

      {/* Schedule-only Dialog */}
      {scheduleDeal && (
        <ScheduleOnlyDialog
          open={!!scheduleDeal}
          onClose={() => setScheduleDeal(null)}
          deal={scheduleDeal.deal}
          entry={scheduleDeal.entry}
          onSave={handleSave}
        />
      )}

      {/* Insights Drill-down Dialog */}
      {drill && (() => {
        // Build the candidate deal set for this row
        let scoped = filteredDeals;
        if (showBopmInsights) {
          if (drill.rowLabel !== "Pod Overall") {
            scoped = filteredDeals.filter(d => ((d.principalBopm || d.seniorBopm || "").trim()) === drill.rowLabel);
          } else {
            scoped = filteredDeals.filter(d => ((d.principalBopm || d.seniorBopm || "").trim()) !== "");
          }
        } else {
          scoped = filteredDeals.filter(d => (d.vsd || "Unknown") === drill.rowLabel);
        }
        const matchMetric = (deal: MBRDeal) => {
          const e = activeEntryMap.get(deal.id);
          switch (drill.metric) {
            case "total": return true;
            case "done": return e?.status === "Done";
            case "notDone": return e?.status === "Not Done";
            case "pending": return !e || (e.status !== "Done" && e.status !== "Not Done");
            case "green": return e?.sentiment === "Green";
            case "yellow": return e?.sentiment === "Yellow";
            case "red": return e?.sentiment === "Red";
            case "scheduled": return !!e?.scheduledDate;
          }
        };
        const rows = scoped.filter(matchMetric);
        const metricLabel: Record<DrillMetric, string> = {
          total: "Accounts", done: "Done", notDone: "Not Done", pending: "Pending",
          green: "Green sentiment", yellow: "Yellow sentiment", red: "Red sentiment", scheduled: "Scheduled",
        };
        return (
          <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base">
                  {drill.rowLabel} — {metricLabel[drill.metric]} ({rows.length})
                </DialogTitle>
              </DialogHeader>
              <div className="border border-border rounded-lg overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 border-b border-border">
                    <tr>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Account</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deal ID</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deal Name</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(d => {
                      const meta = dealMeta.get(d.id);
                      return (
                        <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="py-2 px-3 text-foreground">{d.account}</td>
                          <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground">{d.dealId || "—"}</td>
                          <td className="py-2 px-3">
                            <Link to={`/deals/${d.id}`} className="text-primary hover:underline" onClick={() => setDrill(null)}>
                              {d.dealName}
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{meta?.dealStatus || "—"}</td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No matching deals.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </AppLayout>
  );
}
