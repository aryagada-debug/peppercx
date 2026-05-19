/**
 * Centralized Supabase realtime → React Query bridge.
 *
 * Replaces the ~35 ad-hoc `supabase.channel(...).on(...).subscribe()` blocks
 * scattered across hooks and pages. Two design goals:
 *
 *   1. **One channel per unique `(table, filter)` pair across the whole app.**
 *      Refcounted; when no component is observing, the channel closes.
 *
 *   2. **Patch the React Query cache from the row payload.**
 *      The old pattern was `.on(..., () => loadX())` which re-fetched the
 *      entire table on every row change. With payload-based patching we
 *      only touch the row that actually changed.
 */
import { useEffect } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

export type RealtimePatcher = (payload: RealtimePayload, qc: QueryClient) => void;

type ChannelEntry = {
  channel: RealtimChannelHandle;
  refCount: number;
  listeners: Set<RealtimePatcher>;
};

type RealtimChannelHandle = RealtimeChannel;

const channels = new Map<string, ChannelEntry>();
let visibilityListenerBound = false;
const pendingReplay = new Set<() => void>();

function bindVisibilityListener() {
  if (visibilityListenerBound || typeof document === "undefined") return;
  visibilityListenerBound = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      pendingReplay.forEach((fn) => fn());
      pendingReplay.clear();
    }
  });
}

function channelKey(table: string, filter?: string) {
  return `${table}|${filter ?? ""}`;
}

/**
 * Subscribe to row-level changes on a Supabase table and patch the
 * React Query cache when they arrive.
 *
 * Multiple subscribers to the same `(table, filter)` share one underlying
 * channel. Each subscriber's `patcher` is called for every payload it cares
 * about; `defaultListPatcher` covers the common list-keyed-by-id case.
 */
export function useTableSubscription(opts: {
  table: string;
  filter?: string;
  patcher: RealtimePatcher;
  enabled?: boolean;
}) {
  const { table, filter, patcher, enabled = true } = opts;
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    bindVisibilityListener();

    const key = channelKey(table, filter);
    let entry = channels.get(key);

    if (!entry) {
      const listeners = new Set<RealtimePatcher>();
      const channel = supabase.channel(`rt:${key}`);
      const handler = (raw: { eventType: string; new: any; old: any }) => {
        const payload: RealtimePayload = {
          eventType: raw.eventType as RealtimePayload["eventType"],
          new: raw.new ?? {},
          old: raw.old ?? {},
        };
        const fire = () => listeners.forEach((fn) => fn(payload, qc));
        if (typeof document !== "undefined" && document.hidden) {
          // Defer until tab becomes visible again; on resume we just invalidate
          // the relevant queries so React Query refetches with fresh data.
          pendingReplay.add(fire);
        } else {
          fire();
        }
      };
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) } as any,
        handler as any,
      );
      channel.subscribe();
      entry = { channel, refCount: 0, listeners };
      channels.set(key, entry);
    }

    entry.listeners.add(patcher);
    entry.refCount += 1;
    const captured = entry;

    return () => {
      captured.listeners.delete(patcher);
      captured.refCount -= 1;
      if (captured.refCount <= 0) {
        supabase.removeChannel(captured.channel);
        channels.delete(key);
      }
    };
  }, [table, filter, enabled, patcher, qc]);
}

/**
 * Default patcher for queries that return `T[]` keyed by `id`.
 * INSERT appends, UPDATE replaces, DELETE removes.
 *
 * Pass this directly when your query data is a plain list of rows with
 * stable ids. For richer cache shapes (paginated, grouped, etc.), write
 * a custom patcher.
 */
export function defaultListPatcher<T extends { id: string }>(queryKey: QueryKey): RealtimePatcher {
  return (payload, qc) => {
    const data = qc.getQueryData<T[] | undefined>(queryKey);
    if (!data) return; // nothing cached yet, next fetch will pick it up
    if (payload.eventType === "INSERT") {
      qc.setQueryData<T[]>(queryKey, [...data, payload.new as T]);
    } else if (payload.eventType === "UPDATE") {
      const next = payload.new as T;
      qc.setQueryData<T[]>(queryKey, data.map((row) => (row.id === next.id ? next : row)));
    } else if (payload.eventType === "DELETE") {
      const oldId = (payload.old as { id?: string }).id;
      if (oldId) qc.setQueryData<T[]>(queryKey, data.filter((row) => row.id !== oldId));
    }
  };
}

/**
 * Convenience patcher that simply invalidates the given query when any
 * row event fires. Use when the cached shape is too complex to patch
 * incrementally — preserves the "refetch on change" semantics of the
 * old code with no other plumbing.
 */
export function invalidatePatcher(queryKey: QueryKey): RealtimePatcher {
  return (_payload, qc) => {
    qc.invalidateQueries({ queryKey });
  };
}