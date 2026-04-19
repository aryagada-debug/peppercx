import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export type AppRole = "admin" | "vsd";

export const ALL_ROUTE_KEYS = [
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
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useUserRole(): UserRoleState {
  const { user, loading: authLoading } = useAuth();
  const [actualRole, setActualRole] = useState<AppRole | null>(null);
  const [viewAsRole, setViewAsRoleState] = useState<AppRole | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(VIEW_AS_KEY);
    return v === "vsd" || v === "admin" ? (v as AppRole) : null;
  });
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

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
    const trueRole: AppRole = userRoles.includes("admin") ? "admin" : "vsd";
    setActualRole(trueRole);

    const roleForVisibility: AppRole =
      trueRole === "admin" && viewAsRole ? viewAsRole : trueRole;

    const { data: visRows } = await supabase
      .from("route_visibility")
      .select("route_key, visible")
      .eq("role", roleForVisibility);

    const visible = new Set<string>();
    (visRows || []).forEach((r) => {
      if (r.visible) visible.add(r.route_key);
    });
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
    loading: authLoading || loading,
    refresh: load,
  };
}
