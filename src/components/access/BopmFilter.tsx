import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVsdUsers, useBopmDirectory, nameKey, dealCellMatchesPerson } from "@/hooks/useAppUsers";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  value: string;            // "All" or a BOPM display name
  onChange: (v: string) => void;
  /** Optional: scope BOPM list to a specific VSD (e.g. when admin has picked a VSD). */
  scopedVsd?: string | null;
  className?: string;
}

/**
 * Compact "Filter by BOPM" selector.
 * - VSDs see the BOPMs in their pod.
 * - Admins see all BOPMs (or scoped to the VSD they've picked elsewhere).
 * - Hidden for plain BOPM/user roles (their data is already scoped to them).
 */
export function BopmFilter({ value, onChange, scopedVsd, className }: Props) {
  const { isAdmin, isActuallyAdmin, viewAsRole } = useUserRole();
  const { user } = useAuth();
  const { allBopmUsers, bopmUsersForVsd } = useBopmDirectory();
  const { canonVsd } = useVsdUsers();
  const [myVsdName, setMyVsdName] = useState<string | null>(null);

  // Resolve the logged-in person's VSD context (if they ARE a VSD).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) { setMyVsdName(null); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("staffing_person_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const personId = (profile as any)?.staffing_person_id;
      if (!personId) { if (!cancelled) setMyVsdName(null); return; }
      const { data: person } = await supabase
        .from("staffing_people")
        .select("name, role_title, designation")
        .eq("id", personId)
        .maybeSingle();
      const p: any = person;
      if (!p) { if (!cancelled) setMyVsdName(null); return; }
      const looksLikeVsd = /\bvsd\b|vertical service delivery|service delivery (leader|director)/i
        .test(`${p.role_title || ""} ${p.designation || ""}`);
      const canon = canonVsd(p.name);
      if (!cancelled) setMyVsdName(looksLikeVsd && canon ? canon : null);
    }
    load();
    return () => { cancelled = true; };
  }, [user, canonVsd]);

  // VSD-as-real-role (or admin viewing-as VSD) → scope to own pod.
  // Admin (no view-as) → all BOPMs (or scopedVsd if provided).
  // Anyone else → hide.
  const effectiveScopedVsd = scopedVsd
    || myVsdName
    || (isActuallyAdmin && viewAsRole === "member" ? null : null);

  // Source list of BOPM users = Settings → People. For VSDs we restrict to
  // people whose reportingManager chain rolls up to that VSD. For admins
  // (or admin viewing-as VSD without a specific pod) we fall back to ALL
  // Principal/Senior BOPMs so the filter still renders.
  const showAllForAdminLike = isAdmin || (isActuallyAdmin && viewAsRole === "member");
  const options = useMemo(() => {
    const list = effectiveScopedVsd
      ? bopmUsersForVsd(effectiveScopedVsd)
      : (showAllForAdminLike ? allBopmUsers : []);
    return list.map((p) => p.name).filter(Boolean);
  }, [effectiveScopedVsd, showAllForAdminLike, bopmUsersForVsd, allBopmUsers]);

  // Hide entirely if there are no options to choose from (e.g. plain BOPM user).
  if (options.length === 0) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className || "h-8 w-[180px] text-[11px]"}>
        <SelectValue placeholder="Filter by BOPM" />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        <SelectItem value="All">All BOPMs</SelectItem>
        {options.map((b) => (
          <SelectItem key={nameKey(b)} value={b}>{b}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Helper: does a deal's Principal/Senior BOPM fields match the selected BOPM filter? */
export function dealMatchesBopm(
  deal: { principalBopm?: string | null; seniorBopm?: string | null; bopm?: string | null;
          principal_bopm?: string | null; senior_bopm?: string | null; },
  selected: string,
  registeredNames: string[] = [],
): boolean {
  if (!selected || selected === "All") return true;
  const fields: Array<string | null | undefined> = [
    (deal as any).principalBopm ?? (deal as any).principal_bopm,
    (deal as any).seniorBopm ?? (deal as any).senior_bopm,
  ];
  // Strict identity match: a deal cell like "Shreshtha P" matches the
  // filter "Shreshtha Pathak" only when no other registered person could
  // also satisfy that cell. Pass `registeredNames` from Settings → People
  // so the ambiguity guard works reliably across the app.
  return fields.some((v) => v && dealCellMatchesPerson(v, selected, registeredNames));
}