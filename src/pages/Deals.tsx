import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Filter, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

const deals = [
  { id: "D-2024-047", client: "TechCorp India", name: "SEO + Content Retainer", type: "Retainer", status: "Active", serviceLine: "SEO+Content", mrr: "₹8.5L", dealValue: "₹1.02Cr", rgy: "G", vsd: "Anirudh" },
  { id: "D-2024-041", client: "FinServe Ltd", name: "Content Studio", type: "Retainer", status: "Active", serviceLine: "Content", mrr: "₹12.0L", dealValue: "₹1.44Cr", rgy: "R", vsd: "Anirudh" },
  { id: "D-2024-038", client: "MediaNext", name: "Creative Campaign", type: "Non-Retainer", status: "Active", serviceLine: "Creative", mrr: "₹5.2L", dealValue: "₹15.6L", rgy: "Y", vsd: "Priya" },
  { id: "D-2024-035", client: "RetailMax", name: "SEO Pilot", type: "Pilot", status: "Active", serviceLine: "SEO", mrr: "₹3.0L", dealValue: "₹9.0L", rgy: "R", vsd: "Anirudh" },
  { id: "D-2024-033", client: "CloudFirst", name: "Full-Stack Content", type: "Retainer", status: "Active", serviceLine: "SEO+Content", mrr: "₹15.0L", dealValue: "₹1.80Cr", rgy: "G", vsd: "Priya" },
  { id: "D-2024-029", client: "EduPrime", name: "Content Marketing", type: "Retainer", status: "Active", serviceLine: "Content", mrr: "₹6.8L", dealValue: "₹81.6L", rgy: "Y", vsd: "Anirudh" },
  { id: "D-2024-025", client: "HealthPlus", name: "Creative Retainer", type: "Retainer", status: "Paused", serviceLine: "Creative", mrr: "₹4.5L", dealValue: "₹54.0L", rgy: "NA", vsd: "Vikram" },
  { id: "D-2024-019", client: "AutoDrive", name: "SEO Audit", type: "Non-Retainer", status: "Completed", serviceLine: "SEO", mrr: "₹7.0L", dealValue: "₹21.0L", rgy: "G", vsd: "Priya" },
];

const rgyBadge: Record<string, string> = {
  G: "rgy-green",
  R: "rgy-red",
  Y: "rgy-yellow",
  NA: "rgy-na",
};

const statusBadge: Record<string, string> = {
  Active: "bg-positive/10 text-positive",
  Paused: "bg-warning/10 text-warning",
  Completed: "bg-muted text-muted-foreground",
};

export default function Deals() {
  const [search, setSearch] = useState("");
  const filtered = deals.filter(d =>
    d.client.toLowerCase().includes(search.toLowerCase()) ||
    d.id.toLowerCase().includes(search.toLowerCase()) ||
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-subhead font-semibold tracking-tight text-foreground">All Deals</h1>
            <p className="text-ui text-muted-foreground mt-1">{deals.length} deals across all pods</p>
          </div>
          <button className="h-9 px-4 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Deal
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/50 border-0 text-ui text-foreground placeholder:text-muted-foreground focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none transition-colors"
            />
          </div>
          <button className="h-9 px-3 rounded-md border border-border text-ui text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal ID</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Client</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal Name</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Service</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">MRR</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Deal Value</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">RGY</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">VSD</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((deal) => (
                <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="py-3 px-4">
                    <Link to={`/deals/${deal.id}`} className="font-mono text-accent font-medium hover:underline">{deal.id}</Link>
                  </td>
                  <td className="py-3 px-4 font-medium text-foreground">{deal.client}</td>
                  <td className="py-3 px-4 text-muted-foreground">{deal.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{deal.type}</td>
                  <td className="py-3 px-4 text-muted-foreground">{deal.serviceLine}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-foreground">{deal.mrr}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-foreground">{deal.dealValue}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md text-caption font-semibold", rgyBadge[deal.rgy])}>{deal.rgy}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn("inline-block px-2 py-0.5 rounded-md text-caption font-medium", statusBadge[deal.status])}>{deal.status}</span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{deal.vsd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
