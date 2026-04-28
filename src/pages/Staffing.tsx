import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useStaffingData } from "@/hooks/useStaffingData";
import { DealViewTab } from "@/components/staffing/DealViewTab";
import { PeopleViewTab } from "@/components/staffing/PeopleViewTab";
import { MatrixTab } from "@/components/staffing/MatrixTab";

type Tab = "deals" | "people" | "matrix";

export default function Staffing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const dealParam = searchParams.get("deal");
  const [tab, setTab] = useState<Tab>(tabParam || "deals");

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

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "deals", label: "Deal view" },
    { key: "people", label: "People view" },
    { key: "matrix", label: "Staffing" },
  ];

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-subhead font-bold tracking-tight text-foreground">Staffing & Capacity</h1>
            <p className="text-ui text-muted-foreground mt-1">
              {deals.length} deals • {people.filter(p => !p.tbh).length} people
            </p>
          </div>
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
        </div>

        {tab === "deals" && (
          <DealViewTab deals={deals} people={people} assignments={assignments} onUpdateDeal={updateDeal} />
        )}
        {tab === "people" && (
          <PeopleViewTab
            people={people}
            deals={deals}
            assignments={assignments}
            revenueTargets={revenueTargets}
            onUpdateAssignment={updateAssignment}
          />
        )}
        {tab === "matrix" && (
          <MatrixTab
            deals={deals}
            people={people}
            assignments={assignments}
            onUpdateDeal={updateDeal}
            onUpsertAssignment={upsertAssignmentByRole}
            initialDealId={dealParam || undefined}
          />
        )}
      </div>
    </AppLayout>
  );
}
