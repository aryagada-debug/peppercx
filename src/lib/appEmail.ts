import { supabase } from "@/integrations/supabase/client";

export type AppEmailEvent =
  | "staffed"
  | "staffing_changed"
  | "staffing_removed"
  | "rgy_alert"
  | "mbr_reminder"
  | "deal_created"
  | "deal_unstaffed"
  | "rgy_stale"
  | "handover_received"
  | "test";

export interface AppEmailInput {
  event: AppEmailEvent;
  dealId?: string;
  personId?: string;
  recipients?: string[];
  payload?: Record<string, unknown>;
}

/**
 * Best-effort: never throws to caller. Fire-and-log so UI flows continue
 * when the central mailbox is unavailable or a notification fails.
 */
export function sendAppEmail(input: AppEmailInput | AppEmailInput[]) {
  const events = Array.isArray(input) ? input : [input];
  void supabase.functions
    .invoke("send-app-email", { body: { action: "send", events } })
    .then(({ data, error }) => {
      if (error) console.warn("[send-app-email] failed", error.message);
      else if (data && typeof data === "object" && "error" in (data as object)) {
        console.warn("[send-app-email]", (data as { error?: string }).error);
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
  return data as { ok: true };
}

export async function sendCentralTest(toEmail: string) {
  const { data, error } = await supabase.functions.invoke("send-app-email", {
    body: { action: "send", events: [{ event: "test", recipients: [toEmail] }] },
  });
  if (error) throw error;
  return data;
}