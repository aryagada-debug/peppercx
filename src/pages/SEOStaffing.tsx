import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { cn } from "@/lib/utils";

const accounts = [
  { name: "TechCorp India", pod: "Pod A", region: "India", mrr: "₹8.5L", seoMrr: "₹4.2L", rag: "G", status: "Staffed", l1: "Deepak R.", l2: "Sneha P.", l3: "Ankit K." },
  { name: "FinServe Ltd", pod: "Pod A", region: "India", mrr: "₹12.0L", seoMrr: "₹6.0L", rag: "R", status: "Gap", l1: "—", l2: "Priya M.", l3: "—" },
  { name: "CloudFirst", pod: "Pod B", region: "US", mrr: "₹15.0L", seoMrr: "₹8.0L", rag: "G", status: "Staffed", l1: "Raj K.", l2: "Meera T.", l3: "Vikram J." },
  { name: "EduPrime", pod: "Pod C", region: "India", mrr: "₹6.8L", seoMrr: "₹3.4L", rag: "Y", status: "Replace", l1: "Deepak R.", l2: "—", l3: "Ankit K." },
];

const ragBadge: Record<string, string> = { G: "rgy-green", R: "rgy-red", Y: "rgy-yellow" };
const statusColor: Record<string, string> = {
  Staffed: "text-positive",
  Gap: "text-destructive",
  Replace: "text-warning",
};

export default function SEOStaffing() {
  return (
    <AppLayout>
      <div className="px-3 py-4">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">SEO Capability Staffing</h1>
        <p className="text-ui text-muted-foreground mb-6">Three-tier bandwidth planner — {accounts.length} accounts</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total SEO Accounts" value={String(accounts.length)} />
          <MetricCard label="Fully Staffed" value="2" />
          <MetricCard label="Gaps" value="1" />
          <MetricCard label="Replacements" value="1" />
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Account", "Pod", "Region", "Contract MRR", "SEO MRR", "RAG", "Status", "L1 Leader", "L2 Principal", "L3 Manager"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.name} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{a.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{a.pod}</td>
                  <td className="py-3 px-4 text-muted-foreground">{a.region}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{a.mrr}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{a.seoMrr}</td>
                  <td className="py-3 px-4"><span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold", ragBadge[a.rag])}>{a.rag}</span></td>
                  <td className="py-3 px-4"><span className={cn("font-medium", statusColor[a.status])}>{a.status}</span></td>
                  <td className="py-3 px-4 text-foreground">{a.l1}</td>
                  <td className="py-3 px-4 text-foreground">{a.l2}</td>
                  <td className="py-3 px-4 text-foreground">{a.l3}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
