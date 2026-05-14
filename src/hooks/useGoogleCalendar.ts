import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  htmlLink?: string;
  attendees?: { email: string; responseStatus?: string }[];
  location?: string;
  hangoutLink?: string;
  conferenceData?: any;
}

function getCalendarCallbackUri() {
  return `${window.location.origin}/calendar/callback`;
}

function normalizeEvents(events: any[] = []): GCalEvent[] {
  return events.map((e) => ({
    id: e.id,
    summary: e.summary || "(No title)",
    description: e.description || "",
    start: e.start?.dateTime || e.start?.date || "",
    end: e.end?.dateTime || e.end?.date || "",
    htmlLink: e.htmlLink,
    attendees: e.attendees || [],
    location: e.location || "",
    hangoutLink: e.hangoutLink || "",
    conferenceData: e.conferenceData || null,
  }));
}

/** Resolve a usable join URL from a GCal event (Meet/Teams/Zoom) */
export function resolveJoinUrl(ev: Pick<GCalEvent, "hangoutLink" | "conferenceData" | "location" | "description">): string | null {
  if (ev.hangoutLink) return ev.hangoutLink;
  const eps = ev.conferenceData?.entryPoints;
  if (Array.isArray(eps)) {
    const video = eps.find((p: any) => p?.entryPointType === "video" && p?.uri);
    if (video?.uri) return video.uri as string;
  }
  const haystack = `${ev.location || ""} ${ev.description || ""}`;
  const m = haystack.match(/https?:\/\/[^\s<>"')]+(meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|zoom\.us)[^\s<>"')]*/i);
  if (m) return m[0];
  // Try the other direction (URL prefix on the matched domain)
  const m2 = haystack.match(/https?:\/\/(?:[\w-]+\.)*(?:meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|zoom\.us)\/[^\s<>"')]+/i);
  return m2 ? m2[0] : null;
}

export async function invokeCalendarFunction<T = any>(
  functionName: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("auth_required");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { error: text };
        }
      })()
    : {};

  if (!response.ok || data?.error) {
    const error = new Error(data?.error || `Edge function returned ${response.status}`) as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

function calendarErrorMessage(message?: string) {
  if (message === "calendar_oauth_not_configured") {
    return "Google Calendar credentials are missing. Update the Calendar OAuth secrets, then try again.";
  }
  if (message === "calendar_oauth_invalid_client_id_format") {
    return "The Google Calendar Client ID is invalid. Use the Web application Client ID ending in .apps.googleusercontent.com.";
  }
  if (message === "auth_required" || message === "unauthorized") {
    return "Please sign in again before connecting Google Calendar.";
  }
  return "Could not connect Google Calendar";
}

export function useGoogleCalendar() {
  const { session, loading: authLoading } = useAuth();
  const [connected, setConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(authLoading);
  const [connecting, setConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    if (authLoading) return false;
    if (!session?.access_token) {
      setChecking(false);
      setConnected(false);
      setGoogleEmail(null);
      return false;
    }

    setChecking(true);
    try {
      const data = await invokeCalendarFunction("google-calendar-oauth", { action: "status" }, session.access_token);
      setConnected(!!data?.connected);
      setGoogleEmail(data?.googleEmail || null);
      return !!data?.connected;
    } catch (err) {
      console.error("calendar status", err);
      setConnected(false);
      setGoogleEmail(null);
      return false;
    } finally {
      setChecking(false);
    }
  }, [authLoading, session?.access_token]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const data = await invokeCalendarFunction("google-calendar-oauth", {
        action: "init",
        redirectUri: getCalendarCallbackUri(),
        redirectTo: window.location.href,
      });
      if (!data?.authorizationUrl) throw new Error("Could not start Google Calendar connection");
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(calendarErrorMessage(message));
      console.error("calendar connect", err);
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setConnecting(true);
    try {
      await invokeCalendarFunction("google-calendar-oauth", { action: "disconnect" }, session?.access_token);
      setConnected(false);
      setGoogleEmail(null);
      toast.success("Calendar disconnected");
    } catch (err) {
      toast.error("Could not disconnect calendar");
      console.error("calendar disconnect", err);
    } finally {
      setConnecting(false);
    }
  }, [session?.access_token]);

  const handleCalendarError = useCallback((label: string, error: unknown, data?: any) => {
    const message = data?.error || (error instanceof Error ? error.message : "");
    if (message === "calendar_not_connected") {
      setConnected(false);
      toast.error("Connect Google Calendar to continue");
    } else if (message === "calendar_refresh_token_missing") {
      setConnected(false);
      toast.error("Calendar access expired — reconnect Google Calendar");
    } else {
      console.error(label, error || data);
    }
  }, []);

  const listEvents = useCallback(
    async (opts?: { timeMin?: string; timeMax?: string; q?: string; maxResults?: number }): Promise<GCalEvent[]> => {
      if (!connected) return [];
      try {
        const data = await invokeCalendarFunction("google-calendar-proxy", opts || {}, session?.access_token);
        return normalizeEvents(data?.events || []);
      } catch (err) {
        handleCalendarError("listEvents", err, (err as Error & { data?: unknown }).data);
        return [];
      }
    },
    [connected, handleCalendarError, session?.access_token],
  );

  const createEvent = useCallback(
    async (input: { summary: string; description?: string; start: string; end: string; attendees?: string[]; location?: string; conferencing?: "meet" | "teams" | "zoom" | "none"; conferenceLink?: string }) => {
      if (!connected) return null;
      try {
        const data = await invokeCalendarFunction("google-calendar-create", input, session?.access_token);
        return data.event as { id: string; htmlLink?: string };
      } catch (err) {
        toast.error("Failed to create calendar event");
        handleCalendarError("createEvent", err, (err as Error & { data?: unknown }).data);
        return null;
      }
    },
    [connected, handleCalendarError, session?.access_token],
  );

  const updateEvent = useCallback(
    async (event_id: string, patch: { summary?: string; description?: string; start?: string; end?: string; attendees?: string[]; location?: string; conferencing?: "meet" | "teams" | "zoom" | "none"; conferenceLink?: string }) => {
      if (!connected) return null;
      try {
        const data = await invokeCalendarFunction("google-calendar-update", { event_id, ...patch }, session?.access_token);
        return data.event as { id: string; htmlLink?: string };
      } catch (err) {
        toast.error("Failed to update calendar event");
        handleCalendarError("updateEvent", err, (err as Error & { data?: unknown }).data);
        return null;
      }
    },
    [connected, handleCalendarError, session?.access_token],
  );

  const deleteEvent = useCallback(
    async (event_id: string) => {
      if (!connected) return false;
      try {
        await invokeCalendarFunction("google-calendar-delete", { event_id }, session?.access_token);
        return true;
      } catch (err) {
        handleCalendarError("deleteEvent", err, (err as Error & { data?: unknown }).data);
        return false;
      }
    },
    [connected, handleCalendarError, session?.access_token],
  );

  return {
    connected,
    connecting,
    checking,
    googleEmail,
    connect,
    disconnect,
    checkStatus,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
