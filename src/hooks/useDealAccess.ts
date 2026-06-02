import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { dealCellMatchesPerson } from "@/hooks/queries/legacy";
import { qk } from "@/lib/queryKeys";
import { ensureDealsLite } from "@/hooks/queries/useDealsLiteQuery";
import { VSD_NAMES } from "@/hooks/queries/useVsdUsersQuery";

const VSD_NAME_KEYS = new Set(
  VSD_NAMES.map((n) => n.trim().toLowerCase()),
);
const VSD_FIRST_NAME_KEYS = new Set(
  VSD_NAMES.map((n) => n.trim().toLowerCase().split(/\s+/)[0]),
);

function isKnownVsdName(name: string | null | undefined): boolean {
  const k = (name || "").trim().toLowerCase();
  if (!k) return false;
  if (VSD_NAME_KEYS.has(k)) return true;
  const first = k.split(/\s+/)[0];
  return VSD_FIRST_NAME_KEYS.has(first);
}

interface DealAccessState {
  loading: boolean;
  isAdmin: boolean;
  visibleDealIds: Set<string>;
  editableDealIds: Set<string>;
  visibleClientIds: Set<string>;
  editableClientIds: Set<string>;
  canViewDeal: (dealId: string) => boolean;
  canEditDeal: (dealId: string) => boolean;
  canViewClient: (clientId: string | undefined | null) => boolean;
  canEditClient: (clientId: string | undefined | null) => boolean;
}

/**
 * Centralised access control for Clients & Deals.
 * - Admin: sees & edits everything.
 * - User mapped to a staffing person: sees only the deals where the deal sheet
 *   explicitly tags them in the matching access cell. Principal/Senior BOPMs
 *   are matched only against principal_bopm/senior_bopm; regular BOPMs are
 *   matched only against bopm. Legacy staffing_assignments rows never grant
 *   deal visibility.
 * - Anyone else: empty.
 */
