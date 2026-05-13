import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  htmlLink?: string;
  attendees?: { email: string; responseStatus?: string }[];
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
  }));
}

function calendarErrorMessage(message?: string) {
  if (message === "calendar_oauth_not_configured") {
    return "Google Calendar credentials are missing. Update the Calendar OAuth secrets, then try again.";
  }
  if (message === "calendar_oauth_invalid_client_id_format") {
    return "The Google Calendar Client ID is invalid. Use the Web application Client ID ending in .apps.googleusercontent.com.";
  }
  return "Could not connect Google Calendar";
}

export function useGoogleCalendar() {
  const [connected, setConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth", {
        body: { action: "status" },
      });
      if (error || data?.error) throw error || new Error(data.error);
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
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth", {
        body: {
          action: "init",
          redirectUri: getCalendarCallbackUri(),
          redirectTo: window.location.href,
        },
      });
      if (error || data?.error || !data?.authorizationUrl) {
        throw error || new Error(data?.error || "Could not start Google Calendar connection");
      }
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
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth", {
        body: { action: "disconnect" },
      });
      if (error || data?.error) throw error || new Error(data.error);
      setConnected(false);
      setGoogleEmail(null);
      toast.success("Calendar disconnected");
    } catch (err) {
      toast.error("Could not disconnect calendar");
      console.error("calendar disconnect", err);
    } finally {
      setConnecting(false);
    }
  }, []);

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
      const { data, error } = await supabase.functions.invoke("google-calendar-proxy", { body: opts || {} });
      if (error || data?.error) {
        handleCalendarError("listEvents", error, data);
        return [];
      }
      return normalizeEvents(data?.events || []);
    },
    [connected, handleCalendarError],
  );

  const createEvent = useCallback(
    async (input: { summary: string; description?: string; start: string; end: string; attendees?: string[]; location?: string }) => {
      if (!connected) return null;
      const { data, error } = await supabase.functions.invoke("google-calendar-create", { body: input });
      if (error || data?.error) {
        toast.error("Failed to create calendar event");
        handleCalendarError("createEvent", error, data);
        return null;
      }
      return data.event as { id: string; htmlLink?: string };
    },
    [connected, handleCalendarError],
  );

  const updateEvent = useCallback(
    async (event_id: string, patch: { summary?: string; description?: string; start?: string; end?: string; attendees?: string[]; location?: string }) => {
      if (!connected) return null;
      const { data, error } = await supabase.functions.invoke("google-calendar-update", { body: { event_id, ...patch } });
      if (error || data?.error) {
        toast.error("Failed to update calendar event");
        handleCalendarError("updateEvent", error, data);
        return null;
      }
      return data.event as { id: string; htmlLink?: string };
    },
    [connected, handleCalendarError],
  );

  const deleteEvent = useCallback(
    async (event_id: string) => {
      if (!connected) return false;
      const { data, error } = await supabase.functions.invoke("google-calendar-delete", { body: { event_id } });
      if (error || data?.error) {
        handleCalendarError("deleteEvent", error, data);
        return false;
      }
      return true;
    },
    [connected, handleCalendarError],
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
