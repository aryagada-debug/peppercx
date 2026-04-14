import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Lock, Unlock } from "lucide-react";
import {
  ROLE_CATEGORIES, BU_ROLE_CATEGORIES, getBUCategories,
  type Deal, type Person, type StaffingAssignment, type RoleCategory, type BWRule
} from "@/data/staffingData";
import { useStaffingData } from "@/hooks/useStaffingData";
import { DealLevelView } from "@/components/staffing/DealLevelView";
import { PeopleLevelView } from "@/components/staffing/PeopleLevelView";

const ACTIVE_STATUSES = new Set(["Active Deal", "New Deal in SLA/PO", "Deal Disputed"]);

const fmtCurrency = (n: number | undefined) => {
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

type ViewTab = "deals" | "people";
type CapabilitySwitcher = "All" | "SEO" | "Content" | "Creative" | "Ops";
const CAPABILITY_OPTIONS: CapabilitySwitcher[] = ["All", "SEO", "Content", "Creative", "Ops"];

const CAPABILITY_TO_CATEGORIES: Record<CapabilitySwitcher, RoleCategory[]> = {
  All: ROLE_CATEGORIES,
  SEO: ["SEO"],
  Content: ["Content", "Content Strategy"],
  Creative: ["Creative Strategy", "Creative Copy", "Creative Art"],
  Ops: ["Operations"],
};

export default function Staffing() {
  const [activeView, setActiveView] = useState<ViewTab>("deals");
  const [editMode, setEditMode] = useState(false);
  const [capability, setCapability] = useState<CapabilitySwitcher>("All");
  const {
    people, deals, assignments, bwRules, revenueTargets, loading,
    addPerson: dbAddPerson, updatePerson: dbUpdatePerson, deletePerson: dbDeletePerson,
    addAssignment: dbAddAssignment, updateAssignment: dbUpdateAssignment,
    deleteAssignment: dbDeleteAssignment, updateDeal: dbUpdateDeal,
  } = useStaffingData();

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

  const kpis = useMemo(() => {
    const totalMRR = filteredDeals.reduce((s, d) => s + (d.mrr || 0), 0);
    const arr = totalMRR * 12;
    const teamSize = filteredPeople.filter(p => !p.tbh && !p.leaving).length;
    const tbhCount = filteredPeople.filter(p => p.tbh).length;
    const leavingCount = filteredPeople.filter(p => p.leaving).length;
    return { totalMRR, arr, teamSize, tbhCount, leavingCount };
  }, [filteredDeals, filteredPeople]);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">Staffing & Capacity</h1>
            <p className="text-ui text-muted-foreground mt-1">{filteredDeals.length} deals • {filteredPeople.filter(p => !p.tbh).length} people</p>
          </div>
          <button onClick={() => setEditMode(!editMode)} className={cn(
            "h-9 px-4 rounded-lg text-ui font-medium transition-colors flex items-center gap-2",
            editMode
              ? "bg-[hsl(var(--warning-bg))] text-warning border border-warning/30"
              : "bg-[hsl(var(--success-bg))] text-positive border border-positive/30"
          )}>
            {editMode ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {editMode ? "Edit Mode" : "Published"}
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: "Total MRR", value: fmtCurrency(kpis.totalMRR) },
            { label: "ARR", value: fmtCurrency(kpis.arr) },
            { label: "Team Size", value: String(kpis.teamSize) },
            { label: "TBH", value: String(kpis.tbhCount), alert: kpis.tbhCount > 0 },
            { label: "Leaving", value: String(kpis.leavingCount), alert: kpis.leavingCount > 0 },
          ].map(k => (
            <div key={k.label} className="data-card">
              <p className="metric-label">{k.label}</p>
              <p className={cn("text-xl font-semibold font-mono tracking-tight mt-1", k.alert ? "text-destructive" : "text-foreground")}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Capability Switcher + View Toggle */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {CAPABILITY_OPTIONS.map(cap => (
              <button key={cap} onClick={() => setCapability(cap)} className={cn(
                "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
                capability === cap ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{cap}</button>
            ))}
          </div>

          <div className="flex gap-1 bg-secondary rounded-lg p-1 ml-auto">
            <button onClick={() => setActiveView("deals")} className={cn(
              "px-4 py-1.5 rounded-md text-ui font-medium transition-colors",
              activeView === "deals" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>Deal View</button>
            <button onClick={() => setActiveView("people")} className={cn(
              "px-4 py-1.5 rounded-md text-ui font-medium transition-colors",
              activeView === "people" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>People View</button>
          </div>
        </div>

        {/* View Content */}
        {activeView === "deals" && (
          <DealLevelView deals={filteredDeals} people={people} assignments={filteredAssignments} revenueTargets={revenueTargets} />
        )}
        {activeView === "people" && (
          <PeopleLevelView people={filteredPeople} deals={deals} assignments={assignments} revenueTargets={revenueTargets} />
        )}
      </div>
    </AppLayout>
  );
}
