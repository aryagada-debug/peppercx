import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { qk } from "@/lib/queryKeys";
import { ensureDealsLite } from "@/hooks/queries/useDealsLiteQuery";

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
 * Visibility is computed server-side by
 * `public.visible_deal_ids_for_user(uid)` which handles:
 * - admin → all deals
 * - VSDs / capability leads → own + entire reporting subtree's assigned and
 *   text-cell-tagged deals
 * - everyone else → only deals where they are assigned or named in a
 *   VSD/BOPM cell
 * Edit rights remain client-side: only admins can edit.
 */
export function useDealAccess(): DealAccessState {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, role, loading: roleLoading } = useUserRole();
  const qc = useQueryClient();

  const enabled = !authLoading && !roleLoading;
  const userId = user?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: qk.dealAccess(userId, role, isAdmin),
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const allDeals = await ensureDealsLite(qc);
      if (isAdmin || !user) {
        return { allDeals, visibleIds: null as Set<string> | null };
      }
      const { data: ids, error } = await supabase.rpc(
        "visible_deal_ids_for_user" as any,
        { _user_id: user.id },
      );
      if (error) {
        console.error("visible_deal_ids_for_user RPC failed", error);
        return { allDeals, visibleIds: new Set<string>() };
      }
      const set = new Set<string>(
        ((ids as any[]) || []).map((r) =>
          typeof r === "string" ? r : r.deal_id,
        ).filter(Boolean),
      );
      return { allDeals, visibleIds: set };
    },
  });

  const loading = !enabled || isLoading;
  const allDeals = data?.allDeals ?? [];
  const visibleIds = data?.visibleIds ?? null;

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

    // Non-admin: server-side RPC is the single source of truth.
    const visibleDealIds = visibleIds ?? new Set<string>();
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
      canViewDeal: (id: string) => visibleDealIds.has(id),
      canEditDeal: () => false,
      canViewClient: (id) => !!id && visibleClientIds.has(id),
      canEditClient: () => false,
    };
  }, [isAdmin, allDeals, visibleIds, loading]);

  return result;
}