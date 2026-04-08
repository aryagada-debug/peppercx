import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Search, Plus, X, UserPlus, ChevronDown, ChevronRight, Pencil, Trash2, CheckSquare, Loader2, Lock, Unlock } from "lucide-react";
import {
  ROLE_SLOTS, ROLE_CATEGORIES, ROLE_TO_PEOPLE_FILTER, DEPARTMENTS, BANDS, BU_ROLE_CATEGORIES, getBUCategories,
  type Deal, type Person, type StaffingAssignment, type RoleCategory, type HiringNeed, type RevenueCapacityTarget, type BWRule, uid
} from "@/data/staffingData";
import { useStaffingData } from "@/hooks/useStaffingData";
import { SummaryTab } from "@/components/staffing/SummaryTab";
import { CapacityTab } from "@/components/staffing/CapacityTab";
import { HiringGapTab } from "@/components/staffing/HiringGapTab";
import { RevenueCapacityTab } from "@/components/staffing/RevenueCapacityTab";
import { BWRulesTab } from "@/components/staffing/BWRulesTab";
import { AccountsTab } from "@/components/staffing/AccountsTab";
import { PeopleTab } from "@/components/staffing/PeopleTab";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

type TabKey = "summary" | "accounts" | "people" | "capacity" | "hiring" | "revenue" | "bwrules";
const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "accounts", label: "Accounts" },
  { key: "people", label: "People" },
  { key: "capacity", label: "Capacity" },
  { key: "hiring", label: "Hiring Gap" },
  { key: "revenue", label: "Revenue Capacity" },
  { key: "bwrules", label: "BW Rules" },
];

type CapabilitySwitcher = "All" | "SEO" | "Content" | "Creative" | "Ops";
const CAPABILITY_OPTIONS: CapabilitySwitcher[] = ["All", "SEO", "Content", "Creative", "Ops"];

const CAPABILITY_TO_CATEGORIES: Record<CapabilitySwitcher, RoleCategory[]> = {
  All: ROLE_CATEGORIES,
  SEO: ["SEO"],
  Content: ["Content", "Content Strategy"],
  Creative: ["Creative Strategy", "Creative Copy", "Creative Art"],
  Ops: ["Operations"],
};

