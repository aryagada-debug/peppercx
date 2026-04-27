import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";

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
 * - User mapped to a staffing person: sees the deals they're "on" (listed as
 *   principal/senior/regular BOPM, or assigned via staffing_assignments).
 *   BOPM-tier users additionally see (read-only) every deal that shares a VSD
 *   with one of their own deals.
 * - Anyone else: empty.
 */
export function useDealAccess(): DealAccessState {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [allDeals, setAllDeals] = useState<
    {
      id: string;
      client_id: string | null;
      vsd: string | null;
      principal_bopm: string | null;
      senior_bopm: string | null;
      bopm: string | null;
    }[]
  >([]);
  const [myAssignedDealIds, setMyAssignedDealIds] = useState<Set<string>>(new Set());
  const [myPersonName, setMyPersonName] = useState<string | null>(null);
  const [myRoleTitle, setMyRoleTitle] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (authLoading || roleLoading) return;
      setLoading(true);

      // Always need the deal universe (id, client, vsd, bopm fields).
      const dealsP = supabase
        .from("staffing_deals")
        .select("id, client_id, vsd, principal_bopm, senior_bopm, bopm");

      // Admin: skip user-specific lookups.
      if (isAdmin) {
        const { data: deals } = await dealsP;
        if (cancelled) return;
        setAllDeals(deals || []);
        setMyAssignedDealIds(new Set());
        setMyPersonName(null);
        setMyRoleTitle("");
        setLoading(false);
        return;
      }

      if (!user) {
        const { data: deals } = await dealsP;
        if (cancelled) return;
        setAllDeals(deals || []);
        setMyAssignedDealIds(new Set());
        setMyPersonName(null);
        setMyRoleTitle("");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("staffing_person_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const personId = (profile as any)?.staffing_person_id || null;

      let personName: string | null = null;
      let roleTitle = "";
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
        assignedIds = new Set((assigns || []).map((a: any) => a.deal_id));
      }

      const { data: deals } = await dealsP;

      if (cancelled) return;
      setAllDeals(deals || []);
      setMyAssignedDealIds(assignedIds);
      setMyPersonName(personName);
      setMyRoleTitle(roleTitle);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, roleLoading, isAdmin]);

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

    const nameNorm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
    const me = nameNorm(myPersonName);
    const isBopmTier =
      /bopm|principal|senior/i.test(myRoleTitle) || !!myPersonName; // any BOPM-named person; we treat anyone with own deals as eligible for peer-VSD view if they look like a BOPM.
    const looksLikeBopm = /bopm|principal|senior/i.test(myRoleTitle);

    const ownDealIds = new Set<string>();
    for (const d of allDeals) {
      if (myAssignedDealIds.has(d.id)) {
        ownDealIds.add(d.id);
        continue;
      }
      if (!me) continue;
      if (
        nameNorm(d.principal_bopm) === me ||
        nameNorm(d.senior_bopm) === me ||
        nameNorm(d.bopm) === me
      ) {
        ownDealIds.add(d.id);
      }
    }

    // Peer (same-VSD) deals — view-only, BOPM-tier only.
    const ownVsds = new Set<string>();
    if (looksLikeBopm) {
      for (const d of allDeals) {
        if (ownDealIds.has(d.id) && d.vsd) ownVsds.add(d.vsd.trim());
      }
    }
    const peerDealIds = new Set<string>();
    if (looksLikeBopm && ownVsds.size > 0) {
      for (const d of allDeals) {
        if (ownDealIds.has(d.id)) continue;
        if (d.vsd && ownVsds.has(d.vsd.trim())) peerDealIds.add(d.id);
      }
    }

    const visibleDealIds = new Set<string>([...ownDealIds, ...peerDealIds]);
    const editableDealIds = new Set<string>(ownDealIds);

    const visibleClientIds = new Set<string>();
    const editableClientIds = new Set<string>();
    for (const d of allDeals) {
      if (!d.client_id) continue;
      if (visibleDealIds.has(d.id)) visibleClientIds.add(d.client_id);
      if (editableDealIds.has(d.id)) editableClientIds.add(d.client_id);
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
  }, [isAdmin, allDeals, myAssignedDealIds, myPersonName, myRoleTitle, loading]);

  return result;
}