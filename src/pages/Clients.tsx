import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useState } from "react";

const clients = [
  { pcCode: "PC-101", name: "TechCorp India", geo: "India", status: "Active", deals: 3, totalMrr: "₹18.5L", totalValue: "₹2.22Cr" },
  { pcCode: "PC-102", name: "FinServe Ltd", geo: "India", status: "Active", deals: 2, totalMrr: "₹15.0L", totalValue: "₹1.80Cr" },
  { pcCode: "PC-103", name: "MediaNext", geo: "UAE", status: "Active", deals: 1, totalMrr: "₹5.2L", totalValue: "₹15.6L" },
  { pcCode: "PC-104", name: "RetailMax", geo: "India", status: "Active", deals: 2, totalMrr: "₹8.0L", totalValue: "₹96.0L" },
  { pcCode: "PC-105", name: "CloudFirst", geo: "US", status: "Active", deals: 1, totalMrr: "₹15.0L", totalValue: "₹1.80Cr" },
  { pcCode: "PC-106", name: "EduPrime", geo: "India", status: "Active", deals: 1, totalMrr: "₹6.8L", totalValue: "₹81.6L" },
  { pcCode: "PC-107", name: "HealthPlus", geo: "India", status: "Paused", deals: 1, totalMrr: "₹4.5L", totalValue: "₹54.0L" },
  { pcCode: "PC-108", name: "AutoDrive", geo: "US", status: "Completed", deals: 1, totalMrr: "—", totalValue: "₹21.0L" },
];

export default function Clients() {
  const [search, setSearch] = useState("");
  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-subhead font-semibold tracking-tight text-foreground">Clients</h1>
          <p className="text-ui text-muted-foreground mt-1">{clients.length} clients</p>
        </div>
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/50 border-0 text-ui text-foreground placeholder:text-muted-foreground focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none transition-colors" />
        </div>
        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["PC Code", "Client", "GEO", "Deals", "Total MRR", "Total Value", "Status"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.pcCode} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-accent font-medium">{c.pcCode}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{c.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.geo}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.deals}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.totalMrr}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-foreground">{c.totalValue}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
