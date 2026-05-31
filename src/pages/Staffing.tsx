import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect, useMemo, useRef, useState } from "react";
import { StaffingErrorBoundary } from "@/components/staffing/StaffingErrorBoundary";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2, Eye } from "lucide-react";
import { useStaffingQueries } from "@/hooks/queries/useStaffingQueries";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { ACTIVE_DEAL_STATUSES } from "@/data/staffingData";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { OverviewTab } from "@/components/staffing/OverviewTab";
import { useUserRole } from "@/hooks/useUserRole";
import { ReadOnlyBanner } from "@/components/access/ReadOnlyBanner";
import { useDealAccess } from "@/hooks/useDealAccess";
import { BopmEmptyState } from "@/components/access/BopmEmptyState";
import { StaffingReviewRequestsButton } from "@/components/staffing/StaffingReviewRequests";
import { BopmStaffingSummary } from "@/components/staffing/BopmStaffingSummary";
import { BopmStaffingFlatTable } from "@/components/staffing/BopmStaffingFlatTable";
import { StaffingDealsList } from "@/components/staffing/StaffingDealsList";
import { MyStaffingRequests } from "@/components/staffing/MyStaffingRequests";
import { useAuth } from "@/components/auth/AuthProvider";
import { useVsdUsers } from "@/hooks/queries/legacy";
import { supabase } from "@/integrations/supabase/client";
import { useGeoFilter } from "@/contexts/GeoFilterContext";

type Tab = "overview" | "staffing" | "people" | "table" | "requests";

