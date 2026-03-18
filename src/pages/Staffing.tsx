import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Search, Plus, X, UserPlus, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import {
  DEFAULT_DEALS, DEFAULT_PEOPLE, DEFAULT_ASSIGNMENTS, DEFAULT_HIRING_NEEDS, DEFAULT_REVENUE_TARGETS,
  ROLE_SLOTS, ROLE_CATEGORIES, ROLE_TO_PEOPLE_FILTER, DEPARTMENTS, BANDS, BU_ROLE_CATEGORIES, getBUCategories,
  type Deal, type Person, type StaffingAssignment, type RoleCategory, type HiringNeed, type RevenueCapacityTarget, uid
} from "@/data/staffingData";
import { SummaryTab } from "@/components/staffing/SummaryTab";
import { CapacityTab } from "@/components/staffing/CapacityTab";
import { HiringGapTab } from "@/components/staffing/HiringGapTab";
import { RevenueCapacityTab } from "@/components/staffing/RevenueCapacityTab";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtPct = (n: number) => n === 0 ? "—" : `${n.toFixed(n % 1 === 0 ? 0 : 2)}%`;
const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

type TabKey = "summary" | "accounts" | "people" | "capacity" | "hiring" | "revenue";
const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "accounts", label: "Accounts" },
  { key: "people", label: "People" },
  { key: "capacity", label: "Capacity" },
  { key: "hiring", label: "Hiring Gap" },
  { key: "revenue", label: "Revenue Capacity" },
];

const DEAL_MASTER_STATUSES = ["Active Deal", "Deal Completed Successfully", "Deal Churned / Lost", "Deal Disputed", "New Deal in SLA/PO", "New Deal", "Repeat Deal", "Pilot"];

