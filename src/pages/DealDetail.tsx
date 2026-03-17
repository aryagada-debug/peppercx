import { AppLayout } from "@/components/layout/AppLayout";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const tabs = ["Overview", "Staffing", "Revenue", "Targets", "RGY Health", "MBR", "Slack", "Onboarding", "Timesheets"];

const dealData = {
  id: "D-2024-047",
  client: "TechCorp India",
  name: "SEO + Content Retainer",
  type: "Retainer",
  status: "Active",
  serviceLine: "SEO+Content",
  mrr: "₹8,50,000",
  dealValue: "₹1,02,00,000",
  duration: "12 months",
  startDate: "Apr 2024",
  endDate: "Mar 2025",
  geo: "India",
  vsd: "Anirudh Kumar",
  gm1: "42.3%",
};

const staffing = [
  { name: "Rahul S.", role: "Sr. BOPM", hoursWeek: 20, utilization: 82 },
  { name: "Ankit K.", role: "Jr. BOPM", hoursWeek: 15, utilization: 65 },
  { name: "Sneha P.", role: "Content Strategist", hoursWeek: 30, utilization: 90 },
  { name: "Deepak R.", role: "SEO Lead", hoursWeek: 25, utilization: 78 },
];

const revenue = [
  { month: "Oct 2024", target: "₹8.5L", actual: "₹8.2L", attainment: "96.5%" },
  { month: "Nov 2024", target: "₹8.5L", actual: "₹8.7L", attainment: "102.4%" },
  { month: "Dec 2024", target: "₹8.5L", actual: "₹7.9L", attainment: "92.9%" },
  { month: "Jan 2025", target: "₹8.5L", actual: "₹8.5L", attainment: "100.0%" },
  { month: "Feb 2025", target: "₹8.5L", actual: "₹8.8L", attainment: "103.5%" },
  { month: "Mar 2025", target: "₹9.0L", actual: "₹7.2L", attainment: "80.0%" },
];

const rgyHistory = [
  { month: "Jan 2025", internal: "G", customer: "G", delivery: "G", consumption: "G" },
  { month: "Feb 2025", internal: "G", customer: "G", delivery: "Y", consumption: "G" },
  { month: "Mar 2025", internal: "G", customer: "G", delivery: "Y", consumption: "G" },
];

const rgyColors: Record<string, string> = { G: "rgy-green", R: "rgy-red", Y: "rgy-yellow" };

