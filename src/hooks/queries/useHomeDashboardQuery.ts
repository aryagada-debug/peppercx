/**
 * Scoped Home dashboard queries — stub for Phase 2. Phase 4 wires
 * `Home.tsx` to these and replaces the .range()-based pulls.
 *
 * Each slice is a separate `useQuery` so the page can render incrementally
 * instead of waiting for one mega-Promise.all. The actual select() lists
 * and RPC calls (`home_my_tasks`, `home_my_deals`) are finalised in
 * Phase 4/6.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export function useMyTasksQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.homeTasks(userId ?? ""),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_todos")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyDealsQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.homeMyDeals(userId ?? ""),
    enabled: !!userId,
    queryFn: async () => {
      // Stub: actual scoped filter is added in Phase 4 (RPC home_my_deals).
      const { data, error } = await supabase
        .from("staffing_deals")
        .select("id, deal_name, deal_status, vsd, principal_bopm, senior_bopm, bopm")
        .neq("deal_status", "Closed Lost")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyNotificationsQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.homeNotifications(userId ?? ""),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}