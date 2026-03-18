import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Search, Plus, Filter, X, ChevronDown, UserPlus, Check } from "lucide-react";
import {
  DEFAULT_DEALS, DEFAULT_PEOPLE, DEFAULT_ASSIGNMENTS, ROLE_SLOTS, ROLE_CATEGORIES, ROLE_TO_PEOPLE_FILTER,
  DEPARTMENTS, BANDS,
  type Deal, type Person, type StaffingAssignment, type RoleCategory, uid
} from "@/data/staffingData";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtPct = (n: number) => n === 0 ? "—" : `${n.toFixed(n % 1 === 0 ? 0 : 2)}%`;

function PersonBadge({ person, pct, onRemove }: { person: Person | undefined; pct: number; onRemove?: () => void }) {
  if (!person) return <span className="text-caption text-muted-foreground">—</span>;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption font-medium max-w-[140px]",
      person.tbh ? "bg-warning/10 text-warning" : person.leaving ? "bg-destructive/10 text-destructive line-through" : "bg-secondary text-foreground"
    )}>
      <span className="truncate">{person.name}</span>
      <span className="text-muted-foreground font-mono tabular-nums">{fmtPct(pct)}</span>
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
      )}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Staffing() {
  const [activeView, setActiveView] = useState<"deals" | "people">("deals");
  const [deals] = useState<Deal[]>(DEFAULT_DEALS);
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [assignments, setAssignments] = useState<StaffingAssignment[]>(DEFAULT_ASSIGNMENTS);
  const [search, setSearch] = useState("");
  const [vsdFilter, setVsdFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<RoleCategory | "All">("All");
  const [staffingStatusFilter, setStaffingStatusFilter] = useState<string>("All");
  const [dealTypeFilter, setDealTypeFilter] = useState<string>("All");
  const [peopleCategoryTab, setPeopleCategoryTab] = useState<RoleCategory>(ROLE_CATEGORIES[0]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Add assignment modal state
  const [addModal, setAddModal] = useState<{ dealId: string; roleKey: string } | null>(null);
  const [addPersonModal, setAddPersonModal] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: "", roleCategory: "Content" as RoleCategory, roleTitle: "", pod: "", region: "India" });
  const [editingCell, setEditingCell] = useState<{ personId: string; field: string } | null>(null);

  // Edit allocation
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const vsds = useMemo(() => ["All", ...Array.from(new Set(deals.map(d => d.vsd))).sort()], [deals]);
  const filteredDeals = useMemo(() => {
    setCurrentPage(1);
    return deals.filter(d => {
      if (vsdFilter !== "All" && d.vsd !== vsdFilter) return false;
      if (staffingStatusFilter !== "All" && d.staffingStatus !== staffingStatusFilter) return false;
      if (dealTypeFilter !== "All" && d.dealType !== dealTypeFilter) return false;
      if (search && !d.account.toLowerCase().includes(search.toLowerCase()) && !d.dealName.toLowerCase().includes(search.toLowerCase()) && !d.dealId.includes(search)) return false;
      return true;
    });
  }, [deals, vsdFilter, staffingStatusFilter, dealTypeFilter, search]);

  const totalPages = Math.ceil(filteredDeals.length / pageSize);
  const paginatedDeals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDeals.slice(start, start + pageSize);
  }, [filteredDeals, currentPage]);

  const visibleSlots = useMemo(() => {
    if (categoryFilter === "All") return ROLE_SLOTS;
    return ROLE_SLOTS.filter(s => s.category === categoryFilter);
  }, [categoryFilter]);

  const getAssignments = (dealId: string, roleKey: string) => assignments.filter(a => a.dealId === dealId && a.roleKey === roleKey);
  const getPerson = (id: string) => people.find(p => p.id === id);

  const removeAssignment = (id: string) => setAssignments(prev => prev.filter(a => a.id !== id));

  const updateAllocation = (id: string, newPct: number) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, allocationPct: newPct } : a));
    setEditingAssignment(null);
  };

  const addAssignment = (dealId: string, roleKey: string, personId: string) => {
    setAssignments(prev => [...prev, { id: uid(), dealId, roleKey, personId, allocationPct: 0 }]);
    setAddModal(null);
  };

  const addNewPerson = () => {
    const id = `p_new_${uid()}`;
    setPeople(prev => [...prev, { id, ...newPerson, leaving: false, tbh: false, department: "", designation: "", reportingManager: "", band: "" }]);
    setNewPerson({ name: "", roleCategory: "Content", roleTitle: "", pod: "", region: "India" });
    setAddPersonModal(false);
  };

  const updatePerson = (personId: string, field: keyof Person, value: string) => {
    setPeople(prev => prev.map(p => p.id === personId ? { ...p, [field]: value } : p));
    setEditingCell(null);
  };

  const allDesignations = useMemo(() => [...new Set(people.map(p => p.designation).filter(Boolean))].sort(), [people]);
  const allManagers = useMemo(() => [...new Set(people.map(p => p.name))].sort(), [people]);

  // People view: utilization per person
  const personUtilization = useMemo(() => {
    const map: Record<string, { totalPct: number; dealCount: number; deals: { dealId: string; account: string; roleKey: string; pct: number }[] }> = {};
    people.forEach(p => { map[p.id] = { totalPct: 0, dealCount: 0, deals: [] }; });
    assignments.forEach(a => {
      if (map[a.personId]) {
        map[a.personId].totalPct += a.allocationPct;
        const deal = deals.find(d => d.id === a.dealId);
        if (deal) {
          map[a.personId].deals.push({ dealId: a.dealId, account: deal.account, roleKey: a.roleKey, pct: a.allocationPct });
          map[a.personId].dealCount = new Set(map[a.personId].deals.map(d => d.dealId)).size;
        }
      }
    });
    return map;
  }, [assignments, people, deals]);

  const filteredPeople = useMemo(() => people.filter(p => p.roleCategory === peopleCategoryTab), [people, peopleCategoryTab]);

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-subhead font-semibold tracking-tight text-foreground">Staffing & Capacity</h1>
            <p className="text-ui text-muted-foreground mt-1">{deals.length} deals • {people.filter(p => !p.tbh).length} people • {assignments.length} assignments</p>
          </div>
          <button onClick={() => setAddPersonModal(true)} className="h-9 px-4 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add Person
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {(["deals", "people"] as const).map(v => (
            <button key={v} onClick={() => setActiveView(v)} className={cn(
              "px-4 py-2.5 text-ui font-medium border-b-2 transition-colors capitalize",
              activeView === v ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{v === "deals" ? "Deal-Level Staffing" : "People by Role"}</button>
          ))}
        </div>

        {/* ═══════════════ DEALS VIEW ═══════════════ */}
        {activeView === "deals" && (
          <>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search accounts, deals..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/50 border-0 text-ui text-foreground placeholder:text-muted-foreground focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none transition-colors" />
              </div>
              <select value={vsdFilter} onChange={e => setVsdFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground">
                {vsds.map(v => <option key={v} value={v}>{v === "All" ? "All VSDs" : v}</option>)}
              </select>
              <select value={staffingStatusFilter} onChange={e => setStaffingStatusFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground">
                <option value="All">All Staffing Status</option>
                <option value="Already Staffed">Already Staffed</option>
                <option value="Staffing Needed">Staffing Needed</option>
                <option value="No Staffing Needed">No Staffing Needed</option>
              </select>
              <select value={dealTypeFilter} onChange={e => setDealTypeFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground">
                <option value="All">All Types</option>
                <option value="Retainer">Retainer</option>
                <option value="Non-Retainer">Non-Retainer</option>
                <option value="Pilot">Pilot</option>
              </select>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)} className="h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground">
                <option value="All">All Role Categories</option>
                {ROLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-caption text-muted-foreground ml-auto">{filteredDeals.length} deals</span>
            </div>

            <div className="data-card p-0 overflow-x-auto">
              <table className="text-ui min-w-max">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider sticky left-0 bg-secondary/30 z-10 min-w-[80px]">Deal ID</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider sticky left-[80px] bg-secondary/30 z-10 min-w-[140px]">Account</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[100px]">VSD</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[80px]">Type</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[90px]">Staffing</th>
                    {visibleSlots.map(slot => (
                      <th key={slot.roleKey} className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[160px] whitespace-nowrap">
                        <div>{slot.roleLabel}</div>
                        <div className="text-[10px] font-normal text-muted-foreground/70 normal-case">{slot.category}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeals.map(deal => (
                    <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="py-2 px-3 font-mono text-accent font-medium sticky left-0 bg-card z-10">{deal.dealId}</td>
                      <td className="py-2 px-3 font-medium text-foreground sticky left-[80px] bg-card z-10 truncate max-w-[140px]" title={`${deal.account} — ${deal.dealName}`}>{deal.account}</td>
                      <td className="py-2 px-3 text-muted-foreground truncate">{deal.vsd.split(" ")[0]}</td>
                      <td className="py-2 px-3"><span className={cn("px-1.5 py-0.5 rounded text-caption font-medium", deal.dealType === "Retainer" ? "bg-positive/10 text-positive" : deal.dealType === "Pilot" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent")}>{deal.dealType}</span></td>
                      <td className="py-2 px-3"><span className={cn("px-1.5 py-0.5 rounded text-caption font-medium", deal.staffingStatus === "Already Staffed" ? "bg-positive/10 text-positive" : deal.staffingStatus === "Staffing Needed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{deal.staffingStatus === "Already Staffed" ? "Staffed" : deal.staffingStatus === "Staffing Needed" ? "Needed" : "N/A"}</span></td>
                      {visibleSlots.map(slot => {
                        const slotAssignments = getAssignments(deal.id, slot.roleKey);
                        return (
                          <td key={slot.roleKey} className="py-2 px-3">
                            <div className="flex flex-col gap-1">
                              {slotAssignments.map(a => (
                                <div key={a.id} className="flex items-center gap-1">
                                  {editingAssignment === a.id ? (
                                    <input
                                      type="number" step="0.25" className="w-14 h-6 px-1 rounded border border-accent text-caption font-mono bg-card text-foreground"
                                      value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                                      onBlur={() => updateAllocation(a.id, parseFloat(editValue) || 0)}
                                      onKeyDown={e => { if (e.key === "Enter") updateAllocation(a.id, parseFloat(editValue) || 0); if (e.key === "Escape") setEditingAssignment(null); }}
                                    />
                                  ) : (
                                    <div onClick={() => { setEditingAssignment(a.id); setEditValue(String(a.allocationPct)); }} className="cursor-pointer">
                                      <PersonBadge person={getPerson(a.personId)} pct={a.allocationPct} onRemove={() => removeAssignment(a.id)} />
                                    </div>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => setAddModal({ dealId: deal.id, roleKey: slot.roleKey })} className="text-accent hover:text-accent/80 text-caption flex items-center gap-0.5 mt-0.5">
                                <Plus className="h-3 w-3" /> Staff
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-caption text-muted-foreground">Page {currentPage} of {totalPages} ({filteredDeals.length} deals)</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="h-8 px-3 rounded-md border border-border text-caption font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">Prev</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 7) page = i + 1;
                    else if (currentPage <= 4) page = i + 1;
                    else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                    else page = currentPage - 3 + i;
                    return (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={cn("h-8 w-8 rounded-md text-caption font-medium transition-colors", currentPage === page ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>{page}</button>
                    );
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="h-8 px-3 rounded-md border border-border text-caption font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════ PEOPLE VIEW ═══════════════ */}
        {activeView === "people" && (
          <>
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {ROLE_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setPeopleCategoryTab(cat)} className={cn(
                  "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                  peopleCategoryTab === cat ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                )}>{cat}</button>
              ))}
            </div>

            <div className="data-card p-0 overflow-x-auto">
              <table className="w-full text-ui min-w-[1100px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Name", "Department", "Designation", "Reporting Manager", "Band", "Deals", "Total Alloc.", "Status"].map(h => (
                      <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.map(p => {
                    const util = personUtilization[p.id] || { totalPct: 0, dealCount: 0, deals: [] };
                    const isEditing = (field: string) => editingCell?.personId === p.id && editingCell?.field === field;
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          <span className={cn(p.leaving && "line-through text-muted-foreground", p.tbh && "text-warning italic")}>{p.name}</span>
                        </td>
                        {/* Department */}
                        <td className="py-2 px-4">
                          {isEditing("department") ? (
                            <select autoFocus value={p.department || ""} onChange={e => updatePerson(p.id, "department", e.target.value)} onBlur={() => setEditingCell(null)}
                              className="h-8 w-full px-2 rounded border border-accent bg-card text-ui text-foreground">
                              <option value="">—</option>
                              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          ) : (
                            <span onClick={() => setEditingCell({ personId: p.id, field: "department" })} className="cursor-pointer text-muted-foreground hover:text-foreground text-caption truncate block max-w-[160px]" title={p.department}>{p.department || "—"}</span>
                          )}
                        </td>
                        {/* Designation */}
                        <td className="py-2 px-4">
                          {isEditing("designation") ? (
                            <select autoFocus value={p.designation || ""} onChange={e => updatePerson(p.id, "designation", e.target.value)} onBlur={() => setEditingCell(null)}
                              className="h-8 w-full px-2 rounded border border-accent bg-card text-ui text-foreground">
                              <option value="">—</option>
                              {allDesignations.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          ) : (
                            <span onClick={() => setEditingCell({ personId: p.id, field: "designation" })} className="cursor-pointer text-muted-foreground hover:text-foreground text-caption truncate block max-w-[180px]" title={p.designation}>{p.designation || "—"}</span>
                          )}
                        </td>
                        {/* Reporting Manager */}
                        <td className="py-2 px-4">
                          {isEditing("reportingManager") ? (
                            <select autoFocus value={p.reportingManager || ""} onChange={e => updatePerson(p.id, "reportingManager", e.target.value)} onBlur={() => setEditingCell(null)}
                              className="h-8 w-full px-2 rounded border border-accent bg-card text-ui text-foreground">
                              <option value="">—</option>
                              {allManagers.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          ) : (
                            <span onClick={() => setEditingCell({ personId: p.id, field: "reportingManager" })} className="cursor-pointer text-muted-foreground hover:text-foreground text-caption">{p.reportingManager || "—"}</span>
                          )}
                        </td>
                        {/* Band */}
                        <td className="py-2 px-4">
                          {isEditing("band") ? (
                            <select autoFocus value={p.band || ""} onChange={e => updatePerson(p.id, "band", e.target.value)} onBlur={() => setEditingCell(null)}
                              className="h-8 w-20 px-2 rounded border border-accent bg-card text-ui text-foreground">
                              <option value="">—</option>
                              {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          ) : (
                            <span onClick={() => setEditingCell({ personId: p.id, field: "band" })} className={cn("cursor-pointer font-mono text-caption font-medium px-1.5 py-0.5 rounded", p.band ? "bg-accent/10 text-accent" : "text-muted-foreground")}>{p.band || "—"}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-foreground">{util.dealCount}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-sm overflow-hidden">
                              <div className={cn("h-full rounded-sm", util.totalPct > 100 ? "bg-destructive" : util.totalPct > 80 ? "bg-warning" : "bg-positive")} style={{ width: `${Math.min(util.totalPct, 100)}%` }} />
                            </div>
                            <span className={cn("font-mono tabular-nums text-caption font-medium", util.totalPct > 100 ? "text-destructive" : util.totalPct > 80 ? "text-warning" : "text-positive")}>{fmtPct(util.totalPct)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {p.tbh ? <span className="px-1.5 py-0.5 rounded text-caption font-medium bg-warning/10 text-warning">TBH</span>
                            : p.leaving ? <span className="px-1.5 py-0.5 rounded text-caption font-medium bg-destructive/10 text-destructive">Leaving</span>
                            : <span className="px-1.5 py-0.5 rounded text-caption font-medium bg-positive/10 text-positive">Active</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ═══════════════ ADD ASSIGNMENT MODAL ═══════════════ */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={() => setAddModal(null)}>
          <div className="bg-card border border-border rounded-lg p-6 w-[400px] max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-ui font-semibold text-foreground">Staff Person</h3>
              <button onClick={() => setAddModal(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <p className="text-caption text-muted-foreground mb-3">
              Deal: {deals.find(d => d.id === addModal.dealId)?.account} • Role: {ROLE_SLOTS.find(s => s.roleKey === addModal.roleKey)?.roleLabel}
            </p>
            <div className="space-y-1">
              {people.filter(p => {
                if (p.leaving) return false;
                const allowedTitles = ROLE_TO_PEOPLE_FILTER[addModal.roleKey];
                if (allowedTitles) {
                  return allowedTitles.includes(p.roleTitle);
                }
                return true;
              }).map(p => (
                <button key={p.id} onClick={() => addAssignment(addModal.dealId, addModal.roleKey, p.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary transition-colors flex items-center justify-between">
                  <div>
                    <span className={cn("text-ui font-medium", p.tbh && "text-warning italic")}>{p.name}</span>
                    <span className="text-caption text-muted-foreground ml-2">{p.roleTitle}</span>
                  </div>
                  <span className={cn("text-caption font-mono tabular-nums",
                    (personUtilization[p.id]?.totalPct || 0) > 100 ? "text-destructive" :
                    (personUtilization[p.id]?.totalPct || 0) > 80 ? "text-warning" : "text-muted-foreground"
                  )}>{fmtPct(personUtilization[p.id]?.totalPct || 0)}</span>
                </button>
              ))}
              {people.filter(p => !p.leaving && (ROLE_TO_PEOPLE_FILTER[addModal.roleKey]?.includes(p.roleTitle) ?? true)).length === 0 && (
                <p className="text-caption text-muted-foreground py-4 text-center">No matching people for this role</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ADD PERSON MODAL ═══════════════ */}
      {addPersonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={() => setAddPersonModal(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-[400px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-ui font-semibold text-foreground">Add New Person</h3>
              <button onClick={() => setAddPersonModal(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-caption text-muted-foreground font-medium">Name</label>
                <input type="text" value={newPerson.name} onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" placeholder="Full name" />
              </div>
              <div>
                <label className="text-caption text-muted-foreground font-medium">Role Category</label>
                <select value={newPerson.roleCategory} onChange={e => setNewPerson(p => ({ ...p, roleCategory: e.target.value as RoleCategory }))}
                  className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                  {ROLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-caption text-muted-foreground font-medium">Role Title</label>
                <input type="text" value={newPerson.roleTitle} onChange={e => setNewPerson(p => ({ ...p, roleTitle: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" placeholder="e.g. SEO Manager" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Pod</label>
                  <input type="text" value={newPerson.pod} onChange={e => setNewPerson(p => ({ ...p, pod: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" placeholder="Pod name" />
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Region</label>
                  <select value={newPerson.region} onChange={e => setNewPerson(p => ({ ...p, region: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    <option>India</option><option>US</option><option>UAE</option>
                  </select>
                </div>
              </div>
              <button onClick={addNewPerson} disabled={!newPerson.name || !newPerson.roleTitle}
                className="w-full h-9 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 disabled:opacity-50 transition-opacity mt-2">
                Add Person
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
