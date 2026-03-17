import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";

const people = [
  { name: "Rahul Sharma", role: "Sr. BOPM", pod: "Pod A", ctc: "₹22L", capacity: "₹9.6Cr", utilization: 82, deals: 6 },
  { name: "Priya Mehta", role: "Group BOPM", pod: "Pod A", ctc: "₹18L", capacity: "₹5.0Cr", utilization: 71, deals: 5 },
  { name: "Ankit Kumar", role: "Jr. BOPM", pod: "Pod A", ctc: "₹8L", capacity: "₹2.4Cr", utilization: 93, deals: 4 },
  { name: "Meera Thakur", role: "Sr. BOPM", pod: "Pod B", ctc: "₹20L", capacity: "₹8.0Cr", utilization: 67, deals: 7 },
  { name: "Vikram Joshi", role: "Jr. BOPM", pod: "Pod B", ctc: "₹7L", capacity: "₹2.4Cr", utilization: 88, deals: 3 },
  { name: "Sneha Pillai", role: "Content Strategist", pod: "Pod A", ctc: "₹14L", capacity: "—", utilization: 90, deals: 4 },
  { name: "Deepak Rao", role: "SEO Lead", pod: "Pod C", ctc: "₹16L", capacity: "—", utilization: 78, deals: 5 },
];

function UtilBar({ value }: { value: number }) {
  const color = value < 70 ? "bg-positive" : value < 85 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-sm overflow-hidden"><div className={`h-full rounded-sm ${color}`} style={{ width: `${value}%` }} /></div>
      <span className="text-caption font-mono tabular-nums text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export default function Staffing() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">Staffing & Capacity</h1>
        <p className="text-ui text-muted-foreground mb-6">{people.length} team members across all pods</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total People" value="45" />
          <MetricCard label="Avg Utilization" value="78.4%" change={2.1} />
          <MetricCard label="Understaffed Deals" value="2" />
          <MetricCard label="Open Positions" value="3" />
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Name", "Role", "Pod", "CTC", "Annual Capacity", "Deals", "Utilization"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.name} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{p.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.role}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.pod}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{p.ctc}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{p.capacity}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{p.deals}</td>
                  <td className="py-3 px-4 w-40"><UtilBar value={p.utilization} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
