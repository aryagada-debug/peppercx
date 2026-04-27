import { useState, useMemo } from "react";
import { formatINR } from "@/lib/csvTargets";
import { cn } from "@/lib/utils";
import { Search, X, Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  ROLE_SLOTS, ROLE_TO_PEOPLE_FILTER, getBUCategories,
  type Deal, type Person, type StaffingAssignment, type RoleCategory, uid
} from "@/data/staffingData";

interface Props {
  deals: Deal[];
  allDeals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  editMode: boolean;
  onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void;
  onAddAssignment: (a: StaffingAssignment) => void;
  onUpdateAssignment: (id: string, updates: Partial<StaffingAssignment>) => void;
  onDeleteAssignment: (id: string) => void;
}

const fmtCurrency = (n: number | undefined) => {
  return formatINR(Number(n) || 0);
};

const RAG_COLORS = {
  green: "bg-positive",
  amber: "bg-warning",
  red: "bg-destructive",
};

const DEAL_MASTER_STATUSES = ["Active Deal", "Deal Completed Successfully", "Deal Churned / Lost", "Deal Disputed", "New Deal in SLA/PO", "New Deal", "Repeat Deal", "Pilot"];

export function AccountsTab({ deals, allDeals, people, assignments, editMode, onUpdateDeal, onAddAssignment, onUpdateAssignment, onDeleteAssignment }: Props) {
  const [search, setSearch] = useState("");
  const [vsdFilter, setVsdFilter] = useState("All");
  const [staffingFilter, setStaffingFilter] = useState("All");
  const [ragFilter, setRagFilter] = useState("All");
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const vsds = useMemo(() => ["All", ...Array.from(new Set(deals.map(d => d.vsd))).sort()], [deals]);

  const filtered = useMemo(() => {
    setCurrentPage(1);
    return deals.filter(d => {
      if (vsdFilter !== "All" && d.vsd !== vsdFilter) return false;
      if (staffingFilter !== "All" && d.staffingStatus !== staffingFilter) return false;
      if (ragFilter !== "All" && (d.rag || "green") !== ragFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!d.account.toLowerCase().includes(q) && !d.dealName.toLowerCase().includes(q) && !d.dealId.includes(search)) return false;
      }
      return true;
    });
  }, [deals, vsdFilter, staffingFilter, ragFilter, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getAssigns = (dealId: string) => assignments.filter(a => a.dealId === dealId);

  const cycleRag = (dealId: string, current: string) => {
    if (!editMode) return;
    const order = ["green", "amber", "red"];
    const next = order[(order.indexOf(current) + 1) % 3];
    onUpdateDeal(dealId, { rag: next });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search accounts, deals..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/50 border-0 text-ui text-foreground placeholder:text-muted-foreground focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" />
        </div>
        <select value={vsdFilter} onChange={e => setVsdFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground">
          {vsds.map(v => <option key={v} value={v}>{v === "All" ? "All VSDs" : v}</option>)}
        </select>
        <select value={staffingFilter} onChange={e => setStaffingFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground">
          <option value="All">All Staffing Status</option>
          <option value="Already Staffed">Staffed</option>
          <option value="Staffing Needed">Needed</option>
          <option value="No Staffing Needed">N/A</option>
        </select>
        <select value={ragFilter} onChange={e => setRagFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground">
          <option value="All">All RAG</option>
          <option value="green">🟢 Green</option>
          <option value="amber">🟡 Amber</option>
          <option value="red">🔴 Red</option>
        </select>
        <span className="text-caption text-muted-foreground ml-auto">{filtered.length} deals</span>
      </div>

      {/* Table */}
      <div className="data-card p-0 overflow-x-auto">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="py-2.5 px-3 w-8"></th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-[70px]">Deal ID</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[140px]">Account</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[100px]">VSD</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[100px]">BU</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-[80px]">MRR</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-[80px]">Staffing</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[220px]">Team</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(deal => {
              const isExpanded = expandedDealId === deal.id;
              const dealAssigns = getAssigns(deal.id);
              const rag = deal.rag || "green";

              return (
                <>
                  <tr key={deal.id} className={cn("border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer", isExpanded && "bg-accent/5")}
                    onClick={() => setExpandedDealId(isExpanded ? null : deal.id)}>
                    <td className="py-2 px-3">
                      <button onClick={e => { e.stopPropagation(); cycleRag(deal.id, rag); }}
                        className={cn("w-3 h-3 rounded-full transition-colors", RAG_COLORS[rag as keyof typeof RAG_COLORS] || "bg-positive")}
                        title={`Health: ${rag}`} />
                    </td>
                    <td className="py-2 px-3 font-mono text-accent font-medium">{deal.dealId}</td>
                    <td className="py-2 px-3 font-medium text-foreground truncate max-w-[160px]" title={deal.account}>{deal.account}</td>
                    <td className="py-2 px-3 text-caption text-muted-foreground">{deal.vsd}</td>
                    <td className="py-2 px-3 text-caption text-muted-foreground truncate max-w-[100px]">{deal.businessUnit || "—"}</td>
                    <td className="py-2 px-3 text-right font-mono text-foreground">{fmtCurrency(deal.mrr)}</td>
                    <td className="py-2 px-3">
                      <span className={cn("px-1.5 py-0.5 rounded text-caption font-medium",
                        deal.staffingStatus === "Already Staffed" ? "bg-positive/10 text-positive" :
                        deal.staffingStatus === "Staffing Needed" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      )}>{deal.staffingStatus === "Already Staffed" ? "Staffed" : deal.staffingStatus === "Staffing Needed" ? "Gap" : "N/A"}</span>
                    </td>
                    <td className="py-2 px-3">
                      {dealAssigns.length > 0 ? (
                        <div className="flex items-center gap-1 overflow-hidden max-w-[280px]">
                          {dealAssigns.slice(0, 4).map(a => {
                            const person = people.find(p => p.id === a.personId);
                            if (!person) return null;
                            return (
                              <span key={a.id} className={cn(
                                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0",
                                person.tbh ? "bg-warning/10 text-warning" : person.leaving ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"
                              )}>
                                <span className="truncate max-w-[50px]">{person.name}</span>
                                {a.allocationPct > 0 && <span className="font-mono text-muted-foreground">{a.allocationPct}%</span>}
                              </span>
                            );
                          })}
                          {dealAssigns.length > 4 && <span className="text-[10px] text-muted-foreground">+{dealAssigns.length - 4}</span>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">No team</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${deal.id}-expand`}>
                      <td colSpan={8} className="p-0">
                        <DealExpandedView
                          deal={deal}
                          people={people}
                          assignments={assignments}
                          editMode={editMode}
                          onAddAssignment={onAddAssignment}
                          onUpdateAssignment={onUpdateAssignment}
                          onDeleteAssignment={onDeleteAssignment}
                          onUpdateDeal={onUpdateDeal}
                          onClose={() => setExpandedDealId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-caption text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="h-8 px-3 rounded-md border border-border text-caption font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">Prev</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="h-8 px-3 rounded-md border border-border text-caption font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expanded Deal View ──────────────────────────────────────────────────────
function DealExpandedView({ deal, people, assignments, editMode, onAddAssignment, onUpdateAssignment, onDeleteAssignment, onUpdateDeal, onClose }: {
  deal: Deal;
  people: Person[];
  assignments: StaffingAssignment[];
  editMode: boolean;
  onAddAssignment: (a: StaffingAssignment) => void;
  onUpdateAssignment: (id: string, updates: Partial<StaffingAssignment>) => void;
  onDeleteAssignment: (id: string) => void;
  onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void;
  onClose: () => void;
}) {
  const dealCategories = getBUCategories(deal.businessUnit);
  const dealAssigns = assignments.filter(a => a.dealId === deal.id);

  // Person utilization across all assignments
  const personUtil = useMemo(() => {
    const map: Record<string, number> = {};
    assignments.forEach(a => { map[a.personId] = (map[a.personId] || 0) + a.allocationPct; });
    return map;
  }, [assignments]);

  return (
    <div className="bg-secondary/5 border-t border-b border-accent/20 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-ui font-semibold text-foreground">{deal.account} — {deal.dealName}</h4>
          <p className="text-caption text-muted-foreground">{deal.dealId} • {deal.dealType} • {deal.vsd}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {deal.mrr && (
              <div className="bg-card border border-border rounded-md px-3 py-1.5 text-center">
                <p className="text-[9px] text-muted-foreground uppercase">MRR</p>
                <p className="text-ui font-bold font-mono text-foreground">{fmtCurrency(deal.mrr)}</p>
              </div>
            )}
            {deal.totalDealValue && (
              <div className="bg-card border border-border rounded-md px-3 py-1.5 text-center">
                <p className="text-[9px] text-muted-foreground uppercase">Total DV</p>
                <p className="text-ui font-bold font-mono text-foreground">{fmtCurrency(deal.totalDealValue)}</p>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dealCategories.map(cat => {
          const catSlots = ROLE_SLOTS.filter(s => s.category === cat);
          return (
            <div key={cat} className="border border-border rounded-lg p-3 bg-card">
              <h5 className="text-caption font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h5>
              <div className="space-y-2">
                {catSlots.map(slot => {
                  const slotAssigns = dealAssigns.filter(a => a.roleKey === slot.roleKey);
                  const roleOpts = people.filter(p => {
                    const allowed = ROLE_TO_PEOPLE_FILTER[slot.roleKey];
                    return allowed ? allowed.includes(p.roleTitle) : true;
                  });

                  return (
                    <div key={slot.roleKey} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-caption text-muted-foreground">{slot.roleLabel}</span>
                        <span className="text-[10px] text-muted-foreground">{slotAssigns.length}</span>
                      </div>
                      {slotAssigns.map(a => {
                        const available = 100 - (personUtil[a.personId] || 0);
                        const person = people.find(p => p.id === a.personId);
                        return (
                          <div key={a.id} className="flex items-center gap-1.5 pl-2 py-0.5">
                            {editMode ? (
                              <>
                                <select className="h-7 px-1.5 rounded border border-border bg-card text-caption text-foreground max-w-[140px]"
                                  value={a.personId || ""} onChange={e => {
                                    if (!e.target.value) { onDeleteAssignment(a.id); return; }
                                    onUpdateAssignment(a.id, { personId: e.target.value });
                                  }}>
                                  <option value="">— None —</option>
                                  {roleOpts.filter(p => !p.leaving && !p.tbh).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  {roleOpts.filter(p => p.tbh).length > 0 && (
                                    <optgroup label="📋 TBH">
                                      {roleOpts.filter(p => p.tbh).map(p => <option key={p.id} value={p.id}>📋 {p.name}</option>)}
                                    </optgroup>
                                  )}
                                </select>
                                <input type="number" step="1" min="0" max="100"
                                  className="w-[44px] h-7 px-1 rounded border border-border bg-card text-caption font-mono text-foreground text-right"
                                  value={a.allocationPct} onChange={e => onUpdateAssignment(a.id, { allocationPct: parseFloat(e.target.value) || 0 })} />
                                <span className="text-muted-foreground text-[10px]">%</span>
                                <span className={cn("text-[10px] font-mono", available < 0 ? "text-destructive" : available < 20 ? "text-warning" : "text-muted-foreground")}>
                                  {available.toFixed(0)}% avail
                                </span>
                                <button onClick={() => onDeleteAssignment(a.id)} className="text-muted-foreground hover:text-destructive text-caption">✕</button>
                              </>
                            ) : (
                              <>
                                <span className={cn("text-caption font-medium", person?.leaving && "line-through text-muted-foreground", person?.tbh && "text-warning italic")}>
                                  {person?.name || "—"}
                                </span>
                                <span className="font-mono text-caption text-muted-foreground">{a.allocationPct}%</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {editMode && (
                        <button onClick={() => onAddAssignment({ id: uid(), dealId: deal.id, roleKey: slot.roleKey, personId: "", allocationPct: 0 })}
                          className="text-accent hover:text-accent/80 text-[10px] font-medium flex items-center gap-0.5 pl-2">
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}