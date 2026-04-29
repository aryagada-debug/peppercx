import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";

/** Fuzzy name comparison: lowercase + collapse whitespace + strip punctuation. */
function nameTokens(s: string | null | undefined): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Returns true if `dealName` (e.g. "Anisha J") refers to `personName`
 * (e.g. "Anisha Jaisinghani") — token-based match so shortened cells in
 * deal sheets still resolve to the correct person.
 */
function nameMatchesPerson(dealName: string | null | undefined, personName: string | null | undefined): boolean {
  const a = nameTokens(dealName);
  const b = nameTokens(personName);
  if (a.length === 0 || b.length === 0) return false;
  if (a.join(" ") === b.join(" ")) return true;
  // First name must match exactly.
  if (a[0] !== b[0]) return false;
  // Each remaining token in the deal cell must be a prefix of some token in
  // the person name (so "J" matches "Jaisinghani", "Jais" matches too).
  for (let i = 1; i < a.length; i++) {
    const t = a[i];
    const ok = b.some((bt) => bt.startsWith(t) || t.startsWith(bt));
    if (!ok) return false;
  }
  return true;
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
  const [myRoleCategory, setMyRoleCategory] = useState<string>("");
  const [myDesignation, setMyDesignation] = useState<string>("");

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

      const { data: deals } = await dealsP;

      if (cancelled) return;
      setAllDeals(deals || []);
      setMyAssignedDealIds(assignedIds);
      setMyPersonName(personName);
      setMyRoleTitle(roleTitle);
      setMyRoleCategory(roleCategory);
      setMyDesignation(designation);
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

    const me = myPersonName || "";
    const looksLikeVsd =
      /\bvsd\b|vertical service delivery|service delivery (leader|director)/i.test(
        `${myRoleTitle} ${myDesignation}`,
      );

    // Build the set of BOPM-name keys that report into THIS VSD, derived
    // from the deals themselves (principal/senior BOPM ↔ vsd field), so a
    // VSD's pod includes both deals tagged to them AND deals where their
    // BOPMs appear without an explicit vsd cell.
    const bopmNamesForThisVsd: string[] = [];
    if (looksLikeVsd && me) {
      for (const d of allDeals) {
        if (!nameMatchesPerson(d.vsd, me)) continue;
        if (d.principal_bopm) bopmNamesForThisVsd.push(d.principal_bopm);
        if (d.senior_bopm) bopmNamesForThisVsd.push(d.senior_bopm);
      }
    }

    const ownDealIds = new Set<string>();
    for (const d of allDeals) {
      if (!me) continue;
      if (
        nameMatchesPerson(d.principal_bopm, me) ||
        nameMatchesPerson(d.senior_bopm, me) ||
        nameMatchesPerson(d.bopm, me)
      ) {
        ownDealIds.add(d.id);
        continue;
      }
      if (looksLikeVsd) {
        // 1. deal explicitly tagged to this VSD
        if (nameMatchesPerson(d.vsd, me)) {
          ownDealIds.add(d.id);
          continue;
        }
        // 2. deal has a principal/senior BOPM who reports to this VSD
        const matches = (cell: string | null) =>
          !!cell && bopmNamesForThisVsd.some((b) => nameMatchesPerson(cell, b) || nameMatchesPerson(b, cell));
        if (matches(d.principal_bopm) || matches(d.senior_bopm)) {
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
  }, [isAdmin, allDeals, myAssignedDealIds, myPersonName, myRoleTitle, myDesignation, myRoleCategory, loading]);

  return result;
}