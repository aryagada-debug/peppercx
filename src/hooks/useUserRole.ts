import { createContext, createElement, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export type AppRole = "admin" | "member" | "user" | "view_only";

export type AccessMode = "hidden" | "read" | "edit";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  member: "Member",
  user: "User",
  view_only: "View Only",
};

export const ROLE_ORDER: AppRole[] = ["view_only", "user", "member", "admin"];

export const ALL_ROUTE_KEYS = [
  "home",
  "dashboard",
  "clients",
  "staffing",
  "revenue",
  "targets",
  "central-cx",
  "rgy-health",
  "mbr-tracker",
  "slack-health",
  "onboarding",
  "deal-desk",
  "seo-staffing",
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
  const [actualRole, setActualRole] = useState<AppRole | null>(null);
  const [viewAsRole, setViewAsRoleState] = useState<AppRole | null>(null);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());
  const [routeAccess, setRouteAccess] = useState<Map<string, AccessMode>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(VIEW_AS_KEY);
    if (v === "admin" || v === "member" || v === "user" || v === "view_only") {
      setViewAsRoleState(v as AppRole);
    }
  }, []);

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
    if (!user) {
      setActualRole(null);
      setVisibleRoutes(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = (roleRows || []).map((r) => r.role as AppRole);
    // Pick the highest role the user has
    const trueRole: AppRole =
      userRoles.includes("admin") ? "admin"
      : userRoles.includes("member") ? "member"
      : userRoles.includes("view_only") ? "view_only"
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
      .eq("user_id", user.id);
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
    setLoading(false);
  }, [user, viewAsRole]);

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
