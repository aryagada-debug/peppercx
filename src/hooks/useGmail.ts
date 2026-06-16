import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type GmailStatus = {
  connected: boolean;
  googleEmail: string | null;
  updatedAt: string | null;
  scopes?: string;
};

export type GmailMessageSummary = {
  id: string; threadId: string; snippet: string;
  from: string; subject: string; date: string;
  labelIds: string[]; unread: boolean; internalDate?: string;
};

export type GmailMessage = GmailMessageSummary & {
  to: string; cc: string; html: string; text: string;
  messageId: string; references: string;
};

async function invoke<T = unknown>(fn: "gmail-oauth" | "gmail-api", body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in (data as object) && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export function useGmailStatus() {
  const [status, setStatus] = useState<GmailStatus>({ connected: false, googleEmail: null, updatedAt: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await invoke<GmailStatus>("gmail-oauth", { action: "status" });
      setStatus(data);
    } catch (_) {
      setStatus({ connected: false, googleEmail: null, updatedAt: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { status, loading, refresh };
}

export async function connectGmail(redirectTo?: string) {
  const origin = window.location.origin;
  const data = await invoke<{ authorizationUrl: string }>("gmail-oauth", {
    action: "init",
    redirectUri: `${origin}/gmail/callback`,
    redirectTo: redirectTo || `${origin}/inbox`,
  });
  window.location.href = data.authorizationUrl;
}

export async function disconnectGmail() {
  await invoke("gmail-oauth", { action: "disconnect" });
}

export async function sendGmail(payload: {
  to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string;
  threadId?: string; replyTo?: string; references?: string;
}) {
  return invoke<{ ok: true; id: string; threadId: string }>("gmail-api", { action: "send", ...payload });
}

export async function listGmail(q = "in:inbox", maxResults = 25) {
  return invoke<{ messages: GmailMessageSummary[]; googleEmail: string | null }>("gmail-api", { action: "list", q, maxResults });
}

export async function getGmail(id: string) {
  return invoke<GmailMessage>("gmail-api", { action: "get", id });
}

export async function modifyGmail(id: string, opts: { addLabelIds?: string[]; removeLabelIds?: string[] }) {
  return invoke("gmail-api", { action: "modify", id, ...opts });
}

export async function ensureGmailConnected(): Promise<boolean> {
  try {
    const s = await invoke<GmailStatus>("gmail-oauth", { action: "status" });
    if (s.connected) return true;
    toast.info("Connect your Gmail account first.");
    await connectGmail(window.location.href);
    return false;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Gmail status check failed");
    return false;
  }
}