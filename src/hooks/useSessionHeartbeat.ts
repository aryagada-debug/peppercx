import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

// Logs a row in `user_sessions` on mount and pings `last_seen_at` every 60s
// while the tab is active. A "session" is implicitly ended when heartbeats
// stop (i.e. last_seen_at - started_at gives the session length).
const HEARTBEAT_MS = 60_000;

export function useSessionHeartbeat() {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      sessionIdRef.current = null;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("user_sessions")
        .insert({
          user_id: user.id,
          user_agent: navigator.userAgent.slice(0, 500),
        })
        .select("id")
        .single();
      if (cancelled || error || !data) return;
      sessionIdRef.current = data.id;

      const ping = async () => {
        if (document.hidden || !sessionIdRef.current) return;
        await supabase
          .from("user_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", sessionIdRef.current);
      };
      timerRef.current = window.setInterval(ping, HEARTBEAT_MS);

      const onVisible = () => { if (!document.hidden) void ping(); };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("beforeunload", () => { void ping(); });
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [user?.id]);
}
