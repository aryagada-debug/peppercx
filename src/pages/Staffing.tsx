import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2, Eye } from "lucide-react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { DealViewTab } from "@/components/staffing/DealViewTab";
import { PeopleViewTab } from "@/components/staffing/PeopleViewTab";
import { useUserRole } from "@/hooks/useUserRole";
import { ReadOnlyBanner } from "@/components/access/ReadOnlyBanner";
import { useDealAccess } from "@/hooks/useDealAccess";
import { BopmEmptyState } from "@/components/access/BopmEmptyState";
import { StaffingReviewRequestsButton } from "@/components/staffing/StaffingReviewRequests";
import { BopmStaffingSummary } from "@/components/staffing/BopmStaffingSummary";
import { BopmStaffingFlatTable } from "@/components/staffing/BopmStaffingFlatTable";
import { MyStaffingRequests } from "@/components/staffing/MyStaffingRequests";

type Tab = "deals" | "people" | "table" | "requests";

// Deal statuses considered "active" for the BOPM staffing view.
// Closed deals (Completed / Churned) are hidden.
const ACTIVE_DEAL_STATUSES = new Set([
  "Active Deal",
  "New Deal in SLA/PO",
  "Deal Disputed",
  "Deal in Renewal Process",
]);

export default function Staffing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const dealParam = searchParams.get("deal");
  const { role } = useUserRole();
  const { visibleDealIds, loading: accessLoading } = useDealAccess();
  const isBopmPersona = role === "user";
  const normalizedTabParam: Tab | null =
    tabParam === ("matrix" as any) || tabParam === ("tables" as any)
      ? "table"
      : (tabParam as Tab | null);
  const [tab, setTab] = useState<Tab>(normalizedTabParam || (isBopmPersona ? "table" : "deals"));

  // BOPM persona: only Table view + Change requests are valid.
  useEffect(() => {
    if (isBopmPersona && tab !== "table" && tab !== "requests") setTab("table");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBopmPersona]);

  useEffect(() => {
    if (normalizedTabParam && normalizedTabParam !== tab) setTab(normalizedTabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  const switchTab = (t: Tab) => {
    setTab(t);
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    if (t !== "table") next.delete("deal");
    setSearchParams(next, { replace: true });
  };

  const {
    people, deals, assignments, revenueTargets, loading,
    updateAssignment, updateDeal, upsertAssignmentByRole,
    addAssignment, deleteAssignment,
  } = useStaffingData();

  // For BOPM persona, narrow deals + assignments to her tagged deals — and
  // narrow `people` to only those staffed on those deals (so the People
  // picker / matrix rows don't leak the wider org).
  const scopedDeals = isBopmPersona && !accessLoading
    ? deals.filter(d => visibleDealIds.has(d.id))
    : deals;
  // De-duplicate by id (defensive — visibleDealIds is already a Set)
  const uniqueScopedDeals = isBopmPersona
    ? Array.from(new Map(scopedDeals.map(d => [d.id, d])).values())
    : scopedDeals;
  // Active-only deals for the BOPM staffing surface (closed deals are hidden).
  const activeBopmDeals = isBopmPersona
    ? uniqueScopedDeals.filter(d => ACTIVE_DEAL_STATUSES.has(d.dealStatus))
    : uniqueScopedDeals;
  const scopedAssignments = isBopmPersona && !accessLoading
    ? (() => {
        const activeIds = new Set(activeBopmDeals.map(d => d.id));
        return assignments.filter(a => activeIds.has(a.dealId));
      })()
    : assignments;
  const scopedPeople = isBopmPersona && !accessLoading
    ? (() => {
        const ids = new Set(scopedAssignments.map(a => a.personId));
        return people.filter(p => ids.has(p.id));
      })()
    : people;

  if (loading || (isBopmPersona && accessLoading)) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const TABS: { key: Tab; label: string }[] = isBopmPersona
    ? [
        { key: "table",    label: "Table view" },
        { key: "requests", label: "Change requests" },
      ]
    : [
        { key: "deals", label: "Deal view" },
        { key: "people", label: "People view" },
        { key: "table", label: "Staffing" },
      ];

  const showBopmEmpty = isBopmPersona && !accessLoading && activeBopmDeals.length === 0;

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <ReadOnlyBanner routeKey="staffing" label="Staffing & Capacity" />
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-subhead font-bold tracking-tight text-foreground">Staffing & Capacity</h1>
              {isBopmPersona && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-caption font-medium">
                  <Eye className="h-3 w-3" /> Read-only
                </span>
              )}
            </div>
            <p className="text-ui text-muted-foreground mt-1">
              {(isBopmPersona ? activeBopmDeals : uniqueScopedDeals).length} {isBopmPersona ? "active deals" : "deals"} • {(isBopmPersona ? scopedPeople : people.filter(p => !p.tbh)).length} people
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isBopmPersona && <StaffingReviewRequestsButton />}
            {TABS.length > 1 && (
              <div className="flex gap-1 bg-secondary rounded-lg p-1">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => switchTab(t.key)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-ui font-medium transition-colors",
                      tab === t.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/*
          Tab panels stay mounted across switches (visibility toggled with
          `hidden`) so column widths, drafts, scroll position, search text,
          etc. survive when the user moves between tabs — switching no longer
          feels like a page reload. Only panels permitted for the current
          persona are mounted.
        */}
        {isBopmPersona ? (
          <>
            <div className={cn(tab !== "table" && "hidden")}>
              {showBopmEmpty
                ? <BopmEmptyState section="Staffing & Capacity" />
                : (
                  <BopmStaffingFlatTable
                    deals={activeBopmDeals}
                    people={scopedPeople}
                    allPeople={people}
                    assignments={scopedAssignments}
                  />
                )
              }
            </div>
            <div className={cn(tab !== "requests" && "hidden")}>
              <MyStaffingRequests deals={uniqueScopedDeals} people={people} variant="table" />
            </div>
          </>
        ) : (
          <>
            <div className={cn(tab !== "deals" && "hidden")}>
              <DealViewTab deals={scopedDeals} people={people} assignments={scopedAssignments} onUpdateDeal={updateDeal} />
            </div>
            <div className={cn(tab !== "people" && "hidden")}>
              <PeopleViewTab
                people={people}
                deals={scopedDeals}
                assignments={scopedAssignments}
                revenueTargets={revenueTargets}
                onUpdateAssignment={updateAssignment}
              />
            </div>
            <div className={cn(tab !== "table" && "hidden")}>
              <BopmStaffingFlatTable
                deals={scopedDeals}
                people={people}
                allPeople={people}
                assignments={scopedAssignments}
                directEdit
                onAddAssignment={addAssignment}
                onUpdateAssignment={updateAssignment}
                onDeleteAssignment={deleteAssignment}
              />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
