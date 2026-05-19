/**
 * Home-page list queries (personal todos, user notifications, smart nudges).
 *
 * Replaces three imperative loaders + their ad-hoc realtime channels on
 * Home.tsx with shared React Query hooks. Each hook:
 *   - keys by user (and staffing_person_id for todos)
 *   - subscribes to its source table via the shared realtime bridge
 *   - exposes `optimistic*` helpers so the page can patch the cache
 *     directly when mutating (no full refetch needed).
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTableSubscription, invalidatePatcher } from "@/lib/realtime";

export interface PersonalTodo {
  id: string;
  user_id: string | null;
  title: string;
  notes: string;
  done: boolean;
  due_date: string | null;
  priority: string;
  sort_order: number;
  created_at?: string;
  assignee_staffing_person_id?: string | null;
  assigned_by_user_id?: string | null;
  assigned_by_name?: string | null;
  assignee_name?: string | null;
}

export interface UserNotification {
  id: string;
  type: string;
  actor_name: string;
  body: string;
  source_entity_type: string;
  source_entity_id: string;
  source_entity_name: string;
  cta_href: string;
  read: boolean;
  created_at: string;
}

export interface SmartNudge {
  id: string;
  type: string;
  text: string;
  target_entity_type: string;
  target_entity_id: string;
  target_entity_name: string;
  primary_action_label: string;
  primary_action_href: string;
  confidence: number;
  generated_at: string;
  snoozed_until: string | null;
}

const homeKeys = {
  todos: (userId: string, staffingPersonId: string | null) =>
    ["home", "todos", userId, staffingPersonId ?? ""] as const,
  notifications: (userId: string) => ["home", "notifications", userId] as const,
  nudges: (userId: string) => ["home", "nudges", userId] as const,
};

// --- todos ----------------------------------------------------------------

export function useHomeTodosQuery(userId: string | undefined, staffingPersonId: string | null) {
  const qc = useQueryClient();
  const key = homeKeys.todos(userId ?? "", staffingPersonId);

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const orParts = [`user_id.eq.${userId}`, `assigned_by_user_id.eq.${userId}`];
      if (staffingPersonId) orParts.push(`assignee_staffing_person_id.eq.${staffingPersonId}`);
      const { data, error } = await supabase
        .from("personal_todos")
        .select("*")
        .or(orParts.join(","))
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as PersonalTodo[]) || [];
    },
  });

  useTableSubscription({
    table: "personal_todos",
    enabled: !!userId,
    patcher: invalidatePatcher(key),
  });

  const patch = useCallback(
    (updater: (prev: PersonalTodo[]) => PersonalTodo[]) => {
      qc.setQueryData<PersonalTodo[]>(key, (prev) => updater(prev ?? []));
    },
    [qc, key],
  );

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: key });
  }, [qc, key]);

  return { ...query, patch, invalidate };
}

// --- notifications --------------------------------------------------------

export function useHomeNotificationsQuery(userId: string | undefined) {
  const qc = useQueryClient();
  const key = homeKeys.notifications(userId ?? "");

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data as UserNotification[]) || [];
    },
  });

  useTableSubscription({
    table: "user_notifications",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    patcher: invalidatePatcher(key),
  });

  const patch = useCallback(
    (updater: (prev: UserNotification[]) => UserNotification[]) => {
      qc.setQueryData<UserNotification[]>(key, (prev) => updater(prev ?? []));
    },
    [qc, key],
  );

  return { ...query, patch };
}

// --- nudges ---------------------------------------------------------------

export function useHomeNudgesQuery(userId: string | undefined) {
  const qc = useQueryClient();
  const key = homeKeys.nudges(userId ?? "");

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("smart_nudges")
        .select("*")
        .eq("user_id", userId!)
        .eq("dismissed", false)
        .order("generated_at", { ascending: false })
        .limit(20);
      return (data as SmartNudge[]) || [];
    },
  });

  useTableSubscription({
    table: "smart_nudges",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    patcher: invalidatePatcher(key),
  });

  const patch = useCallback(
    (updater: (prev: SmartNudge[]) => SmartNudge[]) => {
      qc.setQueryData<SmartNudge[]>(key, (prev) => updater(prev ?? []));
    },
    [qc, key],
  );

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: key });
  }, [qc, key]);

  return { ...query, patch, invalidate };
}
