import { AppLayout } from "@/components/layout/AppLayout";
import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useStaffingQueries } from "@/hooks/queries/useStaffingQueries";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { PeopleReportingTable } from "@/components/settings/PeopleReportingTable";
import { PeopleOpsAnalyticsStrip } from "@/components/people-ops/PeopleOpsAnalyticsStrip";
import { DepartmentCardsGrid } from "@/components/people-ops/DepartmentCardsGrid";
import { UtilLegend } from "@/components/people-ops/DepartmentCard";
import { PeopleOpsCapacityTab } from "@/components/people-ops/PeopleOpsCapacityTab";
import { PeopleOpsHiringGapTab } from "@/components/people-ops/PeopleOpsHiringGapTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeamScope } from "@/hooks/useTeamScope";
import { useUserRole } from "@/hooks/useUserRole";
import { ACTIVE_DEAL_STATUSES, isAssignmentExpired } from "@/data/staffingData";
import { formatINR } from "@/lib/csvTargets";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function PeopleOps() {
  useCurrencyVersion();
  const { people: allPeople, assignments: allAssignments, deals: allDeals, loading } = useStaffingQueries();
  const { addPerson, updatePerson, deletePerson } = useStaffingMutations();
  const { isAdmin } = useUserRole();
  const scope = useTeamScope(allPeople);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  // Scope people / assignments / deals to the viewer's team for non-admins.
  const { people, assignments, deals } = useMemo(() => {
    if (scope.scopeMode === "all") {
      return { people: allPeople, assignments: allAssignments, deals: allDeals };
    }
    if (scope.scopeMode === "none" || !scope.teamPersonIds) {
      return { people: [] as typeof allPeople, assignments: [] as typeof allAssignments, deals: [] as typeof allDeals };
    }
    const ids = scope.teamPersonIds;
    const scopedPeople = allPeople.filter((p) => ids.has(p.id));
    const scopedAssignments = allAssignments.filter((a) => ids.has(a.personId));
    const dealIds = new Set(scopedAssignments.map((a) => a.dealId));
    const scopedDeals = allDeals.filter((d) => dealIds.has(d.id));
    return { people: scopedPeople, assignments: scopedAssignments, deals: scopedDeals };
  }, [scope, allPeople, allAssignments, allDeals]);

  const analytics = useMemo(() => {
    const active = people.filter((p) => !p.tbh && !p.leaving);
    const tbh = people.filter((p) => p.tbh).length;
    const leavers = people.filter((p) => p.leaving).length;

    const activeDealIds = new Set(
      deals.filter((d) => ACTIVE_DEAL_STATUSES.has(d.dealStatus)).map((d) => d.id),
    );
    const utilByPerson: Record<string, number> = {};
    const mrrByPerson: Record<string, number> = {};
    const dealById = new Map(deals.map((d) => [d.id, d]));
    for (const a of assignments) {
      if (!activeDealIds.has(a.dealId) || isAssignmentExpired(a)) continue;
      utilByPerson[a.personId] = (utilByPerson[a.personId] || 0) + (a.allocationPct || 0);
      const d = dealById.get(a.dealId);
      if (d?.mrr) {
        mrrByPerson[a.personId] = (mrrByPerson[a.personId] || 0) + (d.mrr * (a.allocationPct || 0)) / 100;
      }
    }
    const activeIds = new Set(active.map((p) => p.id));
    const utilVals = Array.from(activeIds).map((id) => utilByPerson[id] || 0);
    const avgUtil = utilVals.length ? utilVals.reduce((a, b) => a + b, 0) / utilVals.length : 0;
    const totalMrr = Array.from(activeIds).reduce((s, id) => s + (mrrByPerson[id] || 0), 0);
    const revPerHead = active.length ? totalMrr / active.length : 0;
    const capacityHrs = active.length * 160;

    return {
      headcount: active.length,
      avgUtil,
      tbh,
      leavers,
      capacityHrs,
      revPerHead,
    };
  }, [people, assignments, deals]);

  const scrollToTable = (_dept: string) => {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading || scope.loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePerson(confirmDelete.id);
      toast.success(`${confirmDelete.name} removed`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setConfirmDelete(null);
    }
  };

  const headerSubtitle = scope.scopeMode === "team"
    ? `Your team — ${people.filter((p) => !p.tbh).length} people • capacity & hiring view`
    : `${people.filter(p => !p.tbh).length} people • reporting, capacity & utilisation`;

  return (
    <AppLayout>
      <div className="px-3 py-4 space-y-6">
        <div>
          <h1 className="text-subhead font-bold tracking-tight text-foreground">People Ops</h1>
          <p className="text-ui text-muted-foreground mt-1">
            {headerSubtitle}
            {scope.scopeMode === "team" && scope.leaderPerson && (
              <span className="ml-2 text-xs">(scoped to {scope.leaderPerson.name})</span>
            )}
          </p>
        </div>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="capacity">Capacity</TabsTrigger>
            <TabsTrigger value="hiring">Hiring Gap</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6 pt-4">
            <PeopleOpsAnalyticsStrip
              tiles={[
                { label: "Headcount", value: analytics.headcount },
                {
                  label: "Avg Utilization",
                  value: `${Math.round(analytics.avgUtil)}%`,
                  tone:
                    analytics.avgUtil > 100 ? "destructive"
                    : analytics.avgUtil >= 85 ? "warning"
                    : analytics.avgUtil >= 30 ? "positive"
                    : "info",
                },
                { label: "Hiring Gaps", value: analytics.tbh, tone: analytics.tbh > 0 ? "warning" : "default" },
                { label: "Leavers", value: String(analytics.leavers).padStart(2, "0"), tone: analytics.leavers > 0 ? "destructive" : "default" },
                { label: "TBH Roles", value: String(analytics.tbh).padStart(2, "0"), tone: "info" },
                {
                  label: "Capacity",
                  value: (
                    <>
                      {analytics.capacityHrs.toLocaleString()}{" "}
                      <span className="text-xs text-muted-foreground font-normal">hrs</span>
                    </>
                  ),
                },
                { label: "Rev / Head", value: formatINR(analytics.revPerHead) },
              ]}
            />
            <DepartmentCardsGrid
              people={people}
              assignments={assignments}
              deals={deals}
              onViewDept={scrollToTable}
            />
            <UtilLegend />
          </TabsContent>

          <TabsContent value="people" className="pt-4">
            <div ref={tableRef}>
              <h2 className="text-base font-medium text-foreground mb-3">All people</h2>
              <PeopleReportingTable
                people={people}
                assignments={assignments}
                deals={deals}
                onAdd={addPerson}
                onUpdate={updatePerson}
                onRequestDelete={(p) => setConfirmDelete({ id: p.id, name: p.name })}
              />
            </div>
          </TabsContent>

          <TabsContent value="capacity" className="pt-4">
            <PeopleOpsCapacityTab
              people={people}
              assignments={assignments}
              deals={deals}
              capacityRoster={allPeople}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="hiring" className="pt-4">
            <PeopleOpsHiringGapTab
              people={people}
              assignments={assignments}
              deals={deals}
              capacityRoster={allPeople}
              isAdmin={isAdmin}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the person from People Ops. Their staffing assignments will be unlinked.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}