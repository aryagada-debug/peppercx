import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AppEmailEvent =
  | "staffed"
  | "staffing_changed"
  | "staffing_removed"
  | "staffing_locked"
  | "deal_created"
  | "deal_unstaffed"
  | "handover_received"
  | "test";

export interface AppEmailInput {
  event: AppEmailEvent;
  dealId?: string;
  personId?: string;
  recipients?: string[];
  payload?: Record<string, unknown>;
}

const MAILBOX_REASONS = new Set([
  "central_mailbox_not_connected",
  "central_mailbox_reauth_required",
  "central_mailbox_missing_email",
  "gmail_oauth_not_configured",
]);

/**
 * Best-effort: never throws to caller. UI flows continue when the central
 * mailbox is unavailable, but the failure is surfaced instead of silent.
 */
export function sendAppEmail(input: AppEmailInput | AppEmailInput[]) {
  const events = Array.isArray(input) ? input : [input];
  void supabase.functions
    .invoke("send-app-email", { body: { action: "send", events } })
    .then(({ data, error }) => {
      if (error) console.warn("[send-app-email] failed", error.message);
      const d = data as { error?: string; reason?: string } | null;
      const reason = d?.reason || d?.error;
      if (reason) {
        console.warn("[send-app-email]", reason);
        if (MAILBOX_REASONS.has(reason)) {
          toast.error("Email not sent - central mailbox is disconnected", {
            description: "Reconnect it in Settings → Notifications.",
          });
        }
      }
    })
    .catch((e) => console.warn("[send-app-email] threw", e));
}

export async function getCentralMailboxStatus() {
  const { data, error } = await supabase.functions.invoke("send-app-email", {
    body: { action: "central_status" },
  });
  if (error) throw error;
  return data as { connected: boolean; googleEmail: string | null; updatedAt: string | null };
}

export async function setCentralMailbox() {
  const { data, error } = await supabase.functions.invoke("send-app-email", {
    body: { action: "set_central" },
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in (data as object)) {
    throw new Error((data as { error: string }).error);
  }
  return data as { ok: true; warning?: string };
}

/** Live check: can the central mailbox actually mint a Gmail access token? */
export async function checkCentralMailbox() {
  const { data, error } = await supabase.functions.invoke("send-app-email", {
    body: { action: "central_check" },
  });
  if (error) throw error;
  return data as { ok: boolean; reason?: string; googleEmail?: string | null };
}

export async function sendCentralTest(toEmail: string) {
  const { data, error } = await supabase.functions.invoke("send-app-email", {
    body: { action: "send", events: [{ event: "test", recipients: [toEmail] }] },
  });
  if (error) throw error;
  return data;
}