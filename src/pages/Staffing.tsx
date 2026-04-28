import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2, Eye } from "lucide-react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { DealViewTab } from "@/components/staffing/DealViewTab";
import { PeopleViewTab } from "@/components/staffing/PeopleViewTab";
import { MatrixTab } from "@/components/staffing/MatrixTab";
import { useUserRole } from "@/hooks/useUserRole";
import { ReadOnlyBanner } from "@/components/access/ReadOnlyBanner";
import { useDealAccess } from "@/hooks/useDealAccess";
import { BopmEmptyState } from "@/components/access/BopmEmptyState";
import { StaffingReviewRequestsButton } from "@/components/staffing/StaffingReviewRequests";
import { BopmStaffingSummary } from "@/components/staffing/BopmStaffingSummary";

type Tab = "deals" | "people" | "matrix";

export default function Staffing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const dealParam = searchParams.get("deal");
  const { role } = useUserRole();
  const { visibleDealIds, loading: accessLoading } = useDealAccess();
  const isBopmPersona = role === "user";
  const [tab, setTab] = useState<Tab>(tabParam || (isBopmPersona ? "matrix" : "deals"));

  // BOPM persona: only the Staffing matrix is available.
  useEffect(() => {
    if (isBopmPersona && tab !== "matrix") setTab("matrix");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBopmPersona]);

  useEffect(() => {
    if (tabParam && tabParam !== tab) setTab(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  const switchTab = (t: Tab) => {
    setTab(t);
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    if (t !== "matrix") next.delete("deal");
    setSearchParams(next, { replace: true });
  };

  const {
    people, deals, assignments, revenueTargets, loading,
    updateAssignment, updateDeal, upsertAssignmentByRole,
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
  const scopedAssignments = isBopmPersona && !accessLoading
    ? assignments.filter(a => visibleDealIds.has(a.dealId))
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
        { key: "matrix", label: "Staffing" },
      ]
    : [
        { key: "deals", label: "Deal view" },
        { key: "people", label: "People view" },
        { key: "matrix", label: "Staffing" },
      ];

  const showBopmEmpty = isBopmPersona && !accessLoading && scopedDeals.length === 0;

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
              {uniqueScopedDeals.length} deals • {(isBopmPersona ? scopedPeople : people.filter(p => !p.tbh)).length} people
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

        {showBopmEmpty && <BopmEmptyState section="Staffing & Capacity" />}

        {isBopmPersona && !showBopmEmpty && (
          <BopmStaffingSummary
            deals={uniqueScopedDeals}
            people={scopedPeople}
            assignments={scopedAssignments}
          />
        )}

        {tab === "deals" && !isBopmPersona && (
          <DealViewTab deals={scopedDeals} people={people} assignments={scopedAssignments} onUpdateDeal={updateDeal} />
        )}
        {tab === "people" && !isBopmPersona && (
          <PeopleViewTab
            people={people}
            deals={scopedDeals}
            assignments={scopedAssignments}
            revenueTargets={revenueTargets}
            onUpdateAssignment={updateAssignment}
          />
        )}
        {tab === "matrix" && (
          <MatrixTab
            deals={isBopmPersona ? uniqueScopedDeals : scopedDeals}
            people={isBopmPersona ? scopedPeople : people}
            assignments={scopedAssignments}
            onUpdateDeal={isBopmPersona ? () => {} : updateDeal}
            onUpsertAssignment={isBopmPersona ? () => {} : upsertAssignmentByRole}
            readOnly={isBopmPersona}
            initialDealId={dealParam || undefined}
          />
        )}
      </div>
    </AppLayout>
  );
}