// ── Main Component ──────────────────────────────────────────────────────────
export default function Staffing() {
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [editMode, setEditMode] = useState(false);
  const [capability, setCapability] = useState<CapabilitySwitcher>("All");
  const {
    people, deals, assignments, hiringNeeds, revenueTargets, bwRules, loading,
    addPerson: dbAddPerson, updatePerson: dbUpdatePerson, deletePerson: dbDeletePerson,
    bulkUpdatePeople, addAssignment: dbAddAssignment, updateAssignment: dbUpdateAssignment,
    deleteAssignment: dbDeleteAssignment, updateDeal: dbUpdateDeal,
    setHiringNeeds, setRevenueTargets, setPeople, setAssignments, setDeals,
    updateBWRule, addBWRule, deleteBWRule, setBwRules,
  } = useStaffingData();

  // Capability-filtered data
  const capCategories = CAPABILITY_TO_CATEGORIES[capability];
  const filteredDeals = useMemo(() => {
    if (capability === "All") return deals;
    return deals.filter(d => {
      const dealCats = getBUCategories(d.businessUnit);
      return dealCats.some(c => capCategories.includes(c));
    });
  }, [deals, capability, capCategories]);

  const filteredPeople = useMemo(() => {
    if (capability === "All") return people;
    return people.filter(p => capCategories.includes(p.roleCategory));
  }, [people, capability, capCategories]);

  const filteredAssignments = useMemo(() => {
    if (capability === "All") return assignments;
    const dealIds = new Set(filteredDeals.map(d => d.id));
    return assignments.filter(a => dealIds.has(a.dealId));
  }, [assignments, filteredDeals, capability]);

  // KPI computations
  const kpis = useMemo(() => {
    const totalMRR = filteredDeals.reduce((s, d) => s + (d.mrr || 0), 0);
    const arr = totalMRR * 12;
    const teamSize = filteredPeople.filter(p => !p.tbh && !p.leaving).length;
    const tbhCount = filteredPeople.filter(p => p.tbh).length;
    const leavingCount = filteredPeople.filter(p => p.leaving).length;
    const gaps = filteredDeals.filter(d => {
      const has = filteredAssignments.some(a => a.dealId === d.id && a.allocationPct > 0);
      return !has && d.staffingStatus !== "No Staffing Needed";
    }).length;
    return { totalMRR, arr, teamSize, tbhCount, leavingCount, gaps };
  }, [filteredDeals, filteredPeople, filteredAssignments]);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-ui text-muted-foreground">Loading staffing data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header with Edit/Publish toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-subhead font-semibold tracking-tight text-foreground">Staffing & Capacity</h1>
            <p className="text-ui text-muted-foreground mt-1">{filteredDeals.length} deals • {filteredPeople.filter(p => !p.tbh).length} people • {filteredAssignments.length} assignments</p>
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "h-9 px-4 rounded-md text-ui font-medium transition-colors flex items-center gap-2",
              editMode
                ? "bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20"
                : "bg-positive/10 text-positive border border-positive/30 hover:bg-positive/20"
            )}
          >
            {editMode ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {editMode ? "Edit Mode" : "Published"}
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          {[
            { label: "Total MRR", value: fmtCurrency(kpis.totalMRR) },
            { label: "ARR", value: fmtCurrency(kpis.arr) },
            { label: "Team Size", value: String(kpis.teamSize) },
            { label: "TBH", value: String(kpis.tbhCount), alert: kpis.tbhCount > 0 },
            { label: "Leaving", value: String(kpis.leavingCount), alert: kpis.leavingCount > 0 },
            { label: "Gaps", value: String(kpis.gaps), alert: kpis.gaps > 0 },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-lg px-4 py-3">
              <p className="metric-label">{k.label}</p>
              <p className={cn("text-xl font-semibold font-mono tracking-tight mt-0.5", k.alert ? "text-destructive" : "text-foreground")}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Capability Switcher + Tab Navigation */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
            {CAPABILITY_OPTIONS.map(cap => (
              <button key={cap} onClick={() => setCapability(cap)} className={cn(
                "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                capability === cap ? "bg-foreground text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{cap}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 border-b border-border overflow-x-auto flex-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn(
                "px-4 py-2.5 text-ui font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "summary" && (
          <SummaryTab deals={filteredDeals} people={filteredPeople} assignments={filteredAssignments} />
        )}

        {activeTab === "accounts" && (
          <AccountsTab
            deals={filteredDeals}
            allDeals={deals}
            people={people}
            assignments={assignments}
            editMode={editMode}
            onUpdateDeal={dbUpdateDeal}
            onAddAssignment={dbAddAssignment}
            onUpdateAssignment={dbUpdateAssignment}
            onDeleteAssignment={dbDeleteAssignment}
          />
        )}

        {activeTab === "people" && (
          <PeopleTab
            people={filteredPeople}
            allPeople={people}
            assignments={assignments}
            deals={deals}
            editMode={editMode}
            onAddPerson={dbAddPerson}
            onUpdatePerson={dbUpdatePerson}
            onDeletePerson={dbDeletePerson}
            onBulkUpdate={bulkUpdatePeople}
          />
        )}

        {activeTab === "capacity" && (
          <CapacityTab deals={filteredDeals} people={filteredPeople} assignments={filteredAssignments} />
        )}

        {activeTab === "hiring" && (
          <HiringGapTab
            hiringNeeds={hiringNeeds}
            onUpdateNeeds={setHiringNeeds}
            people={filteredPeople}
            deals={filteredDeals}
            assignments={filteredAssignments}
            editMode={editMode}
          />
        )}

        {activeTab === "revenue" && (
          <RevenueCapacityTab deals={filteredDeals} people={filteredPeople} assignments={filteredAssignments} targets={revenueTargets} onUpdateTargets={setRevenueTargets} />
        )}

        {activeTab === "bwrules" && (
          <BWRulesTab
            rules={bwRules}
            onUpdateRule={updateBWRule}
            onAddRule={addBWRule}
            onDeleteRule={deleteBWRule}
            editMode={editMode}
          />
        )}
      </div>
    </AppLayout>
  );
}