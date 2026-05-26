import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export interface ApplicabilityRow {
  id: string;
  dealId: string;
  departmentId: string;
  roleTypeId: string | null;
  isApplicable: boolean;
}

function rowFromDb(r: any): ApplicabilityRow {
  return {
    id: r.id,
    dealId: r.deal_id,
    departmentId: r.department_id,
    roleTypeId: r.role_type_id,
    isApplicable: !!r.is_applicable,
  };
}

async function fetchAll(): Promise<ApplicabilityRow[]> {
  const { data, error } = await supabase.from("deal_applicability").select("*");
  if (error) throw error;
  return (data || []).map(rowFromDb);
}

export function useDealApplicabilityQuery() {
  return useQuery({
    queryKey: qk.dealApplicability(),
    queryFn: fetchAll,
    staleTime: 60 * 1000,
  });
}

/**
 * Mutations: upsert (toggle dept OR per-role override) and clear (reset to default).
 */
export function useDealApplicabilityMutations() {
  const qc = useQueryClient();

  const refresh = () => qc.invalidateQueries({ queryKey: qk.dealApplicability() });

  const setDepartment = useMutation({
    mutationFn: async ({
      dealId,
      departmentId,
      isApplicable,
    }: {
      dealId: string;
      departmentId: string;
      isApplicable: boolean;
    }) => {
      // Delete existing dept-level row (role_type_id IS NULL) then insert.
      await supabase
        .from("deal_applicability")
        .delete()
        .eq("deal_id", dealId)
        .eq("department_id", departmentId)
        .is("role_type_id", null);
      if (isApplicable) {
        // Default is applicable; only insert when explicitly toggled off.
        return;
      }
      const { error } = await (supabase.from("deal_applicability") as any).insert({
        deal_id: dealId,
        department_id: departmentId,
        role_type_id: null,
        is_applicable: false,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const setRoleType = useMutation({
    mutationFn: async ({
      dealId,
      departmentId,
      roleTypeId,
      isApplicable,
    }: {
      dealId: string;
      departmentId: string;
      roleTypeId: string;
      isApplicable: boolean;
    }) => {
      const { error } = await (supabase.from("deal_applicability") as any).upsert(
        {
          deal_id: dealId,
          department_id: departmentId,
          role_type_id: roleTypeId,
          is_applicable: isApplicable,
        },
        { onConflict: "deal_id,department_id,role_type_id" },
      );
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const clearRoleOverride = useMutation({
    mutationFn: async ({ dealId, roleTypeId }: { dealId: string; roleTypeId: string }) => {
      await supabase
        .from("deal_applicability")
        .delete()
        .eq("deal_id", dealId)
        .eq("role_type_id", roleTypeId);
    },
    onSuccess: refresh,
  });

  const resetDeal = useMutation({
    mutationFn: async (dealId: string) => {
      await supabase.from("deal_applicability").delete().eq("deal_id", dealId);
    },
    onSuccess: refresh,
  });

  return { setDepartment, setRoleType, clearRoleOverride, resetDeal };
}