export default function DealDetail() {
  const { dealId } = useParams();
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/deals" className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-ui text-accent font-medium">{dealId || dealData.id}</span>
              <span className="inline-block px-2 py-0.5 rounded-md text-caption font-medium bg-positive/10 text-positive">Active</span>
            </div>
            <h1 className="text-subhead font-semibold tracking-tight text-foreground">{dealData.name}</h1>
            <p className="text-ui text-muted-foreground">{dealData.client}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <div className="flex gap-0 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2.5 text-ui font-medium transition-colors border-b-2 whitespace-nowrap",
                  activeTab === tab
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "Overview" && (
          <div className="grid grid-cols-3 gap-4">
            {[
              ["Deal Type", dealData.type], ["Service Line", dealData.serviceLine], ["Status", dealData.status],
              ["MRR", dealData.mrr], ["Deal Value", dealData.dealValue], ["GM1", dealData.gm1],
              ["Duration", dealData.duration], ["Start", dealData.startDate], ["End", dealData.endDate],
              ["GEO", dealData.geo], ["VSD", dealData.vsd], ["Pipeline", "Won"],
            ].map(([label, value]) => (
              <div key={label} className="data-card">
                <p className="metric-label">{label}</p>
                <p className="text-ui font-medium text-foreground mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Staffing" && (
          <div className="data-card p-0 overflow-hidden">
            <table className="w-full text-ui">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Role on Deal</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Hrs/Week</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {staffing.map(s => (
                  <tr key={s.name} className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium text-foreground">{s.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{s.role}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{s.hoursWeek}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{s.utilization}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Revenue" && (
          <div className="data-card p-0 overflow-hidden">
            <table className="w-full text-ui">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Month</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Target</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Actual</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Attainment</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map(r => (
                  <tr key={r.month} className="border-b border-border/50">
                    <td className="py-3 px-4 text-foreground">{r.month}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-muted-foreground">{r.target}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-foreground">{r.actual}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={cn(parseFloat(r.attainment) >= 100 ? "text-positive" : parseFloat(r.attainment) >= 90 ? "text-warning" : "text-destructive")}>{r.attainment}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Targets" && (
          <div className="data-card">
            <p className="metric-label mb-4">Monthly Targets & Actuals</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="data-card"><p className="metric-label">Current Month Target</p><p className="metric-value mt-2">₹9.0L</p></div>
              <div className="data-card"><p className="metric-label">YTD Target</p><p className="metric-value mt-2">₹51.0L</p></div>
              <div className="data-card"><p className="metric-label">YTD Attainment</p><p className="metric-value mt-2">95.8%</p><p className="text-ui text-positive mt-1">↑ On track</p></div>
            </div>
          </div>
        )}

        {activeTab === "RGY Health" && (
          <div className="data-card p-0 overflow-hidden">
            <table className="w-full text-ui">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Month</th>
                  {["Internal", "Customer", "Delivery", "Consumption"].map(d => (
                    <th key={d} className="text-center py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rgyHistory.map(r => (
                  <tr key={r.month} className="border-b border-border/50">
                    <td className="py-3 px-4 text-foreground">{r.month}</td>
                    {[r.internal, r.customer, r.delivery, r.consumption].map((val, i) => (
                      <td key={i} className="py-3 px-4 text-center">
                        <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold", rgyColors[val])}>{val}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "MBR" && (
          <div className="data-card">
            <p className="metric-label mb-4">MBR History</p>
            <div className="space-y-3">
              {[
                { month: "Feb 2025", status: "Done In-Person", date: "Feb 18, 2025" },
                { month: "Jan 2025", status: "Done Virtual", date: "Jan 22, 2025" },
                { month: "Dec 2024", status: "Done In-Person", date: "Dec 15, 2024" },
              ].map(m => (
                <div key={m.month} className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-foreground font-medium">{m.month}</span>
                  <span className="text-ui text-positive">{m.status}</span>
                  <span className="text-ui text-muted-foreground font-mono">{m.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Slack" && (
          <div className="data-card">
            <p className="metric-label mb-2">Channel Health</p>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-ui text-muted-foreground">#techcorp-seo-content</p>
                <p className="metric-value mt-1">78</p>
                <p className="text-caption text-muted-foreground">Health Score</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Channel Exists", "+10", "✓"],
                ["All Staff in Channel", "+12/15", "4/5 members"],
                ["Daily Updates (7d)", "+20/25", "4/5 days"],
                ["Weekly Internal (4w)", "+16/20", "3/4 weeks"],
                ["Weekly Customer (4w)", "+15/20", "3/4 weeks"],
                ["Capability Email (4w)", "+5/10", "2/4 weeks"],
              ].map(([label, pts, detail]) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-ui text-foreground">{label}</span>
                  <div className="text-right">
                    <span className="text-ui font-mono tabular-nums text-positive">{pts}</span>
                    <p className="text-caption text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Onboarding" && (
          <div className="data-card">
            <p className="metric-label mb-4">Onboarding Checklist</p>
            <p className="text-ui text-muted-foreground">This deal has completed onboarding.</p>
            <div className="mt-4 h-2 bg-muted rounded-sm overflow-hidden">
              <div className="h-full bg-positive rounded-sm" style={{ width: "100%" }} />
            </div>
            <p className="text-caption text-positive mt-1 font-medium">100% Complete — Completed in 18 days (SLA: 21 days)</p>
          </div>
        )}

        {activeTab === "Timesheets" && (
          <div className="data-card p-0 overflow-hidden">
            <table className="w-full text-ui">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Person</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Mon</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Tue</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Wed</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Thu</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Fri</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Rahul S.", hours: [4, 4, 4, 4, 4] },
                  { name: "Ankit K.", hours: [3, 3, 3, 3, 3] },
                  { name: "Sneha P.", hours: [6, 6, 6, 6, 6] },
                ].map(t => (
                  <tr key={t.name} className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium text-foreground">{t.name}</td>
                    {t.hours.map((h, i) => (
                      <td key={i} className="py-3 px-4 text-right font-mono tabular-nums text-foreground">{h}</td>
                    ))}
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-foreground">{t.hours.reduce((a, b) => a + b, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
