import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export interface CapabilityGroup {
  id: string;
  name: string;
  role_categories: string[];
}

export interface CapabilityState {
  loading: boolean;
  /** The viewer's own staffing person id, if mapped. */
  myPersonId: string | null;
  /** Capability groups the viewer belongs to. */
  myCapabilities: CapabilityGroup[];
  /** True if the viewer is a lead in any of those capabilities. */
  isLead: boolean;
  /** All staffing person ids that belong to the viewer's capability/team. */
  myTeamPersonIds: Set<string>;
}

/**
 * For Capability Leaders / Members — derives the team they own (or belong to)
 * from `capability_groups` + `capability_memberships`.
 */
export function useCapability(): CapabilityState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<CapabilityState>({
    loading: true,
    myPersonId: null,
    myCapabilities: [],
    isLead: false,
    myTeamPersonIds: new Set(),
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) setState({ loading: false, myPersonId: null, myCapabilities: [], isLead: false, myTeamPersonIds: new Set() });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles").select("staffing_person_id").eq("user_id", user.id).maybeSingle();
      const personId = (profile as any)?.staffing_person_id || null;

      if (!personId) {
        if (!cancelled) setState({ loading: false, myPersonId: null, myCapabilities: [], isLead: false, myTeamPersonIds: new Set() });
        return;
      }

      const { data: myMems } = await supabase
        .from("capability_memberships")
        .select("capability_id, is_lead")
        .eq("person_id", personId);

      const capIds = (myMems || []).map((m: any) => m.capability_id);
      if (capIds.length === 0) {
        if (!cancelled) setState({ loading: false, myPersonId: personId, myCapabilities: [], isLead: false, myTeamPersonIds: new Set() });
        return;
      }

      const [{ data: groups }, { data: teamMems }] = await Promise.all([
        supabase.from("capability_groups").select("id, name, role_categories").in("id", capIds),
        supabase.from("capability_memberships").select("person_id").in("capability_id", capIds),
      ]);

      if (cancelled) return;
      setState({
        loading: false,
        myPersonId: personId,
        myCapabilities: (groups || []) as CapabilityGroup[],
        isLead: (myMems || []).some((m: any) => m.is_lead),
        myTeamPersonIds: new Set((teamMems || []).map((m: any) => m.person_id)),
      });
    }
    load();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return state;
}