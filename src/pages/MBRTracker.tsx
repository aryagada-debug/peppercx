import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { cn } from "@/lib/utils";

const mbrs = [
  { deal: "D-2024-047", client: "TechCorp India", month: "Mar 2026", status: "Done In-Person", date: "Mar 12", bopm: "Rahul S." },
  { deal: "D-2024-041", client: "FinServe Ltd", month: "Mar 2026", status: "Not Done", date: "—", bopm: "Priya M." },
  { deal: "D-2024-038", client: "MediaNext", month: "Mar 2026", status: "Done Virtual", date: "Mar 08", bopm: "Meera T." },
  { deal: "D-2024-035", client: "RetailMax", month: "Mar 2026", status: "Not Done", date: "—", bopm: "Ankit K." },
  { deal: "D-2024-033", client: "CloudFirst", month: "Mar 2026", status: "Done In-Person", date: "Mar 15", bopm: "Vikram J." },
  { deal: "D-2024-029", client: "EduPrime", month: "Mar 2026", status: "Not Required", date: "—", bopm: "Rahul S." },
];

const statusColor: Record<string, string> = {
  "Done In-Person": "text-positive",
  "Done Virtual": "text-positive",
  "Not Done": "text-destructive",
  "Not Required": "text-muted-foreground",
};

export default function MBRTracker() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">MBR Tracker</h1>
        <p className="text-ui text-muted-foreground mb-6">Monthly Business Review completion — March 2026</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Completion Rate" value="66.7%" change={5.2} />
          <MetricCard label="In-Person" value="2" />
          <MetricCard label="Virtual" value="1" />
          <MetricCard label="Overdue (>35d)" value="2" />
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Deal", "Client", "Month", "Status", "Date", "Sr. BOPM"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mbrs.map(m => (
                <tr key={m.deal} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-accent font-medium">{m.deal}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{m.client}</td>
                  <td className="py-3 px-4 text-muted-foreground">{m.month}</td>
                  <td className="py-3 px-4"><span className={cn("font-medium", statusColor[m.status])}>{m.status}</span></td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{m.date}</td>
                  <td className="py-3 px-4 text-muted-foreground">{m.bopm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
