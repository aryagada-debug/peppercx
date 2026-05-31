import { useMemo } from "react";
import type { Deal } from "@/data/staffingData";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useGeoFilter } from "@/contexts/GeoFilterContext";
import {
  groupDeals,
  bopmOwner,
  geoOf,
  mrrBucketKey,
  MRR_BUCKETS,
  totalRow,
  type PortfolioRow,
} from "@/lib/dealAnalytics";
import { PortfolioTable } from "./PortfolioTable";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Activity, TrendingUp, DollarSign, IndianRupee, Layers, PieChart as PieIcon } from "lucide-react";

interface Props {
  deals: Deal[];
  onDrill?: (filter: { vsd?: string; bopm?: string; bu?: string; capability?: string; geo?: string; mrrBucket?: string }) => void;
}

const ACTIVE_STATUSES = new Set([
  "Active Deal",
  "New Deal in SLA/PO",
  "Deal Disputed",
  "Deal in Renewal Process",
]);

export function ClientsAnalyticsTab({ deals, onDrill }: Props) {
  const { format, currency } = useCurrency();
  const { geo: geoFilter } = useGeoFilter();

  // Scope to active deals so analytics matches what is in flight.
  const scoped = useMemo(
    () => deals.filter((d) => ACTIVE_STATUSES.has(d.dealStatus)),
    [deals],
  );

  // Global geo filter is applied above this component (Clients page filters
  // `deals` before passing in). Here we still need geo-bucketed views.

  const grand = useMemo(() => {
    return totalRow(groupDeals(scoped, () => "all"));
  }, [scoped]);

  const avgMrr = scoped.length > 0 ? grand.mrr / scoped.length : 0;

  // Band B
  const byVsd = useMemo(() => groupDeals(scoped, (d) => d.vsd, undefined, "Unassigned VSD"), [scoped]);
  // Band C
  const byBopm = useMemo(() => groupDeals(scoped, bopmOwner, undefined, "Unassigned"), [scoped]);
  // Band D
  const byPepperBu = useMemo(
    () => groupDeals(scoped, (d) => d.pepperBusinessUnit || d.businessUnit, undefined, "Unassigned BU"),
    [scoped],
  );
  const byCapability = useMemo(
    () => groupDeals(scoped, (d) => d.capabilityLine, undefined, "Unassigned"),
    [scoped],
  );
  // Band F
  const byGeo = useMemo(() => groupDeals(scoped, (d) => geoOf(d)), [scoped]);
  // Band G — MRR distribution × deal type
  const byMrrTier = useMemo(() => {
    const rows = MRR_BUCKETS.map((b) => ({ key: b.key, label: b.label, deals: 0, retainerDeals: 0, nonRetainerDeals: 0, mrr: 0, retainerValue: 0, nonRetainerValue: 0, totalValue: 0 } as PortfolioRow));
    const byKey = new Map(rows.map((r) => [r.key, r] as const));
    for (const d of scoped) {
      const k = mrrBucketKey(Number(d.mrr) || 0);
      const r = byKey.get(k)!;
      r.deals += 1;
      r.mrr += Number(d.mrr) || 0;
      r.retainerValue += Number(d.retainerDealValue) || 0;
      r.nonRetainerValue += Number(d.nonRetainerDealValue) || 0;
      r.totalValue += Number(d.totalDealValue) || (r.retainerValue + r.nonRetainerValue);
      if (d.dealType === "Retainer") r.retainerDeals += 1;
      else if (d.dealType === "Non-Retainer" || d.dealType === "Pilot") r.nonRetainerDeals += 1;
    }
    return rows;
  }, [scoped]);

  // ─────────────────────────── KPI strip ───────────────────────────
  const ValueIcon = currency === "USD" ? DollarSign : IndianRupee;
  const kpis: { key: string; label: string; value: string; Icon: any; tone: "muted" | "positive" | "warning" }[] = [
    { key: "deals", label: "Active Deals", value: String(grand.deals), Icon: Activity, tone: "muted" },
    { key: "ret", label: "Retainer Deals", value: String(grand.retainerDeals), Icon: Layers, tone: "positive" },
    { key: "nr", label: "Non-Retainer Deals", value: String(grand.nonRetainerDeals), Icon: Layers, tone: "warning" },
    { key: "mrr", label: "Total MRR", value: format(grand.mrr), Icon: TrendingUp, tone: "muted" },
    { key: "rv", label: "Retainer Value", value: format(grand.retainerValue), Icon: ValueIcon, tone: "positive" },
    { key: "nrv", label: "Non-Retainer Value", value: format(grand.nonRetainerValue), Icon: ValueIcon, tone: "warning" },
    { key: "tv", label: "Total Deal Value", value: format(grand.totalValue), Icon: ValueIcon, tone: "muted" },
    { key: "amrr", label: "Avg MRR / Deal", value: format(avgMrr), Icon: PieIcon, tone: "muted" },
  ];

  // Retainer mix (overall) for Band E.
  const mixData = useMemo(() => [
    { name: "Retainer", value: grand.retainerValue },
    { name: "Non-Retainer", value: grand.nonRetainerValue },
  ], [grand]);

  const buMixData = useMemo(
    () => byPepperBu.slice(0, 8).map((r) => ({
      name: r.label,
      Retainer: r.retainerValue,
      "Non-Retainer": r.nonRetainerValue,
    })),
    [byPepperBu],
  );

  const vsdMixData = useMemo(
    () => byVsd.slice(0, 10).map((r) => ({
      name: r.label,
      Retainer: r.retainerValue,
      "Non-Retainer": r.nonRetainerValue,
    })),
    [byVsd],
  );

  const geoDealsPie = useMemo(
    () => byGeo.map((r) => ({ name: r.label, value: r.deals })),
    [byGeo],
  );
  const geoMrrPie = useMemo(
    () => byGeo.map((r) => ({ name: r.label, value: r.mrr })),
    [byGeo],
  );

  const GEO_COLORS: Record<string, string> = {
    US: "hsl(var(--primary))",
    India: "hsl(var(--positive, 142 70% 38%))",
    Other: "hsl(var(--muted-foreground))",
  };

  const tooltipStyle = {
    contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 },
    labelStyle: { color: "hsl(var(--foreground))" },
    itemStyle: { color: "hsl(var(--foreground))" },
  } as const;

  return (
    <div className="space-y-4">
      {/* Band A — KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        {kpis.map(({ key, label, value, Icon, tone }) => (
          <div key={key} className="rounded-xl border border-border bg-card px-3 py-2 flex flex-col">
            <div className="flex items-center gap-1.5">
              <Icon className={cn(
                "h-3.5 w-3.5",
                tone === "positive" ? "text-positive" : tone === "warning" ? "text-warning" : "text-muted-foreground",
              )} />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
            </div>
            <p className="text-lg font-medium text-foreground tabular-nums leading-tight mt-1 truncate" title={value}>{value}</p>
          </div>
        ))}
      </div>

      {geoFilter !== "all" && (
        <p className="text-[11px] text-muted-foreground">
          Filtered by geography: <span className="text-foreground font-medium">{geoFilter}</span>. Use the header pill to change.
        </p>
      )}

      {/* Band B — by VSD */}
      <PortfolioTable
        title="Portfolio by VSD"
        rows={byVsd}
        rowLabel="VSD"
        onRowClick={(r) => onDrill?.({ vsd: r.label })}
        emptyHint="No active deals tagged to a VSD."
      />

      {/* Band C — by Senior BOPM / GAM */}
      <PortfolioTable
        title="Portfolio by Senior BOPM / GAM"
        rows={byBopm}
        rowLabel="Owner"
        onRowClick={(r) => onDrill?.({ bopm: r.label })}
        emptyHint="No BOPM ownership on active deals."
      />

      {/* Band D — Pepper BU + Capability split */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <PortfolioTable
          title="Portfolio by Pepper Business Unit"
          rows={byPepperBu}
          rowLabel="Pepper BU"
          onRowClick={(r) => onDrill?.({ bu: r.label })}
        />
        <PortfolioTable
          title="Portfolio by Capability Line"
          rows={byCapability}
          rowLabel="Capability"
          onRowClick={(r) => onDrill?.({ capability: r.label })}
        />
      </div>

      {/* Band E — Retainer vs Non-Retainer mix */}
      <section className="rounded-xl border border-border bg-card">
        <header className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-[12.5px] font-medium text-foreground">Retainer vs Non-Retainer mix</h3>
          <span className="text-[10.5px] text-muted-foreground">By total deal value</span>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Overall</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={68}>
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--warning))" />
                  </Pie>
                  <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => format(Number(v) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="text-[11px] text-muted-foreground mb-1">By Pepper BU (top 8)</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buMixData} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => format(Number(v) || 0)} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Retainer" stackId="a" fill="hsl(var(--primary))" />
                  <Bar dataKey="Non-Retainer" stackId="a" fill="hsl(var(--warning))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="px-3 pb-3">
          <p className="text-[11px] text-muted-foreground mb-1">By VSD (top 10)</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vsdMixData} layout="vertical" margin={{ left: 12, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => format(Number(v) || 0)} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Retainer" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="Non-Retainer" stackId="a" fill="hsl(var(--warning))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Band F — Geo split */}
      <section className="rounded-xl border border-border bg-card">
        <header className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-[12.5px] font-medium text-foreground">Geography split — US vs India</h3>
          <span className="text-[10.5px] text-muted-foreground">Drives Geo filter across the app</span>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground mb-1"># of Deals</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={geoDealsPie} dataKey="value" nameKey="name" innerRadius={30} outerRadius={62}>
                    {geoDealsPie.map((d) => <Cell key={d.name} fill={GEO_COLORS[d.name] || "hsl(var(--muted-foreground))"} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">MRR</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={geoMrrPie} dataKey="value" nameKey="name" innerRadius={30} outerRadius={62}>
                    {geoMrrPie.map((d) => <Cell key={d.name} fill={GEO_COLORS[d.name] || "hsl(var(--muted-foreground))"} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => format(Number(v) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-1 overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10.5px] uppercase tracking-wide text-muted-foreground font-medium">Geo</th>
                  <th className="px-2 py-1.5 text-right text-[10.5px] uppercase tracking-wide text-muted-foreground font-medium">Deals</th>
                  <th className="px-2 py-1.5 text-right text-[10.5px] uppercase tracking-wide text-muted-foreground font-medium">MRR</th>
                  <th className="px-2 py-1.5 text-right text-[10.5px] uppercase tracking-wide text-muted-foreground font-medium">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {byGeo.map((r) => (
                  <tr key={r.key} className="border-b border-border/60 last:border-b-0 cursor-pointer hover:bg-muted/40" onClick={() => onDrill?.({ geo: r.label })}>
                    <td className="px-2 py-1.5 text-left font-medium">{r.label}</td>
                    <td className="px-2 py-1.5 text-right">{r.deals}</td>
                    <td className="px-2 py-1.5 text-right">{format(r.mrr)}</td>
                    <td className="px-2 py-1.5 text-right">{format(r.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Band G — MRR distribution */}
      <PortfolioTable
        title="MRR distribution (active deals)"
        rows={byMrrTier}
        rowLabel="MRR tier"
        onRowClick={(r) => onDrill?.({ mrrBucket: r.key })}
      />
    </div>
  );
}