export default function Staffing() {
  useCurrencyVersion();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const dealParam = searchParams.get("deal");
  const { role, isActuallyAdmin } = useUserRole();
  const { visibleDealIds, loading: accessLoading } = useDealAccess();
  const { user: authUser } = useAuth();
  const { canonVsd } = useVsdUsers();
  // Resolve the logged-in person's VSD context (if they ARE a VSD) so the
  // BOPM filter on Staffing & Capacity can be scoped to their pod, exactly
  // like Clients & Deals does.
  const [myVsdName, setMyVsdName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!authUser || isActuallyAdmin) { if (!cancelled) setMyVsdName(null); return; }
        const { data: profile } = await supabase
          .from("profiles").select("staffing_person_id").eq("user_id", authUser.id).maybeSingle();
        const personId = (profile as any)?.staffing_person_id;
        if (!personId) { if (!cancelled) setMyVsdName(null); return; }
        const { data: person } = await supabase
          .from("staffing_people").select("name, role_title, designation").eq("id", personId).maybeSingle();
        const p: any = person;
        if (!p) { if (!cancelled) setMyVsdName(null); return; }
        const looksLikeVsd = /\bvsd\b|vertical service delivery|service delivery (leader|director)/i
          .test(`${p.role_title || ""} ${p.designation || ""}`);
        const canon = canonVsd(p.name);
        if (!cancelled) setMyVsdName(looksLikeVsd && canon ? canon : null);
      } catch (err) {
        console.warn("[Staffing] myVsdName lookup failed", err);
        if (!cancelled) setMyVsdName(null);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, canonVsd, isActuallyAdmin]);
  const isCapLead = role === "capability_lead";
  const isCapMember = role === "capability_member";
  // Capability ICs behave like BOPMs; capability leads behave like VSDs.
  const isBopmPersona = role === "user" || isCapMember;
  const isVsdPersona = role === "member" || isCapLead;
  // VSDs/Cap Leads and BOPMs/Cap ICs all have their own deal-set scope. Admin sees everything.
  const shouldScopeToOwnDeals = isBopmPersona || isVsdPersona;
  // Legacy params: deals/lock collapsed into "overview"; matrix/tables → table.
  const normalizedTabParam: Tab | null = (() => {
    if (!tabParam) return null;
    if (tabParam === "matrix" || tabParam === "tables") return "table";
    if (tabParam === "deals" || tabParam === "lock") return "overview";
    return tabParam as Tab;
  })();
  const defaultTab: Tab = isBopmPersona ? "staffing" : "overview";
  const [tab, setTab] = useState<Tab>(normalizedTabParam || defaultTab);

  // Track which tabs have ever been opened. We mount each panel lazily the
  // first time the user visits it and keep it mounted afterwards so column
  // widths / drafts / search text survive subsequent switches. Without this,
  // admins paid the full render cost of all three giant tables on first load
  // — the most common cause of the white-screen / "page unresponsive" crash.
  const visitedTabs = useRef<Set<Tab>>(new Set([tab]));
  visitedTabs.current.add(tab);
  const hasVisited = (t: Tab) => visitedTabs.current.has(t);

  // BOPM persona: only Table view + Change requests are valid.
  useEffect(() => {
    if (isBopmPersona && tab !== "staffing" && tab !== "requests") setTab("staffing");
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
    if (t !== "table" && t !== "staffing") next.delete("deal");
    setSearchParams(next, { replace: true });
  };

  const { people, deals, assignments, revenueTargets, loading } = useStaffingQueries();
  // Geo filter (header pill) applies as a presentation filter on top of
  // role-based scoping below. Deals with no geo fall into "Other".
  const { matchesDeal: geoMatchesDeal } = useGeoFilter();
  const {
    updateAssignment, updateDeal, upsertAssignmentByRole,
    addAssignment, deleteAssignment, updatePerson,
  } = useStaffingMutations();

  // For BOPM and VSD personas, narrow deals + assignments to their tagged
  // deals (per useDealAccess). VSDs see deals where they are the VSD or
  // where one of their P-BOPM / Sr BOPM is on the deal. BOPMs see only
  // their own tagged deals.
  // Memoised so identity is stable across unrelated re-renders — the heavy
  // tables below were re-mounting on every render, which made transient
  // exceptions (e.g. an assignment pointing at a stale person/deal id)
  // bubble out as a blank-screen crash for admins.
  const uniqueScopedDeals = useMemo(() => {
    const scoped = shouldScopeToOwnDeals && !accessLoading
      ? deals.filter(d => visibleDealIds.has(d.id))
      : deals;
    const dedup = shouldScopeToOwnDeals
      ? Array.from(new Map(scoped.map(d => [d.id, d])).values())
      : scoped;
    return dedup.filter(d => geoMatchesDeal(d));
  }, [deals, shouldScopeToOwnDeals, accessLoading, visibleDealIds, geoMatchesDeal]);

  const scopedDeals = uniqueScopedDeals;

  const activeBopmDeals = useMemo(() => (
    isBopmPersona
      ? uniqueScopedDeals.filter(d => ACTIVE_DEAL_STATUSES.has(d.dealStatus))
      : uniqueScopedDeals
  ), [isBopmPersona, uniqueScopedDeals]);

  const scopedAssignments = useMemo(() => {
    if (!(shouldScopeToOwnDeals && !accessLoading)) {
      // For admin: drop orphan assignments that point at deals we don't have.
      const dealIds = new Set(deals.map(d => d.id));
      const personIds = new Set(people.map(p => p.id));
      return assignments.filter(a => dealIds.has(a.dealId) && personIds.has(a.personId));
    }
    const ids = new Set(uniqueScopedDeals.map(d => d.id));
    const personIds = new Set(people.map(p => p.id));
    return assignments.filter(a => ids.has(a.dealId) && personIds.has(a.personId));
  }, [assignments, deals, people, uniqueScopedDeals, shouldScopeToOwnDeals, accessLoading]);

  const bopmActiveAssignments = useMemo(() => {
    if (!isBopmPersona) return scopedAssignments;
    const ids = new Set(activeBopmDeals.map(d => d.id));
    return scopedAssignments.filter(a => ids.has(a.dealId));
  }, [isBopmPersona, scopedAssignments, activeBopmDeals]);

  const scopedPeople = useMemo(() => {
    if (!(isBopmPersona && !accessLoading)) return people;
    const ids = new Set(bopmActiveAssignments.map(a => a.personId));
    return people.filter(p => ids.has(p.id));
  }, [isBopmPersona, accessLoading, bopmActiveAssignments, people]);

  if (loading || (shouldScopeToOwnDeals && accessLoading)) {
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
        { key: "staffing", label: "Staffing" },
        { key: "table",    label: "Sheet view" },
        { key: "requests", label: "Change requests" },
      ]
    : [
        { key: "overview", label: "Overview" },
        { key: "staffing", label: "Staffing" },
        { key: "table",    label: "Sheet view" },
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
              <div className="flex gap-1 bg-secondary rounded-lg p-1 border border-border/60">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => switchTab(t.key)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-ui font-medium transition-colors",
                      tab === t.key
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/40"
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
        <StaffingErrorBoundary>
        {isBopmPersona ? (
          <>
            <div className={cn(tab !== "staffing" && "hidden")}>
              {showBopmEmpty
                ? <BopmEmptyState section="Staffing & Capacity" />
                : hasVisited("staffing") ? (
                  <StaffingDealsList
                    deals={activeBopmDeals}
                    people={people}
                    assignments={bopmActiveAssignments}
                    isAdmin={false}
                    enableBopmFilter={false}
                    onAddAssignment={addAssignment}
                    onUpdateAssignment={updateAssignment}
                    onDeleteAssignment={deleteAssignment}
                  />
                ) : null
              }
            </div>
            <div className={cn(tab !== "table" && "hidden")}>
              {showBopmEmpty
                ? <BopmEmptyState section="Staffing & Capacity" />
                : hasVisited("table") ? (
                  <BopmStaffingFlatTable
                    deals={activeBopmDeals}
                    people={scopedPeople}
                    allPeople={people}
                    assignments={bopmActiveAssignments}
                    onUpdateDeal={updateDeal}
                  />
                ) : null
              }
            </div>
            <div className={cn(tab !== "requests" && "hidden")}>
              {hasVisited("requests") && (
                <MyStaffingRequests deals={uniqueScopedDeals} people={people} variant="table" />
              )}
            </div>
          </>
        ) : (
          <>
            <div className={cn(tab !== "overview" && "hidden")}>
              {hasVisited("overview") && (
                <OverviewTab
                  deals={scopedDeals}
                  people={people}
                  assignments={scopedAssignments}
                  onUpdateDeal={updateDeal}
                  bopmFilterScopedVsd={myVsdName}
                />
              )}
            </div>
            <div className={cn(tab !== "staffing" && "hidden")}>
              {hasVisited("staffing") && (
                <StaffingDealsList
                  deals={scopedDeals}
                  people={people}
                  assignments={scopedAssignments}
                  isAdmin={isActuallyAdmin}
                  enableBopmFilter
                  bopmFilterScopedVsd={myVsdName}
                  onAddAssignment={addAssignment}
                  onUpdateAssignment={updateAssignment}
                  onDeleteAssignment={deleteAssignment}
                  onUpdatePerson={updatePerson}
                />
              )}
            </div>
            <div className={cn(tab !== "table" && "hidden")}>
              {hasVisited("table") && (
                <BopmStaffingFlatTable
                  deals={scopedDeals}
                  people={people}
                  allPeople={people}
                  assignments={scopedAssignments}
                  directEdit
                  onAddAssignment={addAssignment}
                  onUpdateAssignment={updateAssignment}
                  onDeleteAssignment={deleteAssignment}
                  enableBopmFilter
                  bopmFilterScopedVsd={myVsdName}
                />
              )}
            </div>
          </>
        )}
        </StaffingErrorBoundary>
      </div>
    </AppLayout>
  );
}
