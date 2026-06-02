import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { routeKeyFromPath } from "@/lib/routeKey";

// Logs one row per page view to `user_page_views`. Skips auth/public routes
// and dedupes identical consecutive paths within 1.5s so a single navigation
// doesn't double-count.
export function useRouteTracking() {
  const { user } = useAuth();
  const location = useLocation();
  const lastRef = useRef<{ path: string; at: number }>({ path: "", at: 0 });

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    const routeKey = routeKeyFromPath(path);
    if (routeKey === "auth") return;

    const now = Date.now();
    if (lastRef.current.path === path && now - lastRef.current.at < 1500) return;
    lastRef.current = { path, at: now };

    void supabase.from("user_page_views").insert({
      user_id: user.id,
      route_key: routeKey,
      path,
    });
  }, [user?.id, location.pathname]);
}

export function RouteTracker() {
  useRouteTracking();
  return null;
}