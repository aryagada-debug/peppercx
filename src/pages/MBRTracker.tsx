import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ChevronDown, ChevronRight, ChevronsUpDown, Search, Loader2, Eye, CalendarDays, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useMBRData, type MBREntry, type MBRDeal, type VSDSummary } from "@/hooks/useMBRData";
import { MBRDetailDialog } from "@/components/mbr/MBRDetailDialog";
import { supabase } from "@/integrations/supabase/client";

const PODS = ["All", "Integrated", "India B2B", "US B2B", "FMCG", "BFSI", "Unassigned"] as const;
type Pod = typeof PODS[number];

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
  if (!v) return "—";
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString("en-IN")}`;
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

  const [activePod, setActivePod] = useState<Pod>("All");
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [viewDeal, setViewDeal] = useState<{ deal: MBRDeal; entry: MBREntry | null } | null>(null);
  const [viewMode, setViewMode] = useState<"current" | "mom">("current");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

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
    if (activePod !== "All") {
      d = d.filter(deal => {
        const meta = dealMeta.get(deal.id);
        const pod = meta?.pod || "Unassigned";
        return pod === activePod;
      });
    }
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(deal => deal.account.toLowerCase().includes(s) || deal.dealName.toLowerCase().includes(s));
    }
    return d;
  }, [deals, dealMeta, activePod, search, showClosed]);

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

  const toggleClient = (client: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(client)) next.delete(client); else next.add(client);
      return next;
    });
  };

  const expandAll = () => setExpandedClients(new Set(groupedDeals.map(g => g.client)));
  const collapseAll = () => setExpandedClients(new Set());

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
      const v = deal.vsd || "Unknown";
      if (!vsdMap.has(v)) vsdMap.set(v, { vsd: v, total: 0, done: 0, notDone: 0, pending: 0, green: 0, yellow: 0, red: 0, scheduled: 0 });
      const s = vsdMap.get(v)!;
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
    return Array.from(vsdMap.values()).sort((a, b) => b.total - a.total);
  }, [filteredDeals, activeEntryMap]);

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
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">MBR Tracker</h1>
            <p className="text-ui text-muted-foreground mt-0.5">
              {kpis.retainerAccounts} retainer accounts • {viewMode === "current" ? (selectedMonth ? formatMonthLabel(selectedMonth) : "Latest") : "Month-on-Month"}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button variant="ghost" size="sm" onClick={() => expandedClients.size === groupedDeals.length ? collapseAll() : expandAll()} className="text-xs gap-1 text-muted-foreground">
              <ChevronsUpDown className="h-3.5 w-3.5" />
              {expandedClients.size === groupedDeals.length ? "Collapse All" : "Expand All"}
            </Button>
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
                      <th className="w-8 py-2 px-3"></th>
                      <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Deal Name</th>
                      <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">VSD</th>
                      <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sr. BOPM</th>
                      <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">MRR</th>
                      <th className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                      <th className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sentiment</th>
                      <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Scheduled</th>
                      <th className="text-center py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Anirudh</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedDeals.map(({ client, deals: clientDeals }) => {
                      const isExpanded = expandedClients.has(client);
                      const clientDone = clientDeals.filter(d => activeEntryMap.get(d.id)?.status === "Done").length;
                      const clientNotDone = clientDeals.filter(d => activeEntryMap.get(d.id)?.status === "Not Done").length;

                      return (
                        <React.Fragment key={client}>
                          <tr
                            className="border-b border-border bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-colors"
                            onClick={() => toggleClient(client)}
                          >
                            <td className="py-2 px-3">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </td>
                            <td className="py-2 px-3" colSpan={4}>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">{client}</span>
                                <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                  {clientDeals.length} deal{clientDeals.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </td>
                            <td colSpan={5} className="py-2 px-3">
                              <div className="flex items-center gap-3 justify-end">
                                {clientDone > 0 && <span className="text-[10px] font-medium text-positive">{clientDone} Done</span>}
                                {clientNotDone > 0 && <span className="text-[10px] font-medium text-destructive">{clientNotDone} Not Done</span>}
                                {clientDone === 0 && clientNotDone === 0 && <span className="text-[10px] text-muted-foreground">Pending</span>}
                              </div>
                            </td>
                          </tr>

                          {isExpanded && clientDeals.map(deal => {
                            const entry = activeEntryMap.get(deal.id);
                            const status = entry?.status || "Pending";
                            return (
                              <tr
                                key={deal.id}
                                className="border-b border-border/50 hover:bg-accent/10 transition-colors cursor-pointer group"
                                onClick={() => handleRowClick(deal, entry)}
                              >
                                <td className="py-2 px-3"></td>
                                <td className="py-2 px-3 pl-6">
                                  <span className="text-primary text-xs font-medium">{deal.dealName}</span>
                                </td>
                                <td className="py-2 px-3 text-xs text-foreground whitespace-nowrap">{deal.vsd}</td>
                                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{deal.seniorBopm}</td>
                                <td className="py-2 px-3 text-xs font-mono tabular-nums text-foreground">{formatCurrency(deal.mrr)}</td>
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
                                <td className="py-2 px-3">
                                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
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

            {/* VSD Insights Table */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">VSD Insights</h2>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-ui">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border">
                      {["VSD", "Accounts", "Done", "Not Done", "Pending", "🟢", "🟡", "🔴", "Scheduled"].map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vsdInsights.map(v => {
                      const schedCompliance = v.total > 0 ? `${v.scheduled}/${v.total}` : "—";
                      return (
                        <tr key={v.vsd} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-foreground text-xs">{v.vsd}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-foreground text-xs">{v.total}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-positive font-semibold text-xs">{v.done}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-destructive font-semibold text-xs">{v.notDone}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-warning font-semibold text-xs">{v.pending}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-positive text-xs">{v.green}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-warning text-xs">{v.yellow}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-destructive text-xs">{v.red}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-foreground text-xs">{schedCompliance}</td>
                        </tr>
                      );
                    })}
                    {vsdInsights.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                            <td key={m} className="text-center py-2 px-2">
                              <span className={cn(
                                "text-[10px] font-semibold",
                                pct >= 80 ? "text-positive" : pct >= 50 ? "text-warning" : "text-destructive"
                              )}>
                                {pct}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      {/* Deal rows */}
                      {clientDeals.map(deal => (
                        <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/10 transition-colors">
                          <td className="py-1.5 px-3 pl-6 sticky left-0 bg-card z-10">
                            <span className="text-primary text-xs font-medium truncate block max-w-[180px]" title={deal.dealName}>
                              {deal.dealName}
                            </span>
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
    </AppLayout>
  );
}