export function useDealAccess(): DealAccessState {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, role, loading: roleLoading } = useUserRole();
  const qc = useQueryClient();

  const enabled = !authLoading && !roleLoading;
  const userId = user?.id ?? null;

  // React Query caches this snapshot across navigations so switching pages
  // doesn't re-issue 4-6 Supabase calls on every mount.
  const { data, isLoading } = useQuery({
    queryKey: qk.dealAccess(userId, role, isAdmin),
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const dealsP = ensureDealsLite(qc);
      const allPeopleP = supabase
        .from("staffing_people")
        .select("id, name, reporting_manager")
        .eq("leaving", false)
        .eq("tbh", false);

      if (isAdmin || !user) {
        const [deals, { data: peopleAll }] = await Promise.all([dealsP, allPeopleP]);
        return {
          allDeals: deals,
          allPersonNames: ((peopleAll as any[]) || []).map((p: any) => p.name).filter(Boolean),
          myAssignedDealIds: new Set<string>(),
          myPersonName: null as string | null,
          myRoleTitle: "",
          myRoleCategory: "",
          myDesignation: "",
          myTeamDealIds: new Set<string>(),
          myTeamPersonNames: [] as string[],
        };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("staffing_person_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const personId = (profile as any)?.staffing_person_id || null;

      let personName: string | null = null;
      let roleTitle = "";
      let roleCategory = "";
      let designation = "";
      let assignedIds = new Set<string>();

      if (personId) {
        const [{ data: person }, { data: assigns }] = await Promise.all([
          supabase
            .from("staffing_people")
            .select("name, role_title, role_category, designation")
            .eq("id", personId)
            .maybeSingle(),
          supabase
            .from("staffing_assignments")
            .select("deal_id")
            .eq("person_id", personId),
        ]);
        personName = (person as any)?.name || null;
        roleTitle = `${(person as any)?.role_title || ""} ${(person as any)?.designation || ""}`.trim();
        roleCategory = (person as any)?.role_category || "";
        designation = (person as any)?.designation || "";
        assignedIds = new Set((assigns || []).map((a: any) => a.deal_id));
      }

      const [deals, { data: peopleAll }] = await Promise.all([dealsP, allPeopleP]);
      const personNames = ((peopleAll as any[]) || []).map((p: any) => p.name).filter(Boolean);

      let teamDealIds = new Set<string>();
      let teamPersonNames: string[] = [];
      const looksLikeVsdRole =
        /\bvsd\b|vertical service delivery|service delivery (leader|director)/i.test(
          `${roleTitle} ${designation}`,
        );
      const treatAsVsd = !!personName && (looksLikeVsdRole || isKnownVsdName(personName));

      if (personId && (role === "capability_lead" || treatAsVsd)) {
        // Cap lead sees deals staffed on people whose reporting chain rolls
        // up to them (direct + indirect reportees), based on
        // staffing_people.reporting_manager (name-based).
        const peopleRows = (peopleAll as any[]) || [];
        const myName = (personName || "").trim().toLowerCase();
        if (myName) {
          const childrenByMgr = new Map<string, string[]>(); // mgr name (lc) → child ids
          for (const p of peopleRows) {
            const mgr = (p.reporting_manager || "").trim().toLowerCase();
            if (!mgr) continue;
            if (!childrenByMgr.has(mgr)) childrenByMgr.set(mgr, []);
            childrenByMgr.get(mgr)!.push(p.id);
          }
          const idToName = new Map<string, string>(
            peopleRows.map((p: any) => [p.id, (p.name || "").trim().toLowerCase()]),
          );
          const teamPersonIds = new Set<string>();
          const queue = [myName];
          const seen = new Set<string>([myName]);
          while (queue.length) {
            const mgrName = queue.shift()!;
            const kids = childrenByMgr.get(mgrName) || [];
            for (const childId of kids) {
              if (teamPersonIds.has(childId)) continue;
              teamPersonIds.add(childId);
              const childName = idToName.get(childId);
              if (childName && !seen.has(childName)) {
                seen.add(childName);
                queue.push(childName);
              }
            }
          }
          teamPersonNames = peopleRows
            .filter((p: any) => teamPersonIds.has(p.id))
            .map((p: any) => p.name)
            .filter(Boolean);
          if (teamPersonIds.size > 0) {
            const { data: teamAssigns } = await supabase
              .from("staffing_assignments")
              .select("deal_id")
              .in("person_id", Array.from(teamPersonIds));
            teamDealIds = new Set((teamAssigns || []).map((a: any) => a.deal_id));
          }
        }
      }

      return {
        allDeals: deals,
        allPersonNames: personNames,
        myAssignedDealIds: assignedIds,
        myPersonName: personName,
        myRoleTitle: roleTitle,
        myRoleCategory: roleCategory,
        myDesignation: designation,
        myTeamDealIds: teamDealIds,
        myTeamPersonNames: teamPersonNames,
      };
    },
  });

  const loading = !enabled || isLoading;
  const allDeals = data?.allDeals ?? [];
  const allPersonNames = data?.allPersonNames ?? [];
  const myAssignedDealIds = data?.myAssignedDealIds ?? new Set<string>();
  const myPersonName = data?.myPersonName ?? null;
  const myRoleTitle = data?.myRoleTitle ?? "";
  const myRoleCategory = data?.myRoleCategory ?? "";
  const myDesignation = data?.myDesignation ?? "";
  const myTeamDealIds = data?.myTeamDealIds ?? new Set<string>();
  const myTeamPersonNames = data?.myTeamPersonNames ?? [];

  const result = useMemo<DealAccessState>(() => {
    if (isAdmin) {
      const all = new Set(allDeals.map((d) => d.id));
      const allClients = new Set(
        allDeals.map((d) => d.client_id).filter((c): c is string => !!c)
      );
      return {
        loading,
        isAdmin: true,
        visibleDealIds: all,
        editableDealIds: all,
        visibleClientIds: allClients,
        editableClientIds: allClients,
        canViewDeal: () => true,
        canEditDeal: () => true,
        canViewClient: () => true,
        canEditClient: () => true,
      };
    }

    const me = myPersonName || "";
    const looksLikeVsdRole =
      /\bvsd\b|vertical service delivery|service delivery (leader|director)/i.test(
        `${myRoleTitle} ${myDesignation}`,
      );
    const looksLikeVsd = looksLikeVsdRole || isKnownVsdName(me);

    // Capability Leader → sees deals their whole team is staffed on.
    if (role === "capability_lead") {
      const visibleDealIds = new Set<string>(myTeamDealIds);
      // Editing on staffing/RGY for those deals; record visibility in clients/etc is read-only via Access Controls.
      const editableDealIds = new Set<string>();
      const visibleClientIds = new Set<string>();
      for (const d of allDeals) {
        if (d.client_id && visibleDealIds.has(d.id)) visibleClientIds.add(d.client_id);
      }
      return {
        loading,
        isAdmin: false,
        visibleDealIds,
        editableDealIds,
        visibleClientIds,
        editableClientIds: new Set<string>(),
        canViewDeal: (id) => visibleDealIds.has(id),
        canEditDeal: () => false,
        canViewClient: (id) => !!id && visibleClientIds.has(id),
        canEditClient: () => false,
      };
    }

    // Capability Member → only deals where they personally are assigned (with
    // a freshness guard to drop ghost assignment rows).
    if (role === "capability_member") {
      const visibleDealIds = new Set<string>(myAssignedDealIds);
      const visibleClientIds = new Set<string>();
      for (const d of allDeals) {
        if (d.client_id && visibleDealIds.has(d.id)) visibleClientIds.add(d.client_id);
      }
      return {
        loading,
        isAdmin: false,
        visibleDealIds,
        editableDealIds: new Set<string>(),
        visibleClientIds,
        editableClientIds: new Set<string>(),
        canViewDeal: (id) => visibleDealIds.has(id),
        canEditDeal: () => false,
        canViewClient: (id) => !!id && visibleClientIds.has(id),
        canEditClient: () => false,
      };
    }

    // VSD visibility is driven STRICTLY by the deal's `vsd` cell.
    // We intentionally do NOT expand to "deals whose principal/senior BOPM
    // reports to this VSD" — that pod-expansion was leaking deals where the
    // VSD cell points to someone else (or is blank) into this VSD's view.
    const ownDealIds = new Set<string>();
    const roleText = `${myRoleTitle} ${myRoleCategory} ${myDesignation}`.toLowerCase();
    const isPrincipalOrSeniorBopm =
      /\b(principal|senior|sr\.?)\s+bopm\b/.test(roleText)
      || /\bgroup\s+bopm\b/.test(roleText)
      || /principal\s+account\s+engagement\s+lead/.test(roleText)
      || (roleText.includes("bopm") && (roleText.includes("principal") || roleText.includes("senior") || roleText.includes("sr")));
    const isRegularBopm = /\bbopm\b/.test(roleText) && !isPrincipalOrSeniorBopm;

    // Strict BOPM/VSD match: reject deals where the cell could refer to
    // someone else with the same first name (e.g. "Shreshtha P" must not
    // match a different "Shreshtha" if one is also in Settings → People).
    for (const d of allDeals) {
      if (!me) continue;
      const matchesPrincipalOrSenior = isPrincipalOrSeniorBopm && (
        dealCellMatchesPerson(d.principal_bopm, me, allPersonNames) ||
        dealCellMatchesPerson(d.senior_bopm, me, allPersonNames)
      );
      const matchesRegularBopm = isRegularBopm && dealCellMatchesPerson(d.bopm, me, allPersonNames);
      if (matchesPrincipalOrSenior || matchesRegularBopm) {
        ownDealIds.add(d.id);
        continue;
      }
      if (looksLikeVsd) {
        // VSDs see deals tagged to them directly, or to any P/Sr BOPM / BOPM
        // in their reporting chain.
        if (dealCellMatchesPerson(d.vsd, me, allPersonNames)) {
          ownDealIds.add(d.id);
          continue;
        }
        let matched = false;
        for (const teamName of myTeamPersonNames) {
          if (
            dealCellMatchesPerson(d.principal_bopm, teamName, allPersonNames) ||
            dealCellMatchesPerson(d.senior_bopm, teamName, allPersonNames) ||
            dealCellMatchesPerson(d.bopm, teamName, allPersonNames)
          ) {
            matched = true;
            break;
          }
        }
        if (matched) ownDealIds.add(d.id);
      }
    }

    // Fallback: users who are neither VSD nor BOPM (e.g. view_only, sales,
    // ops, mis-classified roles) should still see any deal they are
    // explicitly marked on — either tagged in one of the deal's
    // VSD/BOPM cells, or staffed via `staffing_assignments`.
    if (!isPrincipalOrSeniorBopm && !isRegularBopm && !looksLikeVsd) {
      for (const d of allDeals) {
        if (myAssignedDealIds.has(d.id)) {
          ownDealIds.add(d.id);
          continue;
        }
        if (!me) continue;
        if (
          dealCellMatchesPerson(d.vsd, me, allPersonNames) ||
          dealCellMatchesPerson(d.principal_bopm, me, allPersonNames) ||
          dealCellMatchesPerson(d.senior_bopm, me, allPersonNames) ||
          dealCellMatchesPerson(d.bopm, me, allPersonNames)
        ) {
          ownDealIds.add(d.id);
        }
      }
    }

    // NOTE: We intentionally do NOT use `myAssignedDealIds` (rows from
    // `staffing_assignments`) to grant visibility here. That table contains
    // legacy/ghost rows that don't reflect the deal sheet's actual
    // BOPM/VSD cells, and using it leaks deals to people not tagged on
    // them (e.g. a Sr. BOPM seeing a deal where someone else is the
    // senior_bopm). Visibility is driven purely by what's in the deal
    // sheet, matching what the UI renders. `staffing_assignments` is
    // still used elsewhere (capacity / staffing math).

    // BOPMs see ONLY their own tagged/staffed deals — not peer deals
    // in the same VSD pod. (Earlier the hook expanded to same-VSD peers
    // as read-only, which leaked the entire pod into Clients/Staffing/
    // MBR/RGY.)
    const visibleDealIds = new Set<string>(ownDealIds);
    // BOPMs / non-admin users are READ-ONLY on Clients & Deals.
    // They can view their mapped deals but cannot add, edit, or remove
    // clients, deals, or any related records. Editing is reserved for
    // admins (handled in the isAdmin branch above).
    const editableDealIds = new Set<string>();

    const visibleClientIds = new Set<string>();
    const editableClientIds = new Set<string>();
    for (const d of allDeals) {
      if (!d.client_id) continue;
      if (visibleDealIds.has(d.id)) visibleClientIds.add(d.client_id);
    }

    return {
      loading,
      isAdmin: false,
      visibleDealIds,
      editableDealIds,
      visibleClientIds,
      editableClientIds,
      canViewDeal: (id: string) => visibleDealIds.has(id),
      canEditDeal: (id: string) => editableDealIds.has(id),
      canViewClient: (id) => !!id && visibleClientIds.has(id),
      canEditClient: (id) => !!id && editableClientIds.has(id),
    };
  }, [isAdmin, role, allDeals, allPersonNames, myAssignedDealIds, myTeamDealIds, myTeamPersonNames, myPersonName, myRoleTitle, myDesignation, myRoleCategory, loading]);

  return result;
}