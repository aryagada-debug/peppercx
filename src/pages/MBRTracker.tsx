import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { formatINR } from "@/lib/csvTargets";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Search, Loader2, Eye, CalendarDays, List, X, Bell, Users, CheckCircle2, XCircle, Clock, Gauge, TrendingUp, Flag, AlertTriangle, Sparkles } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useMBRData, isRetainerDeal, type MBREntry, type MBRDeal, type VSDSummary } from "@/hooks/useMBRData";
import { MBRDetailDialog } from "@/components/mbr/MBRDetailDialog";
import { ScheduleOnlyDialog } from "@/components/mbr/ScheduleOnlyDialog";
import { supabase } from "@/integrations/supabase/client";
import { ColHeader } from "@/components/table/ColHeader";
import { CalendarConnectButton } from "@/components/calendar/CalendarConnectButton";
import { useAppUsers, useVsdUsers, useVsdHierarchy } from "@/hooks/useAppUsers";
import { useUserRole } from "@/hooks/useUserRole";
import { useDealAccess } from "@/hooks/useDealAccess";
import { BopmEmptyState } from "@/components/access/BopmEmptyState";
import { ReadOnlyBanner } from "@/components/access/ReadOnlyBanner";

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
  useCurrencyVersion();
  const { deals, entries, loading, upsertEntry, vsdSummary, totals, entriesByMonth, availableMonths, refresh } = useMBRData();
  const { users: appUsers, isRegisteredName } = useAppUsers();
  const { vsdUsers, isVsdName, canonVsd } = useVsdUsers();
  const { vsdForDeal, vsdForPerson, bopmsForVsd, allBopms } = useVsdHierarchy();
  const { role } = useUserRole();
  const { visibleDealIds, loading: accessLoading } = useDealAccess();
  const isBopmPersona = role === "user";
  const VSD_FILTERS = useMemo(() => {
    const items: { key: string; label: string }[] = [{ key: "All", label: "All" }];
    vsdUsers.forEach((u) => items.push({ key: u.displayName, label: u.displayName }));
    items.push({ key: "Unassigned", label: "Unassigned" });
    return items;
  }, [vsdUsers]);

  const [activeVsd, setActiveVsd] = useState<VsdFilterKey>("All");
  const [activeBopm, setActiveBopm] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [accountTypeFilter, setAccountTypeFilter] = useState<"retainer" | "non-retainer" | "all">("retainer");
  // Reset BOPM whenever VSD changes
  useEffect(() => { setActiveBopm("All"); }, [activeVsd]);

  // BOPMs available for the currently selected VSD
  const bopmOptions = useMemo(() => {
    if (activeVsd === "All" || activeVsd === "Unassigned") return allBopms;
    return bopmsForVsd(activeVsd);
  }, [activeVsd, bopmsForVsd, allBopms]);

  const nameMatches = (a: string | null | undefined, b: string) => {
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
    return norm(a || "") === norm(b);
  };

  const [viewDeal, setViewDeal] = useState<{ deal: MBRDeal; entry: MBREntry | null } | null>(null);
  const [scheduleDeal, setScheduleDeal] = useState<{ deal: MBRDeal; entry: MBREntry | null } | null>(null);
  const [viewMode, setViewMode] = useState<"current" | "mom" | "trend">("current");
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
    if (isBopmPersona && !accessLoading) {
      d = d.filter(deal => visibleDealIds.has(deal.id));
    }
    if (accountTypeFilter === "retainer") {
      d = d.filter(deal => isRetainerDeal(deal));
    } else if (accountTypeFilter === "non-retainer") {
      d = d.filter(deal => !isRetainerDeal(deal));
    }
    if (!showClosed) {
      d = d.filter(deal => {
        const meta = dealMeta.get(deal.id);
        return meta ? ACTIVE_STATUSES.has(meta.dealStatus) : true;
      });
    }
    if (activeVsd === "Unassigned") {
      d = d.filter(deal => vsdForDeal(deal as any) === null);
    } else if (activeVsd !== "All") {
      d = d.filter(deal => vsdForDeal(deal as any) === activeVsd);
    }
    if (activeBopm !== "All") {
      d = d.filter(deal => {
        const candidates = [(deal as any).principal_bopm, (deal as any).senior_bopm, (deal as any).principalBopm, (deal as any).seniorBopm];
        return candidates.some(c => c && nameMatches(c, activeBopm));
      });
    }
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(deal => deal.account.toLowerCase().includes(s) || deal.dealName.toLowerCase().includes(s));
    }
    return d;
  }, [deals, dealMeta, activeVsd, activeBopm, search, showClosed, vsdForDeal, isBopmPersona, accessLoading, visibleDealIds, accountTypeFilter]);

  // BOPM persona is locked to the table-view, current month only.
  useEffect(() => {
    if (isBopmPersona && viewMode !== "current") setViewMode("current");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBopmPersona]);

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
    // Mandatory MBRs apply to retainer deals only.
    const retainerDeals = filteredDeals.filter(d => isRetainerDeal(d));
    const retainerIds = new Set(retainerDeals.map(d => d.id));
    const relevantEntries = Array.from(activeEntryMap.values()).filter(e => filteredIds.has(e.dealId));
    const done = relevantEntries.filter(e => e.status === "Done").length;
    const notDone = relevantEntries.filter(e => e.status === "Not Done").length;
    const notRequired = relevantEntries.filter(e => e.status === "Not Required").length;
    // Pending only for retainers (non-retainers don't have a mandatory MBR).
    const retainerEntries = Array.from(activeEntryMap.values()).filter(e => retainerIds.has(e.dealId));
    const retainerDone = retainerEntries.filter(e => e.status === "Done").length;
    const retainerNotDone = retainerEntries.filter(e => e.status === "Not Done").length;
    const retainerNotRequired = retainerEntries.filter(e => e.status === "Not Required").length;
    const pending = retainerDeals.length - retainerDone - retainerNotDone - retainerNotRequired;
    const compliance = retainerDeals.length > 0 ? Math.round((retainerDone / retainerDeals.length) * 100) : 0;
    return {
      retainerAccounts: filteredDeals.length,
      retainerCount: retainerDeals.length,
      done, notDone, pending, compliance,
    };
  }, [filteredDeals, activeEntryMap]);

  const handleSave = async (params: any) => {
    await upsertEntry(params);
    await refresh();
  };

  const handleRowClick = (deal: MBRDeal, entry?: MBREntry | null) => {
    setViewDeal({ deal, entry: entry || null });
  };

  // ===== Status pill renderer for MoM cells =====
  const StatusPill = ({ status, sentiment }: { status: string; sentiment?: string | null }) => {
    if (status === "Done") {
      const dotColor =
        sentiment === "Green" ? "bg-positive" :
        sentiment === "Yellow" ? "bg-warning" :
        sentiment === "Red" ? "bg-destructive" : "bg-muted";
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-positive/10 text-positive px-2 py-0.5 text-[10px] font-medium border border-positive/30">
          Done
          <span className={cn("w-2 h-2 rounded-full", dotColor)} title={sentiment ? `Sentiment: ${sentiment}` : "No sentiment"} />
        </span>
      );
    }
    if (status === "Not Done") {
      return <span className="inline-flex rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-medium border border-destructive/30">Not Done</span>;
    }
    if (status === "Not Required") {
      return <span className="inline-flex rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium border border-border">N/R</span>;
    }
    return <span className="inline-flex rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-medium border border-warning/30">Pending</span>;
  };

  // ===== Trend insights computed from allEntries (filtered by current scope) =====
  const trendData = useMemo(() => {
    const filteredIds = new Set(filteredDeals.map(d => d.id));
    const dealsById = new Map(filteredDeals.map(d => [d.id, d]));
    const sortedMonths = [...availableMonths].sort();
    const last12 = sortedMonths.slice(-12);

    // Compliance & sentiment by month
    const compliance = last12.map(m => {
      const monthMap = entriesByMonth.get(m) || new Map();
      let done = 0, notDone = 0, green = 0, yellow = 0, red = 0;
      for (const id of filteredIds) {
        const e = monthMap.get(id);
        if (e?.status === "Done") {
          done++;
          if (e.sentiment === "Green") green++;
          else if (e.sentiment === "Yellow") yellow++;
          else if (e.sentiment === "Red") red++;
        } else if (e?.status === "Not Done") notDone++;
      }
      const total = filteredIds.size;
      return {
        month: formatMonthLabel(m),
        ymd: m,
        compliancePct: total > 0 ? Math.round((done / total) * 100) : 0,
        done, notDone,
        green, yellow, red,
      };
    });

    // Per-deal sentiment timeline (last 6 months) for decliners / streaks / skippers
    const last6 = sortedMonths.slice(-6);
    type Cell = { status: string; sentiment: string | null };
    const perDeal = new Map<string, Cell[]>();
    for (const id of filteredIds) {
      const series = last6.map(m => {
        const e = entriesByMonth.get(m)?.get(id);
        return { status: e?.status || "Pending", sentiment: e?.sentiment || null } as Cell;
      });
      perDeal.set(id, series);
    }

    const sentRank = (s: string | null) => s === "Green" ? 0 : s === "Yellow" ? 1 : s === "Red" ? 2 : -1;

    // Decliners: sentiment got worse in latest vs prior recorded
    const decliners: { dealId: string; deal: MBRDeal; from: string; to: string }[] = [];
    perDeal.forEach((series, id) => {
      const recordedSent = series.filter(c => c.status === "Done" && c.sentiment).map(c => c.sentiment as string);
      if (recordedSent.length >= 2) {
        const prev = recordedSent[recordedSent.length - 2];
        const cur = recordedSent[recordedSent.length - 1];
        if (sentRank(cur) > sentRank(prev)) {
          const deal = dealsById.get(id);
          if (deal) decliners.push({ dealId: id, deal, from: prev, to: cur });
        }
      }
    });
    decliners.sort((a, b) => sentRank(b.to) - sentRank(a.to));

    // Streaks: ≥3 consecutive Green
    const streaks: { deal: MBRDeal; streak: number }[] = [];
    perDeal.forEach((series, id) => {
      let best = 0, cur = 0;
      for (const c of series) {
        if (c.status === "Done" && c.sentiment === "Green") { cur++; best = Math.max(best, cur); }
        else cur = 0;
      }
      if (best >= 3) {
        const deal = dealsById.get(id);
        if (deal) streaks.push({ deal, streak: best });
      }
    });
    streaks.sort((a, b) => b.streak - a.streak);

    // Skippers: most Not Done / Pending in last 6 months
    const skippers: { deal: MBRDeal; missed: number }[] = [];
    perDeal.forEach((series, id) => {
      const missed = series.filter(c => c.status === "Not Done" || c.status === "Pending").length;
      if (missed >= 3) {
        const deal = dealsById.get(id);
        if (deal) skippers.push({ deal, missed });
      }
    });
    skippers.sort((a, b) => b.missed - a.missed);

    // Action items pulse
    let openItems = 0, doneItems = 0;
    const oldestOpen: { deal: MBRDeal; task: string; owner: string; deadline: string }[] = [];
    entriesByMonth.forEach(monthMap => {
      monthMap.forEach((e, dealId) => {
        if (!filteredIds.has(dealId)) return;
        const deal = dealsById.get(dealId);
        if (!deal) return;
        for (const ai of e.actionItems || []) {
          if (ai.done) doneItems++;
          else {
            openItems++;
            oldestOpen.push({ deal, task: ai.task, owner: ai.owner, deadline: ai.deadline });
          }
        }
      });
    });
    oldestOpen.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));

    return {
      compliance,
      decliners: decliners.slice(0, 8),
      streaks: streaks.slice(0, 8),
      skippers: skippers.slice(0, 8),
      openItems, doneItems,
      oldestOpen: oldestOpen.slice(0, 5),
    };
  }, [filteredDeals, entriesByMonth, availableMonths]);

  // VSD insights from filtered deals
  const vsdInsights = useMemo(() => {
    const vsdMap = new Map<string, { vsd: string; bopms: Set<string>; total: number; done: number; notDone: number; pending: number; green: number; yellow: number; red: number; scheduled: number }>();
    for (const deal of filteredDeals) {
      const v = vsdForDeal(deal as any);
      const bucket = v || "Unassigned";
      if (!vsdMap.has(bucket)) vsdMap.set(bucket, { vsd: bucket, bopms: new Set<string>(), total: 0, done: 0, notDone: 0, pending: 0, green: 0, yellow: 0, red: 0, scheduled: 0 });
      const s = vsdMap.get(bucket)!;
      const principal = (deal.principalBopm || "").trim();
      const senior = (deal.seniorBopm || "").trim();
      if (principal) s.bopms.add(principal);
      if (senior && senior !== principal) s.bopms.add(senior);
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
  }, [filteredDeals, activeEntryMap, vsdForDeal]);

  // BOPM insights (Sr / Principal) — used when a specific VSD is selected.
  // Only includes BOPMs mapped to ≥1 active deal in the current scope.
  const bopmInsights = useMemo(() => {
    type Row = { name: string; total: number; done: number; notDone: number; pending: number; green: number; yellow: number; red: number; scheduled: number };
    const map = new Map<string, Row>();
    const overall: Row = { name: "Pod Overall", total: 0, done: 0, notDone: 0, pending: 0, green: 0, yellow: 0, red: 0, scheduled: 0 };
    for (const deal of filteredDeals) {
      const raw = (deal.principalBopm || deal.seniorBopm || "").trim();
      // Bucket by raw BOPM name so people not in the directory (typos,
      // unregistered staff) still appear as their own row instead of being
      // dumped into a generic "Other". Empty BOPMs roll up into "Unassigned".
      const lower = raw.toLowerCase();
      const isPlaceholder =
        !raw ||
        lower === "to be assigned" ||
        lower === "tbd" ||
        lower === "tba" ||
        lower === "unassigned" ||
        lower === "not assigned";
      const bucket = isPlaceholder ? "Unassigned" : raw;
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

  const showBopmInsights = activeVsd !== "All" && activeVsd !== "Unassigned";

  // ===== Flags from done MBRs / Fathom-AI summaries =====
  type Flag = {
    deal: MBRDeal;
    severity: "red" | "yellow" | "info";
    type: string;
    detail: string;
    weekStart?: string;
  };
  const flagInsights = useMemo(() => {
    const filteredIds = new Set(filteredDeals.map(d => d.id));
    const dealsById = new Map(filteredDeals.map(d => [d.id, d]));
    const flags: Flag[] = [];

    const RED_KEYWORDS: { re: RegExp; label: string }[] = [
      { re: /\b(churn|cancel|cancell|terminat|exit|wind\s*down|offboard)\w*/i, label: "Churn risk" },
      { re: /\b(escalat|legal|lawyer|complaint|frustrat|angry|upset|disappoint)\w*/i, label: "Escalation / complaint" },
      { re: /\b(payment|invoice|overdue|outstanding|unpaid|receivable)\w*/i, label: "Payment / receivables" },
      { re: /\b(missed\s*(deadline|deliverable)|deliver(y|ables)?\s*(miss|late|slip|delay))/i, label: "Delivery slipping" },
      { re: /\b(reduc|down\s*scope|de[-\s]?scope|scale\s*back|consolidat)\w*/i, label: "Possible contraction" },
    ];
    const YELLOW_KEYWORDS: { re: RegExp; label: string }[] = [
      { re: /\b(competitor|rfp|reviewing\s*options|alternat|other agency)\b/i, label: "Competitor mentioned" },
      { re: /\b(quality|rework|revis|not\s*happy|below\s*expect|concern)\w*/i, label: "Quality concern" },
      { re: /\b(no\s*poc|poc\s*chang|new\s*poc|stakeholder\s*chang|leadership\s*chang)\w*/i, label: "Stakeholder change" },
      { re: /\b(scope\s*creep|out\s*of\s*scope|extra\s*ask)\w*/i, label: "Scope creep" },
      { re: /\b(slow|response\s*time|turn\s*around|TAT)\b/i, label: "Slow turnaround" },
    ];
    const INFO_KEYWORDS: { re: RegExp; label: string }[] = [
      { re: /\b(upsell|cross[-\s]?sell|expand|grow|additional\s*scope|new\s*scope)\w*/i, label: "Upsell / expansion signal" },
      { re: /\b(renewal|renew|extend\s*contract)\w*/i, label: "Renewal coming up" },
      { re: /\b(case\s*study|testimonial|reference|advocate)\b/i, label: "Advocacy opportunity" },
    ];

    const scan = (text: string, deal: MBRDeal, weekStart?: string) => {
      if (!text) return;
      const seen = new Set<string>();
      const tag = (rules: typeof RED_KEYWORDS, severity: Flag["severity"]) => {
        for (const { re, label } of rules) {
          const m = text.match(re);
          if (m && !seen.has(label)) {
            seen.add(label);
            const idx = m.index ?? 0;
            const snippet = text.slice(Math.max(0, idx - 60), Math.min(text.length, idx + 120)).replace(/\s+/g, " ").trim();
            flags.push({ deal, severity, type: label, detail: snippet, weekStart });
          }
        }
      };
      tag(RED_KEYWORDS, "red");
      tag(YELLOW_KEYWORDS, "yellow");
      tag(INFO_KEYWORDS, "info");
    };

    entriesByMonth.forEach(monthMap => {
      monthMap.forEach((e, dealId) => {
        if (!filteredIds.has(dealId)) return;
        const deal = dealsById.get(dealId);
        if (!deal) return;
        if (!isRetainerDeal(deal)) return; // non-retainers are never flagged
        if (e.status !== "Done") return;
        const text = [e.aiSummary, e.notes, e.transcript].filter(Boolean).join(" \n ");
        scan(text, deal, e.weekStart);
        if (e.sentiment === "Red") {
          flags.push({
            deal, severity: "red", type: "Red sentiment recorded",
            detail: (e.aiSummary || e.notes || "").slice(0, 220),
            weekStart: e.weekStart,
          });
        }
      });
    });

    const sortedMonths = [...availableMonths].sort();
    const last3 = sortedMonths.slice(-3);
    for (const id of filteredIds) {
      const deal = dealsById.get(id);
      if (!deal) continue;
      if (!isRetainerDeal(deal)) continue; // mandatory MBR only for retainers
      const statuses = last3.map(m => entriesByMonth.get(m)?.get(id)?.status || "Pending");
      const missed = statuses.filter(s => s === "Not Done" || s === "Pending").length;
      if (last3.length >= 2 && missed === last3.length) {
        flags.push({
          deal, severity: "red", type: "MBR not held",
          detail: `No MBR recorded in last ${last3.length} months. Re-engage immediately.`,
        });
      }
    }

    const sevRank = (s: Flag["severity"]) => s === "red" ? 2 : s === "yellow" ? 1 : 0;
    const byDeal = new Map<string, { deal: MBRDeal; flags: Flag[]; worst: Flag["severity"] }>();
    for (const f of flags) {
      const key = f.deal.id;
      if (!byDeal.has(key)) byDeal.set(key, { deal: f.deal, flags: [], worst: "info" });
      const g = byDeal.get(key)!;
      g.flags.push(f);
      if (sevRank(f.severity) > sevRank(g.worst)) g.worst = f.severity;
    }
    const grouped = Array.from(byDeal.values()).sort((a, b) => sevRank(b.worst) - sevRank(a.worst) || b.flags.length - a.flags.length);
    const counts = {
      red: flags.filter(f => f.severity === "red").length,
      yellow: flags.filter(f => f.severity === "yellow").length,
      info: flags.filter(f => f.severity === "info").length,
      dealsRed: grouped.filter(g => g.worst === "red").length,
      dealsYellow: grouped.filter(g => g.worst === "yellow").length,
      dealsInfo: grouped.filter(g => g.worst === "info").length,
    };
    return { grouped, counts };
  }, [filteredDeals, entriesByMonth, availableMonths]);

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
        <ReadOnlyBanner routeKey="mbr-tracker" label="MBR Tracker" />
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">MBR Tracker</h1>
            <p className="text-ui text-muted-foreground mt-0.5">
              {kpis.retainerAccounts} {accountTypeFilter === "retainer" ? "retainer accounts" : accountTypeFilter === "non-retainer" ? "non-retainer accounts" : "accounts"} • {viewMode === "current" ? (selectedMonth ? formatMonthLabel(selectedMonth) : "Latest") : "Month-on-Month"}
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
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <KpiTile
            label={accountTypeFilter === "non-retainer" ? "Non-Retainers" : accountTypeFilter === "all" ? "Accounts" : "Retainers"}
            value={accountTypeFilter === "all" ? `${kpis.retainerCount}/${kpis.retainerAccounts}` : String(kpis.retainerAccounts)}
            tone="primary"
            icon={Users}
          />
          <KpiTile label="Done" value={String(kpis.done)} tone="positive" icon={CheckCircle2} />
          <KpiTile label="Not Done" value={String(kpis.notDone)} tone="destructive" icon={XCircle} />
          <KpiTile label="Pending" value={String(kpis.pending)} tone="warning" icon={Clock} />
          <KpiTile label="Compliance" value={`${kpis.compliance}%`} tone="primary" icon={Gauge} />
        </div>

        {/* Account Type filter (Retainer / Non-Retainer / All) */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Account Type:</span>
          <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
            {([
              { key: "retainer", label: "Retainer" },
              { key: "non-retainer", label: "Non-Retainer" },
              { key: "all", label: "All" },
            ] as const).map(v => (
              <button
                key={v.key}
                onClick={() => setAccountTypeFilter(v.key)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  accountTypeFilter === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >{v.label}</button>
            ))}
          </div>
          {accountTypeFilter === "all" && (
            <span className="text-[10px] text-muted-foreground">
              Compliance/flags count retainers only ({kpis.retainerCount} of {kpis.retainerAccounts}).
            </span>
          )}
        </div>

        {/* Tabs: Insights / Table — default to Table; BOPMs don't see Insights */}
        <Tabs defaultValue="table" className="mb-4">
          <TabsList className="mb-3">
            {!isBopmPersona && <TabsTrigger value="insights">Insights</TabsTrigger>}
            {!isBopmPersona && <TabsTrigger value="flags">Flags</TabsTrigger>}
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          {isBopmPersona && !accessLoading && filteredDeals.length === 0 && (
            <div className="mb-3"><BopmEmptyState section="The MBR Tracker" /></div>
          )}

          <TabsContent value="insights" className="mt-0">
            {/* VSD Filter */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">VSD:</span>
          <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
            {VSD_FILTERS.map(v => (
              <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Insights — split into Scheduling + Status, with VSD and BOPM-wise rows */}
        {(() => {
          const dataset: any[] = showBopmInsights
            ? bopmInsights.map(b => ({ ...b, vsd: b.name }))
            : vsdInsights;

          const NumBtn = ({ value, metric, rowLabel, className }: { value: number; metric: DrillMetric; rowLabel: string; className?: string }) => (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (value > 0) setDrill({ rowKey: rowLabel, rowLabel, metric }); }}
              className={cn(
                "font-mono tabular-nums text-xs",
                value > 0 ? "hover:underline cursor-pointer" : "cursor-default opacity-70",
                className,
              )}
            >
              {value}
            </button>
          );

          const labelHeader = showBopmInsights ? "Sr / Principal BOPM" : "VSD";
          const titleSuffix = showBopmInsights ? `BOPM-wise — ${activeVsd}` : "VSD-wise";

          const renderLabel = (v: any) => {
            const isOverall = v.vsd === "Pod Overall";
            if (showBopmInsights) return v.vsd;
            // VSD rollup: show VSD name (cleaner than concatenated BOPMs)
            return isOverall ? v.vsd : v.vsd;
          };

          return (
            <>
              {/* Part 1: Scheduling */}
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Scheduling — {titleSuffix}
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-ui">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border">
                        {[labelHeader, "Accounts", "Scheduled", "Not Scheduled", "Schedule rate"].map(h => (
                          <th key={h} className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.map((v: any) => {
                        const isOverall = v.vsd === "Pod Overall";
                        const notScheduled = Math.max(0, v.total - v.scheduled);
                        const rate = v.total > 0 ? Math.round((v.scheduled / v.total) * 100) : 0;
                        return (
                          <tr key={`sch-${v.vsd}`} className={cn(
                            "border-b border-border/50 hover:bg-secondary/30 transition-colors",
                            isOverall && "bg-primary/5 font-semibold"
                          )}>
                            <td className="py-2.5 px-3 font-semibold text-foreground text-xs">{renderLabel(v)}</td>
                            <td className="py-2.5 px-3"><NumBtn value={v.total} metric="total" rowLabel={v.vsd} className="text-foreground" /></td>
                            <td className="py-2.5 px-3"><NumBtn value={v.scheduled} metric="scheduled" rowLabel={v.vsd} className="text-primary font-semibold" /></td>
                            <td className="py-2.5 px-3"><span className={cn("font-mono tabular-nums text-xs", notScheduled > 0 ? "text-warning font-semibold" : "text-muted-foreground")}>{notScheduled}</span></td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-mono tabular-nums text-xs font-semibold",
                                  rate >= 80 ? "text-positive" : rate >= 50 ? "text-warning" : "text-destructive"
                                )}>{rate}%</span>
                                <div className="flex-1 h-1.5 max-w-[120px] bg-secondary rounded-full overflow-hidden">
                                  <div className={cn("h-full rounded-full", rate >= 80 ? "bg-positive" : rate >= 50 ? "bg-warning" : "bg-destructive")} style={{ width: `${rate}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {dataset.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No data</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Part 2: Status — Scheduled vs Done */}
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-positive" />
                  Status — Scheduled vs Done — {titleSuffix}
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-ui">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border">
                        {[labelHeader, "Scheduled", "Done", "Not Done", "Pending", "Done vs Scheduled", "🟢", "🟡", "🔴"].map(h => (
                          <th key={h} className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.map((v: any) => {
                        const isOverall = v.vsd === "Pod Overall";
                        const denom = v.scheduled || 0;
                        const doneVsSched = denom > 0 ? Math.round((v.done / denom) * 100) : 0;
                        return (
                          <tr key={`st-${v.vsd}`} className={cn(
                            "border-b border-border/50 hover:bg-secondary/30 transition-colors",
                            isOverall && "bg-primary/5 font-semibold"
                          )}>
                            <td className="py-2.5 px-3 font-semibold text-foreground text-xs">{renderLabel(v)}</td>
                            <td className="py-2.5 px-3"><NumBtn value={v.scheduled} metric="scheduled" rowLabel={v.vsd} className="text-primary" /></td>
                            <td className="py-2.5 px-3"><NumBtn value={v.done} metric="done" rowLabel={v.vsd} className="text-positive font-semibold" /></td>
                            <td className="py-2.5 px-3"><NumBtn value={v.notDone} metric="notDone" rowLabel={v.vsd} className="text-destructive font-semibold" /></td>
                            <td className="py-2.5 px-3"><NumBtn value={v.pending} metric="pending" rowLabel={v.vsd} className="text-warning font-semibold" /></td>
                            <td className="py-2.5 px-3">
                              {denom > 0 ? (
                                <span className={cn(
                                  "font-mono tabular-nums text-xs font-semibold",
                                  doneVsSched >= 80 ? "text-positive" : doneVsSched >= 50 ? "text-warning" : "text-destructive"
                                )}>{v.done}/{denom} ({doneVsSched}%)</span>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                            <td className="py-2.5 px-3"><NumBtn value={v.green} metric="green" rowLabel={v.vsd} className="text-positive" /></td>
                            <td className="py-2.5 px-3"><NumBtn value={v.yellow} metric="yellow" rowLabel={v.vsd} className="text-warning" /></td>
                            <td className="py-2.5 px-3"><NumBtn value={v.red} metric="red" rowLabel={v.vsd} className="text-destructive" /></td>
                          </tr>
                        );
                      })}
                      {dataset.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No data</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}
          </TabsContent>

          <TabsContent value="flags" className="mt-0">
            {/* VSD Filter (mirror of Insights tab) */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">VSD:</span>
              <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
                {VSD_FILTERS.map(v => (
                  <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                    activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}>{v.label}</button>
                ))}
              </div>
            </div>

            {/* Flag KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Critical flags</div>
                <div className="text-2xl font-medium text-destructive mt-1">{flagInsights.counts.red}</div>
                <div className="text-[10px] text-muted-foreground">{flagInsights.counts.dealsRed} deals affected</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Flag className="h-3 w-3 text-warning" /> Watch flags</div>
                <div className="text-2xl font-medium text-warning mt-1">{flagInsights.counts.yellow}</div>
                <div className="text-[10px] text-muted-foreground">{flagInsights.counts.dealsYellow} deals affected</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> Opportunities</div>
                <div className="text-2xl font-medium text-primary mt-1">{flagInsights.counts.info}</div>
                <div className="text-[10px] text-muted-foreground">{flagInsights.counts.dealsInfo} deals affected</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Deals scanned</div>
                <div className="text-2xl font-medium text-foreground mt-1">{filteredDeals.length}</div>
                <div className="text-[10px] text-muted-foreground">Across all done MBRs &amp; Fathom notes</div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mb-3">
              Flags are auto-generated from completed MBR notes, AI summaries, and Fathom transcripts. Use them as starting prompts —
              always confirm with the deal team before acting.
            </p>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-ui">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Severity</th>
                    <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Account</th>
                    <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Deal</th>
                    <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">VSD</th>
                    <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sr. BOPM</th>
                    <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {flagInsights.grouped.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      No flags detected. Either no MBRs have been recorded yet or all signals look clean.
                    </td></tr>
                  )}
                  {flagInsights.grouped.map(({ deal, flags, worst }) => {
                    const sevBadge =
                      worst === "red" ? "bg-destructive/15 text-destructive border-destructive/30" :
                      worst === "yellow" ? "bg-warning/15 text-warning border-warning/30" :
                      "bg-primary/15 text-primary border-primary/30";
                    const sevLabel = worst === "red" ? "Critical" : worst === "yellow" ? "Watch" : "Opportunity";
                    return (
                      <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="py-2.5 px-3 align-top">
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border", sevBadge)}>
                            {sevLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-foreground align-top">{deal.account}</td>
                        <td className="py-2.5 px-3 align-top">
                          <Link to={`/deals/${deal.id}?tab=MBR`} className="text-primary hover:underline text-xs font-medium">
                            {deal.dealName}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground align-top">{deal.vsd || "—"}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground align-top">{deal.seniorBopm || deal.principalBopm || "—"}</td>
                        <td className="py-2.5 px-3 align-top">
                          <div className="flex flex-col gap-1.5">
                            {flags.map((f, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className={cn(
                                  "mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border whitespace-nowrap",
                                  f.severity === "red" ? "bg-destructive/10 text-destructive border-destructive/30" :
                                  f.severity === "yellow" ? "bg-warning/10 text-warning border-warning/30" :
                                  "bg-primary/10 text-primary border-primary/30"
                                )}>{f.type}</span>
                                {f.detail && (
                                  <span className="text-[11px] text-muted-foreground italic line-clamp-2" title={f.detail}>
                                    "{f.detail}"
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="table" className="mt-0">
            {/* VSD Filter + Current/MoM toggle */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {!isBopmPersona && (
                <>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">VSD:</span>
                  <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
                    {VSD_FILTERS.map(v => (
                      <button key={v.key} onClick={() => setActiveVsd(v.key)} className={cn(
                        "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                        activeVsd === v.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}>{v.label}</button>
                    ))}
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium ml-2">BOPM:</span>
                  <Select value={activeBopm} onValueChange={setActiveBopm}>
                    <SelectTrigger className="h-7 w-[180px] text-[11px]">
                      <SelectValue placeholder="All BOPMs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs">All BOPMs</SelectItem>
                      {bopmOptions.map(b => (
                        <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              {!isBopmPersona && <div className="ml-auto flex gap-1 bg-secondary rounded-lg p-1">
                <button
                  onClick={() => setViewMode("current")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors",
                    viewMode === "current" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="h-3.5 w-3.5" /> Current
                </button>
                <button
                  onClick={() => setViewMode("mom")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors",
                    viewMode === "mom" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Month-on-Month
                </button>
                <button
                  onClick={() => setViewMode("trend")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors",
                    viewMode === "trend" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Trend
                </button>
              </div>}
            </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
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
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium sticky left-0 bg-secondary/40 z-20 min-w-[160px]">Account</th>
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-w-[180px]">Deal</th>
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-w-[120px]">VSD</th>
                    <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-w-[140px]">Sr. BOPM</th>
                    <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-w-[90px]">MRR</th>
                    {availableMonths.map(m => (
                      <th key={m} className="text-center py-2 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-w-[110px]">
                        {formatMonthLabel(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map(deal => (
                    <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/10 transition-colors">
                      <td className="py-1.5 px-3 sticky left-0 bg-card z-10 text-xs text-foreground truncate max-w-[180px]" title={deal.account}>
                        {deal.account}
                      </td>
                      <td className="py-1.5 px-3">
                        <Link to={`/deals/${deal.id}?tab=MBR`} className="text-primary hover:underline text-xs font-medium truncate block max-w-[200px]" title={deal.dealName}>
                          {deal.dealName}
                        </Link>
                      </td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground truncate max-w-[140px]">{deal.vsd || "—"}</td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground truncate max-w-[160px]">{deal.seniorBopm || "—"}</td>
                      <td className="py-1.5 px-3 text-right text-xs tabular-nums text-foreground">{deal.mrr ? formatCurrency(deal.mrr) : "—"}</td>
                      {availableMonths.map(m => {
                        const monthData = entriesByMonth.get(m);
                        const entry = monthData?.get(deal.id);
                        const status = entry?.status || "Pending";
                        return (
                          <td
                            key={m}
                            className="text-center py-1.5 px-2 cursor-pointer hover:bg-accent/20 transition-colors"
                            onClick={() => handleRowClick(deal, entry || null)}
                            title={`${deal.dealName} — ${formatMonthLabel(m)}: ${status}${entry?.sentiment ? ` · ${entry.sentiment}` : ""}`}
                          >
                            <StatusPill status={status} sentiment={entry?.sentiment} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredDeals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No deals found matching your filters.</p>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-secondary/20 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium">Legend:</span>
              <StatusPill status="Done" sentiment="Green" />
              <StatusPill status="Done" sentiment="Yellow" />
              <StatusPill status="Done" sentiment="Red" />
              <StatusPill status="Not Done" />
              <StatusPill status="Pending" />
              <StatusPill status="Not Required" />
              <span className="text-[10px] text-muted-foreground">Dot beside "Done" = client sentiment</span>
            </div>
          </div>
        )}

        {/* ========== TREND VIEW ========== */}
        {viewMode === "trend" && (
          <div className="space-y-4">
            {/* Top KPI strip */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open action items</div>
                <div className="text-2xl font-medium text-warning mt-1">{trendData.openItems}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Closed action items</div>
                <div className="text-2xl font-medium text-positive mt-1">{trendData.doneItems}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Decliners (last 2 MBRs)</div>
                <div className="text-2xl font-medium text-destructive mt-1">{trendData.decliners.length}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Green streaks (≥3 mo)</div>
                <div className="text-2xl font-medium text-positive mt-1">{trendData.streaks.length}</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="text-xs font-medium text-foreground mb-3">MBR compliance over time</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData.compliance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="compliancePct" stroke="hsl(var(--primary))" strokeWidth={2} name="% Done" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="text-xs font-medium text-foreground mb-3">Client sentiment mix per month</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData.compliance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="green" stackId="s" fill="hsl(var(--positive))" name="Green" />
                    <Bar dataKey="yellow" stackId="s" fill="hsl(var(--warning))" name="Yellow" />
                    <Bar dataKey="red" stackId="s" fill="hsl(var(--destructive))" name="Red" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insight tables */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-secondary/20 text-xs font-medium text-foreground flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-destructive rotate-180" /> Top decliners
                </div>
                {trendData.decliners.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">No declining sentiment in the latest period.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/10">
                      <tr><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Deal</th><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">VSD</th><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Shift</th></tr>
                    </thead>
                    <tbody>
                      {trendData.decliners.map(({ deal, from, to }) => (
                        <tr key={deal.id} className="border-t border-border/50">
                          <td className="px-3 py-1.5"><Link to={`/deals/${deal.id}?tab=MBR`} className="text-primary hover:underline">{deal.dealName}</Link></td>
                          <td className="px-3 py-1.5 text-muted-foreground">{deal.vsd || "—"}</td>
                          <td className="px-3 py-1.5">{from} → <span className="font-medium">{to}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-secondary/20 text-xs font-medium text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-positive" /> Most consistent (Green streaks)
                </div>
                {trendData.streaks.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">No 3+ month Green streaks yet.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/10">
                      <tr><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Deal</th><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">VSD</th><th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Streak</th></tr>
                    </thead>
                    <tbody>
                      {trendData.streaks.map(({ deal, streak }) => (
                        <tr key={deal.id} className="border-t border-border/50">
                          <td className="px-3 py-1.5"><Link to={`/deals/${deal.id}?tab=MBR`} className="text-primary hover:underline">{deal.dealName}</Link></td>
                          <td className="px-3 py-1.5 text-muted-foreground">{deal.vsd || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-positive">{streak} mo</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-secondary/20 text-xs font-medium text-foreground flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-destructive" /> Chronic skippers (last 6 mo)
                </div>
                {trendData.skippers.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">No chronic skippers — nice work.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/10">
                      <tr><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Deal</th><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">VSD</th><th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Missed</th></tr>
                    </thead>
                    <tbody>
                      {trendData.skippers.map(({ deal, missed }) => (
                        <tr key={deal.id} className="border-t border-border/50">
                          <td className="px-3 py-1.5"><Link to={`/deals/${deal.id}?tab=MBR`} className="text-primary hover:underline">{deal.dealName}</Link></td>
                          <td className="px-3 py-1.5 text-muted-foreground">{deal.vsd || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-destructive">{missed} mo</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-secondary/20 text-xs font-medium text-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-warning" /> Oldest open action items
                </div>
                {trendData.oldestOpen.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">No open action items.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/10">
                      <tr><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Deal</th><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Task</th><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Owner</th><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Due</th></tr>
                    </thead>
                    <tbody>
                      {trendData.oldestOpen.map((it, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-3 py-1.5"><Link to={`/deals/${it.deal.id}?tab=MBR`} className="text-primary hover:underline">{it.deal.dealName}</Link></td>
                          <td className="px-3 py-1.5 truncate max-w-[200px]" title={it.task}>{it.task}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{it.owner || "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{it.deadline || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
          </TabsContent>
        </Tabs>
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
