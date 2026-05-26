/**
 * Lock Analytics — Central CX view that tracks how many deals are
 * "Staffed" (staffing has been locked by an admin) vs "Unstaffed"
 * (still pending). Slice by VSD, Capability, Deal Type, Status, Pod,
 * Account, and locked-date range. Drill into the unstaffed list and
 * lock deals straight from this tab.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, LabelList,
} from "recharts";
import { Lock, Unlock, Search, X, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/csvTargets";
import type { Deal } from "@/data/staffingData";
import { ACTIVE_DEAL_STATUSES } from "@/data/staffingData";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { useUserRole } from "@/hooks/useUserRole";

type CapabilityKey = "SEO" | "Content" | "Creative" | "Other";
type LockState = "All" | "Staffed" | "Unstaffed";

function dealCapabilities(d: Deal): CapabilityKey[] {
  const caps = new Set<CapabilityKey>();
  if (d.seoStaffing) caps.add("SEO");
  if (d.creativeStaffing) caps.add("Creative");
  const blob = `${d.capabilityLine || ""} ${d.serviceLineTagging || ""} ${d.businessUnit || ""}`.toLowerCase();
  if (/seo|geo/.test(blob)) caps.add("SEO");
  if (/creative|design|video|copy/.test(blob)) caps.add("Creative");
  if (/content|editorial|writing/.test(blob)) caps.add("Content");
  if (caps.size === 0) caps.add("Other");
  return Array.from(caps);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr)).filter(v => v != null && v !== "") as T[];
}

interface Props {
  deals: Deal[];
}

export function LockAnalyticsTab({ deals }: Props) {
  const { isAdmin } = useUserRole();
  const { lockStaffing } = useStaffingMutations();

  // Filters
  const [vsdFilter, setVsdFilter] = useState<string>("All");
  const [capFilter, setCapFilter] = useState<CapabilityKey | "All">("All");
  const [dealTypeFilter, setDealTypeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Other">("Active");
  const [podFilter, setPodFilter] = useState<string>("All");
  const [accountSearch, setAccountSearch] = useState<string>("");
  const [lockedFrom, setLockedFrom] = useState<string>("");
  const [lockedTo, setLockedTo] = useState<string>("");
  const [lockStateFilter, setLockStateFilter] = useState<LockState>("All");
  const [busyId, setBusyId] = useState<string | null>(null);

  const vsds = useMemo(() => unique(deals.map(d => d.vsd)).sort(), [deals]);
  const pods = useMemo(() => unique(deals.map(d => d.pod || "")).sort(), [deals]);
  const dealTypes = useMemo(() => unique(deals.map(d => d.dealType)).sort(), [deals]);

  // Apply filters
  const filteredDeals = useMemo(() => {
    const acctNeedle = accountSearch.trim().toLowerCase();
    const fromTs = lockedFrom ? new Date(lockedFrom).getTime() : null;
    const toTs = lockedTo ? new Date(lockedTo).getTime() + 24 * 3600 * 1000 : null;
    return deals.filter(d => {
      if (vsdFilter !== "All" && (d.vsd || "") !== vsdFilter) return false;
      if (podFilter !== "All" && (d.pod || "") !== podFilter) return false;
      if (dealTypeFilter !== "All" && d.dealType !== dealTypeFilter) return false;
      if (statusFilter === "Active" && !ACTIVE_DEAL_STATUSES.has(d.dealStatus)) return false;
      if (statusFilter === "Other" && ACTIVE_DEAL_STATUSES.has(d.dealStatus)) return false;
      if (capFilter !== "All" && !dealCapabilities(d).includes(capFilter)) return false;
      if (acctNeedle && !(`${d.account} ${d.dealName} ${d.dealId}`.toLowerCase().includes(acctNeedle))) return false;
      if (fromTs || toTs) {
        if (!d.staffingLockedAt) return false;
        const t = new Date(d.staffingLockedAt).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      }
      if (lockStateFilter === "Staffed" && !d.staffingLockedAt) return false;
      if (lockStateFilter === "Unstaffed" && d.staffingLockedAt) return false;
      return true;
    });
  }, [deals, vsdFilter, podFilter, dealTypeFilter, statusFilter, capFilter, accountSearch, lockedFrom, lockedTo, lockStateFilter]);

  // KPIs
  const total = filteredDeals.length;
  const staffed = filteredDeals.filter(d => !!d.staffingLockedAt).length;
  const unstaffed = total - staffed;
  const pct = total > 0 ? Math.round((staffed / total) * 100) : 0;

  // By VSD
  const byVsd = useMemo(() => {
    const map = new Map<string, { name: string; staffed: number; unstaffed: number }>();
    for (const d of filteredDeals) {
      const k = d.vsd || "—";
      if (!map.has(k)) map.set(k, { name: k, staffed: 0, unstaffed: 0 });
      const row = map.get(k)!;
      if (d.staffingLockedAt) row.staffed += 1; else row.unstaffed += 1;
    }
    return Array.from(map.values()).sort((a, b) => (b.unstaffed + b.staffed) - (a.unstaffed + a.staffed));
  }, [filteredDeals]);

  // By Capability
  const byCap = useMemo(() => {
    const map = new Map<CapabilityKey, { name: CapabilityKey; staffed: number; unstaffed: number }>();
    (["SEO", "Content", "Creative", "Other"] as CapabilityKey[]).forEach(c =>
      map.set(c, { name: c, staffed: 0, unstaffed: 0 }));
    for (const d of filteredDeals) {
      const caps = dealCapabilities(d);
      for (const c of caps) {
        const row = map.get(c)!;
        if (d.staffingLockedAt) row.staffed += 1; else row.unstaffed += 1;
      }
    }
    return Array.from(map.values());
  }, [filteredDeals]);

  // Unstaffed table — always shows unstaffed regardless of lockStateFilter
  // (the filter is for the charts/KPIs; the table is the action list).
  const unstaffedDeals = useMemo(
    () => filteredDeals.filter(d => !d.staffingLockedAt).sort((a, b) => (b.mrr || 0) - (a.mrr || 0)),
    [filteredDeals],
  );

  const handleLock = async (dealId: string) => {
    if (busyId) return;
    setBusyId(dealId);
    try { await lockStaffing(dealId, true); } catch { /* toast handled */ }
    finally { setBusyId(null); }
  };

  const resetFilters = () => {
    setVsdFilter("All"); setCapFilter("All"); setDealTypeFilter("All");
    setStatusFilter("Active"); setPodFilter("All"); setAccountSearch("");
    setLockedFrom(""); setLockedTo(""); setLockStateFilter("All");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex flex-wrap items-end gap-2">
          <FilterSelect label="VSD" value={vsdFilter} onChange={setVsdFilter} options={["All", ...vsds]} />
          <FilterSelect label="Capability" value={capFilter} onChange={(v) => setCapFilter(v as any)} options={["All", "SEO", "Content", "Creative", "Other"]} />
          <FilterSelect label="Deal Type" value={dealTypeFilter} onChange={setDealTypeFilter} options={["All", ...dealTypes]} />
          <FilterSelect label="Status" value={statusFilter} onChange={(v) => setStatusFilter(v as any)} options={["All", "Active", "Other"]} />
          <FilterSelect label="Pod" value={podFilter} onChange={setPodFilter} options={["All", ...pods]} />
          <FilterSelect label="Lock state" value={lockStateFilter} onChange={(v) => setLockStateFilter(v as any)} options={["All", "Staffed", "Unstaffed"]} />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Account / deal</label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={accountSearch}
                onChange={e => setAccountSearch(e.target.value)}
                placeholder="Search…"
                className="h-7 pl-7 pr-2 text-xs rounded border border-border bg-background w-[180px]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Locked from</label>
            <input type="date" value={lockedFrom} onChange={e => setLockedFrom(e.target.value)}
              className="h-7 px-2 text-xs rounded border border-border bg-background" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Locked to</label>
            <input type="date" value={lockedTo} onChange={e => setLockedTo(e.target.value)}
              className="h-7 px-2 text-xs rounded border border-border bg-background" />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="h-7 px-2 text-xs rounded border border-border hover:bg-secondary inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Reset
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total deals" value={total.toString()} />
        <Kpi label="Staffed (locked)" value={staffed.toString()} tone="green" />
        <Kpi label="Unstaffed" value={unstaffed.toString()} tone="amber" />
        <Kpi label="% Staffed" value={`${pct}%`} tone={pct >= 85 ? "green" : pct >= 60 ? "amber" : "red"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Staffed vs Unstaffed — by VSD">
          {byVsd.length === 0
            ? <EmptyChart />
            : (
              <ResponsiveContainer width="100%" height={Math.max(240, byVsd.length * 28)}>
                <BarChart data={byVsd} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }} barCategoryGap={6}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis dataKey="name" type="category" width={140} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <RechartsTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="staffed" stackId="a" name="Staffed" fill="hsl(142, 76%, 36%)">
                    <LabelList dataKey="staffed" position="insideRight" fill="#fff" fontSize={10} />
                  </Bar>
                  <Bar dataKey="unstaffed" stackId="a" name="Unstaffed" fill="hsl(38, 92%, 50%)">
                    <LabelList dataKey="unstaffed" position="insideRight" fill="#fff" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartCard>

        <ChartCard title="Staffed vs Unstaffed — by Capability">
          {byCap.length === 0
            ? <EmptyChart />
            : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byCap} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <RechartsTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="staffed" stackId="a" name="Staffed" fill="hsl(142, 76%, 36%)">
                    <LabelList dataKey="staffed" position="insideTop" fill="#fff" fontSize={10} />
                  </Bar>
                  <Bar dataKey="unstaffed" stackId="a" name="Unstaffed" fill="hsl(38, 92%, 50%)">
                    <LabelList dataKey="unstaffed" position="insideTop" fill="#fff" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartCard>
      </div>

      {/* Unstaffed deals table */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Unlock className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-sm font-medium">Unstaffed deals to close out</span>
            <span className="text-xs text-muted-foreground">({unstaffedDeals.length})</span>
          </div>
          {!isAdmin && (
            <span className="text-[11px] text-muted-foreground">Only Central CX can lock staffing.</span>
          )}
        </div>
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Deal ID</th>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-left">Deal name</th>
                <th className="px-3 py-2 text-left">VSD</th>
                <th className="px-3 py-2 text-left">Capability</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">MRR</th>
                <th className="px-3 py-2 text-right w-[110px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {unstaffedDeals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    No unstaffed deals match the current filters. 🎉
                  </td>
                </tr>
              ) : unstaffedDeals.map(d => (
                <tr key={d.id} className="border-t border-border hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono text-[11px]">{d.dealId}</td>
                  <td className="px-3 py-2">
                    <Link to={`/deals/${d.id}?tab=Staffing`} className="hover:underline font-medium">
                      {d.account}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[280px]" title={d.dealName}>{d.dealName}</td>
                  <td className="px-3 py-2">{d.vsd || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {dealCapabilities(d).map(c => (
                        <span key={c} className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">{d.dealType}</td>
                  <td className="px-3 py-2">{d.dealStatus || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatINR(d.mrr || 0)}</td>
                  <td className="px-3 py-2 text-right">
                    {isAdmin ? (
                      <button
                        type="button"
                        disabled={busyId === d.id}
                        onClick={() => handleLock(d.id)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium",
                          "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                          "disabled:opacity-50",
                        )}
                      >
                        <Lock className="h-3 w-3" />
                        {busyId === d.id ? "Locking…" : "Lock"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 px-2 text-xs rounded border border-border bg-background"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "green" | "amber" | "red" }) {
  const toneStyle =
    tone === "green" ? "text-green-600 dark:text-green-400" :
    tone === "amber" ? "text-amber-600 dark:text-amber-400" :
    tone === "red"   ? "text-red-600 dark:text-red-400" :
    "text-foreground";
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-medium mt-1", toneStyle)}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-sm font-medium mb-2">{title}</div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
      No data for the current filters.
    </div>
  );
}