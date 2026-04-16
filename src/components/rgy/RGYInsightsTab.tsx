import React, { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle } from "lucide-react";

const DIMENSIONS = [
  { key: "customer", label: "Customer" },
  { key: "internal", label: "Internal" },
  { key: "content", label: "Content" },
  { key: "seo", label: "SEO" },
  { key: "supply", label: "Supply" },
  { key: "copy", label: "Copy" },
  { key: "design", label: "Design" },
  { key: "video", label: "Video" },
];

const SERVICE_LINES = ["content", "seo", "supply", "copy", "design", "video"];

const COLORS = { R: "#ef4444", Y: "#f59e0b", G: "#22c55e", NA: "#94a3b8" };

interface DealWithRGY {
  id: string;
  deal_name: string;
  account: string;
  deal_status: string;
  vsd: string;
  [key: string]: any;
}

interface RGYIssue {
  deal_name: string;
  issue_details: string;
  issue_status: string;
  dimension?: string;
}

interface Props {
  deals: DealWithRGY[];
  filteredDeals: DealWithRGY[];
  issues: RGYIssue[];
}

function getWorstRGY(deal: DealWithRGY): "R" | "Y" | "G" | null {
  const vals = DIMENSIONS.map(d => deal[d.key] as string);
  if (vals.includes("R")) return "R";
  if (vals.includes("Y")) return "Y";
  if (vals.every(v => v === "NA" || !v)) return null;
  return "G";
}