function PersonSel({ value, opts, onChange }: { value: string; opts: Person[]; onChange: (id: string) => void }) {
  const real = opts.filter(p => !p.leaving && !p.tbh);
  const leavers = opts.filter(p => p.leaving && !p.tbh);
  const tbhs = opts.filter(p => p.tbh);
  return (
    <select className="h-7 px-1.5 rounded border border-border bg-card text-caption text-foreground max-w-[160px]"
      value={value || ""} onChange={e => onChange(e.target.value)}>
      <option value="">— None —</option>
      {real.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      {leavers.length > 0 && <optgroup label="⚠ Leaving Soon">{leavers.map(p => <option key={p.id} value={p.id}>⚠ {p.name}</option>)}</optgroup>}
      {tbhs.length > 0 && <optgroup label="📋 TBH / Open Roles">{tbhs.map(p => <option key={p.id} value={p.id}>📋 TBH – {p.name}</option>)}</optgroup>}
    </select>
  );
}

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
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [deals, setDeals] = useState<Deal[]>(DEFAULT_DEALS);
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [assignments, setAssignments] = useState<StaffingAssignment[]>(DEFAULT_ASSIGNMENTS);
  const [hiringNeeds, setHiringNeeds] = useState<HiringNeed[]>(DEFAULT_HIRING_NEEDS);
  const [revenueTargets, setRevenueTargets] = useState<RevenueCapacityTarget[]>(DEFAULT_REVENUE_TARGETS);

  const [search, setSearch] = useState("");
  const [vsdFilter, setVsdFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<RoleCategory | "All">("All");
  const [staffingStatusFilter, setStaffingStatusFilter] = useState<string>("All");
  const [dealTypeFilter, setDealTypeFilter] = useState<string>("All");
  // Shared filters
  const [designationFilter, setDesignationFilter] = useState<string>("All");
  const [bandFilter, setBandFilter] = useState<string>("All");
  const [managerFilter, setManagerFilter] = useState<string>("All");

  const [peopleCategoryTab, setPeopleCategoryTab] = useState<RoleCategory>(ROLE_CATEGORIES[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  // Inline deal expand instead of modal
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [inlineStaffRole, setInlineStaffRole] = useState<string | null>(null);
  const [addPersonModal, setAddPersonModal] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [newPerson, setNewPerson] = useState<Omit<Person, "id" | "leaving" | "tbh">>({
    name: "", roleCategory: "Content", roleTitle: "", pod: "", region: "India",
    department: "", designation: "", reportingManager: "", band: "",
  });
  const [editingCell, setEditingCell] = useState<{ personId: string; field: string } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const vsds = useMemo(() => ["All", ...Array.from(new Set(deals.map(d => d.vsd))).sort()], [deals]);
  const allDesignations = useMemo(() => ["All", ...[...new Set(people.map(p => p.designation).filter(Boolean))].sort()], [people]);
  const allManagers = useMemo(() => ["All", ...[...new Set(people.map(p => p.name))].sort()], [people]);
  const allBands = ["All", ...BANDS];
  const uniqueBusinessUnits = useMemo(() => [...new Set(deals.map(d => d.businessUnit).filter(Boolean))].sort(), [deals]);
  const uniqueCapabilityLines = useMemo(() => [...new Set(deals.map(d => d.capabilityLine).filter(Boolean))].sort(), [deals]);

  const updateDeal = (dealId: string, field: keyof Deal, value: string) => {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, [field]: value } : d));
  };

  const filteredDeals = useMemo(() => {
    setCurrentPage(1);
    return deals.filter(d => {
      if (vsdFilter !== "All" && d.vsd !== vsdFilter) return false;
      if (staffingStatusFilter !== "All" && d.staffingStatus !== staffingStatusFilter) return false;
      if (dealTypeFilter !== "All" && d.dealType !== dealTypeFilter) return false;
      if (search && !d.account.toLowerCase().includes(search.toLowerCase()) && !d.dealName.toLowerCase().includes(search.toLowerCase()) && !d.dealId.includes(search)) return false;
      if (designationFilter !== "All" || bandFilter !== "All" || managerFilter !== "All") {
        const dealAssigns = assignments.filter(a => a.dealId === d.id);
        const assignedPeople = dealAssigns.map(a => people.find(p => p.id === a.personId)).filter(Boolean) as Person[];
        if (designationFilter !== "All" && !assignedPeople.some(p => p.designation === designationFilter)) return false;
        if (bandFilter !== "All" && !assignedPeople.some(p => p.band === bandFilter)) return false;
        if (managerFilter !== "All" && !assignedPeople.some(p => p.reportingManager === managerFilter)) return false;
      }
      return true;
    });
  }, [deals, vsdFilter, staffingStatusFilter, dealTypeFilter, search, designationFilter, bandFilter, managerFilter, assignments, people]);

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
    setInlineStaffRole(null);
  };

  const addNewPerson = () => {
    const id = `p_new_${uid()}`;
    setPeople(prev => [...prev, { id, ...newPerson, leaving: false, tbh: false }]);
    setNewPerson({ name: "", roleCategory: "Content", roleTitle: "", pod: "", region: "India", department: "", designation: "", reportingManager: "", band: "" });
    setAddPersonModal(false);
  };

  const saveEditPerson = () => {
    if (!editPersonId) return;
    setPeople(prev => prev.map(p => p.id === editPersonId ? { ...p, ...newPerson } : p));
    setEditPersonId(null);
    setAddPersonModal(false);
  };

  const startEditPerson = (p: Person) => {
    setEditPersonId(p.id);
    setNewPerson({
      name: p.name, roleCategory: p.roleCategory, roleTitle: p.roleTitle, pod: p.pod, region: p.region,
      department: p.department || "", designation: p.designation || "", reportingManager: p.reportingManager || "", band: p.band || "",
    });
    setAddPersonModal(true);
  };

  const updatePerson = (personId: string, field: keyof Person, value: string) => {
    setPeople(prev => prev.map(p => p.id === personId ? { ...p, [field]: value } : p));
    setEditingCell(null);
  };

  // Person utilization
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

  const filteredPeople = useMemo(() => people.filter(p => {
    if (p.roleCategory !== peopleCategoryTab) return false;
    if (designationFilter !== "All" && p.designation !== designationFilter) return false;
    if (bandFilter !== "All" && p.band !== bandFilter) return false;
    if (managerFilter !== "All" && p.reportingManager !== managerFilter) return false;
    return true;
  }), [people, peopleCategoryTab, designationFilter, bandFilter, managerFilter]);

  const FilterBar = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={designationFilter} onChange={e => setDesignationFilter(e.target.value)} className="h-8 px-2 rounded-md border border-border bg-card text-caption text-foreground">
        <option value="All">All Designations</option>
        {allDesignations.filter(d => d !== "All").map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={bandFilter} onChange={e => setBandFilter(e.target.value)} className="h-8 px-2 rounded-md border border-border bg-card text-caption text-foreground">
        {allBands.map(b => <option key={b} value={b}>{b === "All" ? "All Bands" : b}</option>)}
      </select>
      <select value={managerFilter} onChange={e => setManagerFilter(e.target.value)} className="h-8 px-2 rounded-md border border-border bg-card text-caption text-foreground">
        <option value="All">All Managers</option>
        {allManagers.filter(m => m !== "All").map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      {(designationFilter !== "All" || bandFilter !== "All" || managerFilter !== "All") && (
        <button onClick={() => { setDesignationFilter("All"); setBandFilter("All"); setManagerFilter("All"); }}
          className="h-8 px-2 text-caption text-muted-foreground hover:text-foreground flex items-center gap-1">
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );

  // Inline deal expand: get all role categories and their slots for a deal
  const renderDealExpand = (deal: Deal) => {
    const categories = ROLE_CATEGORIES.filter(cat => {
      const catSlots = ROLE_SLOTS.filter(s => s.category === cat);
      return catSlots.some(s => {
        const a = getAssignments(deal.id, s.roleKey);
        return a.length > 0 || (cat === "Operations" || (deal.seoStaffing && cat === "SEO") || (deal.creativeStaffing && (cat === "Creative Art" || cat === "Creative Copy" || cat === "Creative Strategy")));
      }) || cat === "Operations"; // Always show Operations
    });

    return (
      <tr key={`${deal.id}-expand`}>
        <td colSpan={14 + visibleSlots.length} className="p-0">
          <div className="bg-secondary/5 border-t border-b border-accent/20 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-ui font-semibold text-foreground">{deal.account} — {deal.dealName}</h4>
                <p className="text-caption text-muted-foreground">{deal.dealId} • {deal.dealType} • {deal.vsd}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Revenue cards */}
                <div className="flex items-center gap-3">
                  <div className="bg-card border border-border rounded-md px-3 py-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase">MRR</p>
                    <p className="text-ui font-bold font-mono text-foreground">{fmtCurrency(deal.mrr)}</p>
                  </div>
                  <div className="bg-card border border-border rounded-md px-3 py-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase">Total DV</p>
                    <p className="text-ui font-bold font-mono text-foreground">{fmtCurrency(deal.totalDealValue)}</p>
                  </div>
                </div>
                <button onClick={() => setExpandedDealId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ROLE_CATEGORIES.map(cat => {
                const catSlots = ROLE_SLOTS.filter(s => s.category === cat);
                const hasAssignment = catSlots.some(s => getAssignments(deal.id, s.roleKey).length > 0);
                if (!hasAssignment && cat !== "Operations") return null;

                return (
                  <div key={cat} className="border border-border rounded-lg p-3 bg-card">
                    <h5 className="text-caption font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h5>
                    <div className="space-y-2">
                      {catSlots.map(slot => {
                        const slotAssigns = getAssignments(deal.id, slot.roleKey);
                        const roleOpts = people.filter(p => {
                          const allowedTitles = ROLE_TO_PEOPLE_FILTER[slot.roleKey];
                          if (allowedTitles) return allowedTitles.includes(p.roleTitle);
                          return true;
                        });

                        return (
                          <div key={slot.roleKey} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-caption text-muted-foreground">{slot.roleLabel}</span>
                              <span className="text-[10px] text-muted-foreground">{slotAssigns.length} assigned</span>
                            </div>
                            {slotAssigns.map(a => {
                              const util = personUtilization[a.personId];
                              const available = 100 - (util?.totalPct || 0);
                              return (
                                <div key={a.id} className="flex items-center gap-1.5 pl-2 py-0.5">
                                  <PersonSel value={a.personId} opts={roleOpts} onChange={v => {
                                    if (!v) { removeAssignment(a.id); return; }
                                    setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, personId: v } : x));
                                  }} />
                                  <div className="flex items-center gap-0.5">
                                    <input type="number" step="1" min="0" max="100"
                                      className="w-[44px] h-7 px-1 rounded border border-border bg-card text-caption font-mono text-foreground text-right"
                                      value={a.allocationPct} onChange={e => updateAllocation(a.id, parseFloat(e.target.value) || 0)} />
                                    <span className="text-muted-foreground text-[10px]">%</span>
                                  </div>
                                  <span className={cn("text-[10px] font-mono", available < 0 ? "text-destructive" : available < 20 ? "text-warning" : "text-muted-foreground")}>
                                    {available.toFixed(0)}% avail
                                  </span>
                                  <button onClick={() => removeAssignment(a.id)} className="text-muted-foreground hover:text-destructive text-caption">✕</button>
                                </div>
                              );
                            })}
                            <button onClick={() => addAssignment(deal.id, slot.roleKey, "")}
                              className="text-accent hover:text-accent/80 text-[10px] font-medium flex items-center gap-0.5 pl-2">
                              <Plus className="h-3 w-3" /> Add
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-subhead font-semibold tracking-tight text-foreground">Staffing & Capacity</h1>
            <p className="text-ui text-muted-foreground mt-1">{deals.length} deals • {people.filter(p => !p.tbh).length} people • {assignments.length} assignments</p>
          </div>
          <button onClick={() => { setEditPersonId(null); setNewPerson({ name: "", roleCategory: "Content", roleTitle: "", pod: "", region: "India", department: "", designation: "", reportingManager: "", band: "" }); setAddPersonModal(true); }}
            className="h-9 px-4 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add Person
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn(
              "px-4 py-2.5 text-ui font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{t.label}</button>
          ))}
        </div>

        {/* ═══════════════ SUMMARY ═══════════════ */}
        {activeTab === "summary" && (
          <SummaryTab deals={deals} people={people} assignments={assignments} />
        )}

        {/* ═══════════════ ACCOUNTS ═══════════════ */}
        {activeTab === "accounts" && (
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
            <div className="mb-3">
              <FilterBar />
            </div>

            <div className="data-card p-0 overflow-x-auto">
              <table className="text-ui min-w-max">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider sticky left-0 bg-secondary/30 z-10 min-w-[80px]">Deal ID</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[80px]">PC Code</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[140px]">Business Unit</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[150px]">Capability Line</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider sticky left-[80px] bg-secondary/30 z-10 min-w-[140px]">Account</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[150px]">Deal Name</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[130px]">Deal Status</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[80px]">MRR</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[80px]">Duration</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[90px]">Retainer</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[90px]">Non-Ret.</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[90px]">Total DV</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[80px]">Type</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[90px]">Staffing</th>
                    {visibleSlots.map(slot => (
                      <th key={slot.roleKey} className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[200px] whitespace-nowrap">
                        <div>{slot.roleLabel}</div>
                        <div className="text-[10px] font-normal text-muted-foreground/70 normal-case">{slot.category}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeals.map(deal => {
                    const isExpanded = expandedDealId === deal.id;
                    return (
                      <>
                        <tr key={deal.id} className={cn("border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer", isExpanded && "bg-accent/5")}
                          onClick={() => setExpandedDealId(isExpanded ? null : deal.id)}>
                          <td className="py-2 px-3 font-mono text-accent font-medium sticky left-0 bg-card z-10">{deal.dealId}</td>
                          {/* PC Code - click to edit */}
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            {editingCell?.personId === deal.id && editingCell?.field === "pcCode" ? (
                              <input type="text" className="w-full h-7 px-2 rounded border border-accent bg-card text-caption text-foreground" autoFocus
                                value={editValue} onChange={e => setEditValue(e.target.value)}
                                onBlur={() => { updateDeal(deal.id, "pcCode", editValue); setEditingCell(null); }}
                                onKeyDown={e => { if (e.key === "Enter") { updateDeal(deal.id, "pcCode", editValue); setEditingCell(null); } if (e.key === "Escape") setEditingCell(null); }} />
                            ) : (
                              <span onClick={() => { setEditingCell({ personId: deal.id, field: "pcCode" }); setEditValue(deal.pcCode || ""); }}
                                className="cursor-pointer text-caption text-muted-foreground hover:text-foreground">{deal.pcCode || "—"}</span>
                            )}
                          </td>
                          {/* Business Unit - dropdown */}
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            <select className="h-7 px-1.5 rounded border border-border bg-card text-caption text-foreground max-w-[140px]"
                              value={deal.businessUnit || ""} onChange={e => updateDeal(deal.id, "businessUnit", e.target.value)}>
                              <option value="">—</option>
                              {uniqueBusinessUnits.map(bu => <option key={bu} value={bu}>{bu}</option>)}
                            </select>
                          </td>
                          {/* Capability Line - dropdown */}
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            <select className="h-7 px-1.5 rounded border border-border bg-card text-caption text-foreground max-w-[150px]"
                              value={deal.capabilityLine || ""} onChange={e => updateDeal(deal.id, "capabilityLine", e.target.value)}>
                              <option value="">—</option>
                              {uniqueCapabilityLines.map(cl => <option key={cl} value={cl}>{cl}</option>)}
                            </select>
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground sticky left-[80px] bg-card z-10 truncate max-w-[140px]" title={`${deal.account} — ${deal.dealName}`}>{deal.account}</td>
                          {/* Deal Name - click to edit */}
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            {editingCell?.personId === deal.id && editingCell?.field === "dealName" ? (
                              <input type="text" className="w-full h-7 px-2 rounded border border-accent bg-card text-caption text-foreground" autoFocus
                                value={editValue} onChange={e => setEditValue(e.target.value)}
                                onBlur={() => { updateDeal(deal.id, "dealName", editValue); setEditingCell(null); }}
                                onKeyDown={e => { if (e.key === "Enter") { updateDeal(deal.id, "dealName", editValue); setEditingCell(null); } if (e.key === "Escape") setEditingCell(null); }} />
                            ) : (
                              <span onClick={() => { setEditingCell({ personId: deal.id, field: "dealName" }); setEditValue(deal.dealName || ""); }}
                                className="cursor-pointer text-caption text-foreground hover:text-accent truncate block max-w-[150px]" title={deal.dealName}>{deal.dealName || "—"}</span>
                            )}
                          </td>
                          {/* Deal Master Status - dropdown */}
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            <select className="h-7 px-1.5 rounded border border-border bg-card text-caption text-foreground max-w-[130px]"
                              value={deal.dealStatus || ""} onChange={e => updateDeal(deal.id, "dealStatus", e.target.value)}>
                              <option value="">—</option>
                              {DEAL_MASTER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-foreground">{fmtCurrency(deal.mrr)}</td>
                          <td className="py-2 px-3 text-muted-foreground text-caption">{deal.duration || "—"}</td>
                          <td className="py-2 px-3 text-right font-mono text-foreground">{fmtCurrency(deal.retainerDealValue)}</td>
                          <td className="py-2 px-3 text-right font-mono text-foreground">{fmtCurrency(deal.nonRetainerDealValue)}</td>
                          <td className="py-2 px-3 text-right font-mono text-foreground font-medium">{fmtCurrency(deal.totalDealValue)}</td>
                          <td className="py-2 px-3"><span className={cn("px-1.5 py-0.5 rounded text-caption font-medium", deal.dealType === "Retainer" ? "bg-positive/10 text-positive" : deal.dealType === "Pilot" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent")}>{deal.dealType}</span></td>
                          <td className="py-2 px-3"><span className={cn("px-1.5 py-0.5 rounded text-caption font-medium", deal.staffingStatus === "Already Staffed" ? "bg-positive/10 text-positive" : deal.staffingStatus === "Staffing Needed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{deal.staffingStatus === "Already Staffed" ? "Staffed" : deal.staffingStatus === "Staffing Needed" ? "Needed" : "N/A"}</span></td>
                          {visibleSlots.map(slot => {
                            const slotAssignments = getAssignments(deal.id, slot.roleKey);
                            const roleOpts = people.filter(p => {
                              const allowedTitles = ROLE_TO_PEOPLE_FILTER[slot.roleKey];
                              if (allowedTitles) return allowedTitles.includes(p.roleTitle);
                              return true;
                            });
                            return (
                              <td key={slot.roleKey} className="py-2 px-3" onClick={e => e.stopPropagation()}>
                                <div className="flex flex-col gap-1.5">
                                  {slotAssignments.map(a => (
                                    <div key={a.id} className="flex items-center gap-1.5">
                                      <PersonSel value={a.personId} opts={roleOpts} onChange={v => {
                                        if (!v) { removeAssignment(a.id); return; }
                                        setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, personId: v } : x));
                                      }} />
                                      <div className="flex items-center gap-0.5">
                                        <input type="number" step="1" min="0" max="100"
                                          className="w-[44px] h-7 px-1 rounded border border-border bg-card text-caption font-mono text-foreground text-right"
                                          value={a.allocationPct} onChange={e => updateAllocation(a.id, parseFloat(e.target.value) || 0)} />
                                        <span className="text-muted-foreground text-[10px]">%</span>
                                      </div>
                                      <button onClick={() => removeAssignment(a.id)} className="text-muted-foreground hover:text-destructive text-caption">✕</button>
                                    </div>
                                  ))}
                                  <button onClick={() => addAssignment(deal.id, slot.roleKey, "")}
                                    className="text-accent hover:text-accent/80 text-[10px] font-medium flex items-center gap-0.5 w-fit">
                                    <Plus className="h-3 w-3" /> Add
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                        {isExpanded && renderDealExpand(deal)}
                      </>
                    );
                  })}
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

        {/* ═══════════════ PEOPLE ═══════════════ */}
        {activeTab === "people" && (
          <>
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {ROLE_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setPeopleCategoryTab(cat)} className={cn(
                  "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                  peopleCategoryTab === cat ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                )}>{cat}</button>
              ))}
            </div>
            <div className="mb-3">
              <FilterBar />
            </div>

            <div className="data-card p-0 overflow-x-auto">
              <table className="w-full text-ui min-w-[1200px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["", "Name", "Department", "Designation", "Reporting Manager", "Band", "Deals", "Total Alloc.", "Status"].map(h => (
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
                        <td className="py-2 px-4 w-10">
                          <button onClick={() => startEditPerson(p)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          <span className={cn(p.leaving && "line-through text-muted-foreground", p.tbh && "text-warning italic")}>{p.name}</span>
                        </td>
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
                        <td className="py-2 px-4">
                          {isEditing("designation") ? (
                            <select autoFocus value={p.designation || ""} onChange={e => updatePerson(p.id, "designation", e.target.value)} onBlur={() => setEditingCell(null)}
                              className="h-8 w-full px-2 rounded border border-accent bg-card text-ui text-foreground">
                              <option value="">—</option>
                              {allDesignations.filter(d => d !== "All").map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          ) : (
                            <span onClick={() => setEditingCell({ personId: p.id, field: "designation" })} className="cursor-pointer text-muted-foreground hover:text-foreground text-caption truncate block max-w-[180px]" title={p.designation}>{p.designation || "—"}</span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {isEditing("reportingManager") ? (
                            <select autoFocus value={p.reportingManager || ""} onChange={e => updatePerson(p.id, "reportingManager", e.target.value)} onBlur={() => setEditingCell(null)}
                              className="h-8 w-full px-2 rounded border border-accent bg-card text-ui text-foreground">
                              <option value="">—</option>
                              {allManagers.filter(m => m !== "All").map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          ) : (
                            <span onClick={() => setEditingCell({ personId: p.id, field: "reportingManager" })} className="cursor-pointer text-muted-foreground hover:text-foreground text-caption">{p.reportingManager || "—"}</span>
                          )}
                        </td>
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

        {/* ═══════════════ CAPACITY ═══════════════ */}
        {activeTab === "capacity" && (
          <CapacityTab deals={deals} people={people} assignments={assignments} />
        )}

        {/* ═══════════════ HIRING GAP ═══════════════ */}
        {activeTab === "hiring" && (
          <HiringGapTab hiringNeeds={hiringNeeds} onUpdateNeeds={setHiringNeeds} />
        )}

        {/* ═══════════════ REVENUE CAPACITY ═══════════════ */}
        {activeTab === "revenue" && (
          <RevenueCapacityTab deals={deals} people={people} assignments={assignments} targets={revenueTargets} onUpdateTargets={setRevenueTargets} />
        )}
      </div>

      {/* ═══════════════ ADD / EDIT PERSON MODAL ═══════════════ */}
      {addPersonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={() => { setAddPersonModal(false); setEditPersonId(null); }}>
          <div className="bg-card border border-border rounded-lg p-6 w-[480px] max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-ui font-semibold text-foreground">{editPersonId ? "Edit Person" : "Add New Person"}</h3>
              <button onClick={() => { setAddPersonModal(false); setEditPersonId(null); }}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-caption text-muted-foreground font-medium">Name</label>
                <input type="text" value={newPerson.name} onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Department</label>
                  <select value={newPerson.department} onChange={e => setNewPerson(p => ({ ...p, department: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    <option value="">Select...</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Designation</label>
                  <input type="text" value={newPerson.designation} onChange={e => setNewPerson(p => ({ ...p, designation: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1 focus:bg-card focus:ring-1 focus:ring-accent focus:outline-none" placeholder="e.g. Senior BOPM" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Reporting Manager</label>
                  <select value={newPerson.reportingManager} onChange={e => setNewPerson(p => ({ ...p, reportingManager: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    <option value="">Select...</option>
                    {allManagers.filter(m => m !== "All").map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-caption text-muted-foreground font-medium">Band</label>
                  <select value={newPerson.band} onChange={e => setNewPerson(p => ({ ...p, band: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                    <option value="">Select...</option>
                    {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
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
              <button onClick={editPersonId ? saveEditPerson : addNewPerson} disabled={!newPerson.name || !newPerson.roleTitle}
                className="w-full h-9 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 disabled:opacity-50 transition-opacity mt-2">
                {editPersonId ? "Save Changes" : "Add Person"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
