import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const TOKEN_KEY = "lovable.gcal.provider_token";
const TOKEN_EXP_KEY = "lovable.gcal.provider_token_exp";

const CAL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  htmlLink?: string;
  attendees?: { email: string; responseStatus?: string }[];
}

function readToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  const exp = Number(localStorage.getItem(TOKEN_EXP_KEY) || 0);
  if (!t) return null;
  // If we know the expiry and it's in the past, treat as missing
  if (exp && exp < Date.now()) return null;
  return t;
}
function writeToken(token: string | null, expiresInSec?: number) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresInSec) {
    localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + expiresInSec * 1000 - 60_000));
  } else {
    // Default Google access tokens last 3600s — assume 55 min remaining if unknown
    localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + 55 * 60_000));
  }
}

/** Shared Google Calendar hook. Per-user, browser-based (uses provider_token). */
export function useGoogleCalendar() {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [connecting, setConnecting] = useState(false);

  // Capture provider_token whenever a session refresh delivers one
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.provider_token) {
        writeToken(session.provider_token);
        setToken(session.provider_token);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token && !readToken()) {
        writeToken(session.provider_token);
        setToken(session.provider_token);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const connected = !!token;

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.href,
        extraParams: {
          prompt: "consent",
          access_type: "offline",
          scope: CAL_SCOPES,
          include_granted_scopes: "true",
        },
      });
      if (result.error) {
        toast.error("Could not connect Google Calendar");
        console.error(result.error);
      }
      // If redirected, browser navigates away; otherwise tokens are set by AuthProvider
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    writeToken(null);
    setToken(null);
    toast.success("Calendar disconnected from this browser");
  }, []);

  const ensureToken = useCallback((): string | null => {
    const t = readToken();
    if (!t) {
      toast.error("Calendar session expired — please reconnect");
      setToken(null);
      return null;
    }
    return t;
  }, []);

  const listEvents = useCallback(
    async (opts?: { timeMin?: string; timeMax?: string; q?: string; maxResults?: number }): Promise<GCalEvent[]> => {
      const t = ensureToken();
      if (!t) return [];
      const { data, error } = await supabase.functions.invoke("google-calendar-proxy", {
        body: { access_token: t, ...opts },
      });
      if (error) {
        console.error("listEvents error", error);
        return [];
      }
      return ((data?.events as any[]) || []).map((e) => ({
        id: e.id,
        summary: e.summary || "(No title)",
        description: e.description || "",
        start: e.start?.dateTime || e.start?.date || "",
        end: e.end?.dateTime || e.end?.date || "",
        htmlLink: e.htmlLink,
        attendees: e.attendees || [],
      }));
    },
    [ensureToken],
  );

  const createEvent = useCallback(
    async (input: { summary: string; description?: string; start: string; end: string; attendees?: string[]; location?: string }) => {
      const t = ensureToken();
      if (!t) return null;
      const { data, error } = await supabase.functions.invoke("google-calendar-create", {
        body: { access_token: t, ...input },
      });
      if (error || data?.error) {
        toast.error("Failed to create calendar event");
        console.error("createEvent", error || data);
        return null;
      }
      return data.event as { id: string; htmlLink?: string };
    },
    [ensureToken],
  );

  const updateEvent = useCallback(
    async (event_id: string, patch: { summary?: string; description?: string; start?: string; end?: string; attendees?: string[]; location?: string }) => {
      const t = ensureToken();
      if (!t) return null;
      const { data, error } = await supabase.functions.invoke("google-calendar-update", {
        body: { access_token: t, event_id, ...patch },
      });
      if (error || data?.error) {
        toast.error("Failed to update calendar event");
        console.error("updateEvent", error || data);
        return null;
      }
      return data.event as { id: string; htmlLink?: string };
    },
    [ensureToken],
  );

  const deleteEvent = useCallback(
    async (event_id: string) => {
      const t = ensureToken();
      if (!t) return false;
      const { data, error } = await supabase.functions.invoke("google-calendar-delete", {
        body: { access_token: t, event_id },
      });
      if (error || data?.error) {
        console.error("deleteEvent", error || data);
        return false;
      }
      return true;
    },
    [ensureToken],
  );

  return { connected, connecting, connect, disconnect, listEvents, createEvent, updateEvent, deleteEvent };
}