export function RGYInsightsTab({ deals, filteredDeals, issues }: Props) {
  // KPI row
  const kpis = useMemo(() => {
    let red = 0, yellow = 0, green = 0, churned = 0;
    filteredDeals.forEach(d => {
      if (d.deal_status === "Deal Churned / Lost") { churned++; return; }
      const w = getWorstRGY(d);
      if (w === "R") red++;
      else if (w === "Y") yellow++;
      else if (w === "G") green++;
    });
    return { total: filteredDeals.length, red, yellow, green, churned };
  }, [filteredDeals]);

  // Health donut data
  const donutData = useMemo(() => [
    { name: "Red", value: kpis.red, fill: COLORS.R },
    { name: "Yellow", value: kpis.yellow, fill: COLORS.Y },
    { name: "Green", value: kpis.green, fill: COLORS.G },
  ].filter(d => d.value > 0), [kpis]);

  // Red count per dimension
  const redPerDim = useMemo(() =>
    DIMENSIONS.map(dim => ({
      dimension: dim.label,
      red: filteredDeals.filter(d => d[dim.key] === "R").length,
    })).sort((a, b) => b.red - a.red),
  [filteredDeals]);

  // Full heatmap data sorted by most red
  const heatmapData = useMemo(() => {
    return filteredDeals.map(deal => {
      const redCount = DIMENSIONS.filter(d => deal[d.key] === "R").length;
      const yellowCount = DIMENSIONS.filter(d => deal[d.key] === "Y").length;
      return { deal, redCount, yellowCount };
    }).sort((a, b) => b.redCount - a.redCount || b.yellowCount - a.yellowCount);
  }, [filteredDeals]);

  // Top risk ranking
  const riskRanking = useMemo(() =>
    heatmapData.filter(d => d.redCount > 0 || d.yellowCount > 0).slice(0, 15),
  [heatmapData]);

  // Service line health
  const serviceLineHealth = useMemo(() =>
    SERVICE_LINES.map(key => {
      const dim = DIMENSIONS.find(d => d.key === key)!;
      const r = filteredDeals.filter(d => d[key] === "R").length;
      const y = filteredDeals.filter(d => d[key] === "Y").length;
      const g = filteredDeals.filter(d => d[key] === "G").length;
      return { name: dim.label, Red: r, Yellow: y, Green: g };
    }),
  [filteredDeals]);

  // VSD comparison
  const vsdComparison = useMemo(() => {
    const map = new Map<string, { vsd: string; Red: number; Yellow: number; Green: number }>();
    filteredDeals.forEach(deal => {
      const v = deal.vsd || "Unknown";
      const entry = map.get(v) || { vsd: v, Red: 0, Yellow: 0, Green: 0 };
      const w = getWorstRGY(deal);
      if (w === "R") entry.Red++;
      else if (w === "Y") entry.Yellow++;
      else if (w === "G") entry.Green++;
      map.set(v, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.Red - a.Red);
  }, [filteredDeals]);

  // Critical issues
  const criticalIssues = useMemo(() =>
    issues.filter(i => i.issue_status === "Open" || i.issue_status === "In Progress"),
  [issues]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Total Deals", value: kpis.total, color: "" },
          { label: "Red / Hot-Red", value: kpis.red, color: "text-red-600" },
          { label: "Yellow", value: kpis.yellow, color: "text-amber-600" },
          { label: "Green", value: kpis.green, color: "text-emerald-600" },
          { label: "Churned", value: kpis.churned, color: "text-muted-foreground" },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-lg p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className={cn("text-2xl font-bold", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Critical Issues + Health Donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Critical Issues */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Critical Issues & Watch List
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {criticalIssues.length === 0 && <p className="text-xs text-muted-foreground">No open issues</p>}
            {criticalIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-secondary/30 rounded-md">
                <AlertCircle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", issue.issue_status === "Open" ? "text-red-500" : "text-amber-500")} />
                <div>
                  <p className="text-xs font-medium">{issue.deal_name}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{issue.issue_details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Donut */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Health Distribution (Worst RGY)</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={220} height={200}>
              <PieChart>
                <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 ml-4">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span>{d.name}: <strong>{d.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Red per dimension + Service Line Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Red count per dimension */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Red Count per Dimension</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={redPerDim} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="dimension" tick={{ fontSize: 11 }} width={58} />
              <RechartsTooltip />
              <Bar dataKey="red" fill={COLORS.R} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service Line Health */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Service Line Health</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serviceLineHealth} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Red" stackId="a" fill={COLORS.R} />
              <Bar dataKey="Yellow" stackId="a" fill={COLORS.Y} />
              <Bar dataKey="Green" stackId="a" fill={COLORS.G} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full Heatmap */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Full Account × Dimension Heatmap</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Account</th>
                {DIMENSIONS.map(d => (
                  <th key={d.key} className="text-center py-1.5 px-1 font-medium text-muted-foreground whitespace-nowrap">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map(({ deal }) => (
                <tr key={deal.id} className="border-b border-border/50">
                  <td className="py-1 px-2 font-medium truncate max-w-[160px]" title={deal.deal_name}>{deal.deal_name}</td>
                  {DIMENSIONS.map(dim => {
                    const v = deal[dim.key] as string;
                    const bg = v === "R" ? "bg-red-500/20" : v === "Y" ? "bg-amber-500/20" : v === "G" ? "bg-emerald-500/20" : "";
                    const textColor = v === "R" ? "text-red-700" : v === "Y" ? "text-amber-700" : v === "G" ? "text-emerald-700" : "text-muted-foreground";
                    return (
                      <td key={dim.key} className={cn("text-center py-1 px-1 font-semibold", bg, textColor)}>
                        {v === "NA" ? "—" : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Risk Ranking */}
      {riskRanking.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Top Risk Ranking</h3>
          <div className="space-y-1.5">
            {riskRanking.map(({ deal, redCount, yellowCount }) => (
              <div key={deal.id} className="flex items-center gap-3">
                <span className="text-xs font-medium w-40 truncate" title={deal.deal_name}>{deal.deal_name}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: redCount }).map((_, i) => (
                    <span key={`r${i}`} className="w-3 h-3 rounded-full bg-red-500" />
                  ))}
                  {Array.from({ length: yellowCount }).map((_, i) => (
                    <span key={`y${i}`} className="w-3 h-3 rounded-full bg-amber-500" />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">{redCount}R / {yellowCount}Y</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VSD Comparison */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">VSD Comparison</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={vsdComparison} margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="vsd" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Red" fill={COLORS.R} />
            <Bar dataKey="Yellow" fill={COLORS.Y} />
            <Bar dataKey="Green" fill={COLORS.G} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
