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

interface UserRoleState {
  role: AppRole | null;
  isAdmin: boolean;
  visibleRoutes: Set<string>;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useUserRole(): UserRoleState {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRole(null);
      setVisibleRoutes(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch user roles
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = (roleRows || []).map((r) => r.role as AppRole);
    // Admin takes precedence
    const effectiveRole: AppRole = userRoles.includes("admin") ? "admin" : "vsd";
    setRole(effectiveRole);

    // Fetch route visibility for that role
    const { data: visRows } = await supabase
      .from("route_visibility")
      .select("route_key, visible")
      .eq("role", effectiveRole);

    const visible = new Set<string>();
    (visRows || []).forEach((r) => {
      if (r.visible) visible.add(r.route_key);
    });
    setVisibleRoutes(visible);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  return {
    role,
    isAdmin: role === "admin",
    visibleRoutes,
    loading: authLoading || loading,
    refresh: load,
  };
}
