import { createContext, createElement, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export type AppRole =
  | "admin"
  | "member"
  | "user"
  | "capability_lead"
  | "capability_member"
  | "view_only";

export type AccessMode = "hidden" | "read" | "edit";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin / Central CX",
  member: "VSD",
  user: "BOPM",
  capability_lead: "Capability Leader",
  capability_member: "Capability Member",
  view_only: "View Only",
};

// Higher index = more powerful when collapsing multiple role rows for one user.
export const ROLE_ORDER: AppRole[] = [
  "view_only",
  "capability_member",
  "user",
  "capability_lead",
  "member",
  "admin",
];

export const ALL_ROUTE_KEYS = [
  "home",
  "dashboard",
  "clients",
  "staffing",
  "targets",
  "central-cx",
  "rgy-health",
  "mbr-tracker",
  "onboarding",
  "deal-desk",
  "gm2-calculator",
  "settings",
] as const;

export type RouteKey = typeof ALL_ROUTE_KEYS[number];

const VIEW_AS_KEY = "vsd-os.view-as-role";

interface UserRoleState {
  role: AppRole | null;          // effective role (respects view-as override)
  actualRole: AppRole | null;    // true role from DB
  isAdmin: boolean;              // effective admin status
  isActuallyAdmin: boolean;      // true admin status (for showing the toggle)
  viewAsRole: AppRole | null;    // current override, or null
  setViewAsRole: (r: AppRole | null) => void;
  visibleRoutes: Set<string>;
  routeAccess: Map<string, AccessMode>;
  canEditRoute: (routeKey: string) => boolean;
  isRouteReadOnly: (routeKey: string) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  canEditAll: boolean;
  canEditOwn: boolean;
  isReadOnly: boolean;
}

const UserRoleContext = createContext<UserRoleState | null>(null);

function useUserRoleInternal(): UserRoleState {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [actualRole, setActualRole] = useState<AppRole | null>(null);
  // Lazy initialiser — read localStorage once on mount so we never start
  // with `null` and then immediately re-fetch after hydrating.
  const [viewAsRole, setViewAsRoleState] = useState<AppRole | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(VIEW_AS_KEY);
    if (
      v === "admin" || v === "member" || v === "user" ||
      v === "capability_lead" || v === "capability_member" || v === "view_only"
    ) return v as AppRole;
    return null;
  });
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());
  const [routeAccess, setRouteAccess] = useState<Map<string, AccessMode>>(new Map());
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const effectiveRole: AppRole | null = (() => {
    if (!actualRole) return null;
    if (actualRole === "admin" && viewAsRole) return viewAsRole;
    return actualRole;
  })();

  const setViewAsRole = useCallback((r: AppRole | null) => {
    setViewAsRoleState(r);
    if (typeof window !== "undefined") {
      if (r) localStorage.setItem(VIEW_AS_KEY, r);
      else localStorage.removeItem(VIEW_AS_KEY);
    }
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setActualRole(null);
      setVisibleRoutes(new Set());
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setLoading(true);
    try {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

    const userRoles = (roleRows || []).map((r) => r.role as AppRole);
    // Pick the highest role the user has based on ROLE_ORDER.
    const trueRole: AppRole = userRoles.length
      ? userRoles.reduce(
          (best, r) => (ROLE_ORDER.indexOf(r) > ROLE_ORDER.indexOf(best) ? r : best),
          userRoles[0],
        )
      : "user";
    setActualRole(trueRole);

    const roleForVisibility: AppRole =
      trueRole === "admin" && viewAsRole ? viewAsRole : trueRole;

    const { data: visRows } = await supabase
      .from("route_visibility")
      .select("route_key, visible, access_mode")
      .eq("role", roleForVisibility);

    const access = new Map<string, AccessMode>();
    (visRows || []).forEach((r) => {
      const m = (r as any).access_mode as AccessMode | null;
      const fallback: AccessMode = roleForVisibility === "view_only" ? "read" : "edit";
      const mode: AccessMode =
        m === "hidden" || m === "read" || m === "edit"
          ? m
          : r.visible
          ? fallback
          : "hidden";
      access.set(r.route_key, mode);
    });

    // Apply per-user overrides on top
    const { data: overrides } = await supabase
      .from("user_route_overrides")
      .select("route_key, visible, access_mode")
      .eq("user_id", userId);
    (overrides || []).forEach((o: any) => {
      const mode: AccessMode =
        o.access_mode === "hidden" || o.access_mode === "read" || o.access_mode === "edit"
          ? o.access_mode
          : o.visible
          ? "edit"
          : "hidden";
      access.set(o.route_key, mode);
    });

    const visible = new Set<string>();
    access.forEach((mode, key) => {
      if (mode !== "hidden") visible.add(key);
    });
    setRouteAccess(access);
    setVisibleRoutes(visible);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [userId, viewAsRole]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  return {
    role: effectiveRole,
    actualRole,
    isAdmin: effectiveRole === "admin",
    isActuallyAdmin: actualRole === "admin",
    viewAsRole,
    setViewAsRole,
    visibleRoutes,
    routeAccess,
    canEditRoute: (routeKey: string) => (routeAccess.get(routeKey) ?? "hidden") === "edit",
    isRouteReadOnly: (routeKey: string) => routeAccess.get(routeKey) === "read",
    loading: authLoading || loading,
    refresh: load,
    canEditAll: effectiveRole === "admin" || effectiveRole === "member",
    canEditOwn: effectiveRole === "admin" || effectiveRole === "member" || effectiveRole === "user",
    isReadOnly: effectiveRole === "view_only",
  };
}

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const value = useUserRoleInternal();
  return createElement(UserRoleContext.Provider, { value }, children);
}

export function useUserRole(): UserRoleState {
  const ctx = useContext(UserRoleContext);
  if (!ctx) {
    throw new Error("useUserRole must be used within <UserRoleProvider>");
  }
  return ctx;
}
