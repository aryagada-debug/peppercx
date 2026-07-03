import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * RGY editing is allowed for:
 *  - App roles: admin, member (VSD), capability_lead
 *  - Staffing titles: VSD, Principal BOPM, Group BOPM, Senior/Sr BOPM, BOPM
 */
function normalize(title: string): string {
  const t = title.toLowerCase().trim().replace(/\./g, "");
  if (/\bvsd\b/.test(t) || /vertical service delivery/.test(t)) return "vsd";
  if (/principal\s+bopm/.test(t)) return "principal_bopm";
  if (/group\s+bopm/.test(t)) return "principal_bopm";
  if (/(senior|sr)\s+bopm/.test(t)) return "senior_bopm";
  if (/^bopm$/.test(t)) return "bopm";
  return t;
}

const ALLOWED_TITLES = new Set(["vsd", "principal_bopm", "senior_bopm", "bopm"]);

export function useCanEditRgy(): { canEdit: boolean; loading: boolean } {
  const { user } = useAuth();
  const { actualRole, loading: roleLoading } = useUserRole();
  const [titleAllowed, setTitleAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setTitleAllowed(false); return; }
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("staffing_person_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const pid = (prof as any)?.staffing_person_id;
      if (!pid) { if (!cancelled) setTitleAllowed(false); return; }
      const { data: person } = await supabase
        .from("staffing_people")
        .select("role_title, designation, role_category")
        .eq("id", pid)
        .maybeSingle();
      if (cancelled) return;
      const blob = [person?.role_title, (person as any)?.designation, (person as any)?.role_category]
        .filter(Boolean).join(" ");
      setTitleAllowed(ALLOWED_TITLES.has(normalize(blob)));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const roleAllowed =
    actualRole === "admin" || actualRole === "member" || actualRole === "capability_lead";
  const canEdit = roleAllowed || titleAllowed === true;
  return { canEdit, loading: roleLoading || titleAllowed === null };
}