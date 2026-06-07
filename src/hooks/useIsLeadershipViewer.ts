import { useUserRole } from "@/hooks/useUserRole";

/**
 * Leadership viewers (Admin, VSD, Capability Lead) can see and action
 * all leadership intervention requests across deals.
 * Mirrors the SQL helper `public.is_leadership_viewer(uuid)`.
 */
export function useIsLeadershipViewer(): boolean {
  const { actualRole } = useUserRole();
  return actualRole === "admin" || actualRole === "member" || actualRole === "capability_lead";
}