import { useEffect, useState } from "react";
import { loadStaleRgy, type StaleRgyMap } from "@/lib/staleRgy";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to deal_rgy_weekly and expose a map of stale-RGY metadata
 * for the supplied deal ids (or all deals if none supplied).
 */
export function useStaleRgy(dealIds?: string[]) {
  const [map, setMap] = useState<StaleRgyMap>(new Map());
  const [loading, setLoading] = useState(true);

  const key = (dealIds || []).slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadStaleRgy(dealIds).then(m => {
      if (!cancelled) {
        setMap(m);
        setLoading(false);
      }
    });
    const channel = supabase
      .channel(`stale-rgy-${key || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_rgy_weekly" }, () => {
        loadStaleRgy(dealIds).then(m => { if (!cancelled) setMap(m); });
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { staleRgy: map, loading };
}