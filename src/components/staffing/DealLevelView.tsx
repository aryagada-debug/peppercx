import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";

const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const ragDot = (rag: string) => {
  const colors: Record<string, string> = { green: "bg-positive", amber: "bg-warning", red: "bg-destructive" };
  return <span className={cn("inline-block w-2 h-2 rounded-full", colors[rag] || "bg-muted-foreground")} />;
};

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
}

export function DealLevelView({ deals, people, assignments }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const personMap = useMemo(() => {
    const m: Record<string, Person> = {};
    people.forEach(p => { m[p.id] = p; });
    return m;
  }, [people]);

  const filtered = useMemo(() => {
    if (!search) return deals;
    const q = search.toLowerCase();
    return deals.filter(d => d.dealName.toLowerCase().includes(q) || d.account.toLowerCase().includes(q));
  }, [deals, search]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" />
      </div>

      <div className="data-card !p-0 overflow-hidden">
        <table className="w-full text-ui">
          <thead>
            <tr className="bg-accent/20 border-b border-border">
              <th className="w-8" />
              <th className="text-left py-2.5 px-3 text-caption uppercase tracking-wider text-muted-foreground font-medium">Account / Deal</th>
              <th className="text-left py-2.5 px-3 text-caption uppercase tracking-wider text-muted-foreground font-medium">Type</th>
              <th className="text-center py-2.5 px-3 text-caption uppercase tracking-wider text-muted-foreground font-medium">RAG</th>
              <th className="text-right py-2.5 px-3 text-caption uppercase tracking-wider text-muted-foreground font-medium">MRR</th>
              <th className="text-left py-2.5 px-3 text-caption uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              <th className="text-right py-2.5 px-3 text-caption uppercase tracking-wider text-muted-foreground font-medium">Team</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(deal => {
              const isExp = expanded.has(deal.id);
              const dealAssigns = assignments.filter(a => a.dealId === deal.id);
              const teamCount = new Set(dealAssigns.map(a => a.personId)).size;

              return (
                <tbody key={deal.id}>
                  <tr className={cn("border-b border-border/50 hover:bg-accent/10 cursor-pointer transition-colors", isExp && "bg-accent/10")} onClick={() => toggle(deal.id)}>
                    <td className="py-2.5 px-2 text-center">
                      {isExp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground inline" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground inline" />}
                    </td>
                    <td className="py-2.5 px-3">
                      <Link to={`/deals/${deal.id}`} className="text-primary hover:underline font-medium" onClick={e => e.stopPropagation()}>
                        {deal.dealName}
                      </Link>
                      <span className="block text-caption text-muted-foreground">{deal.account}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent text-accent-foreground">{deal.dealType}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">{ragDot(deal.rag || "green")}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmtCurrency(deal.mrr)}</td>
                    <td className="py-2.5 px-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-medium",
                        deal.dealStatus === "Active Deal" ? "text-positive bg-[hsl(var(--success-bg))]"
                        : deal.dealStatus === "Deal Churned / Lost" ? "text-destructive bg-destructive/10"
                        : deal.dealStatus === "Deal Disputed" ? "text-warning bg-warning/10"
                        : deal.dealStatus === "New Deal in SLA/PO" ? "text-accent bg-accent/10"
                        : "text-muted-foreground bg-secondary"
                      )}>{deal.dealStatus}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">{teamCount}</td>
                  </tr>
                  {isExp && dealAssigns.length > 0 && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div className="bg-accent/5 border-b border-border px-8 py-2">
                          <div className="grid grid-cols-4 gap-2 text-caption text-muted-foreground uppercase tracking-wider font-medium mb-1">
                            <span>Name</span><span>Role</span><span>Category</span><span className="text-right">Allocation</span>
                          </div>
                          {dealAssigns.map(a => {
                            const p = personMap[a.personId];
                            if (!p) return null;
                            return (
                              <div key={a.id} className="grid grid-cols-4 gap-2 py-1 text-ui">
                                <span className="text-foreground font-medium">{p.name}</span>
                                <span className="text-muted-foreground">{p.roleTitle || p.designation}</span>
                                <span><span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent text-accent-foreground">{p.roleCategory}</span></span>
                                <span className="text-right font-mono tabular-nums">{a.allocationPct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
