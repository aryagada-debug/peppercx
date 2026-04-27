import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure a Google Calendar event exists for an MBR (creates or updates).
 * Returns the google event id (or null on failure / no token).
 */
export async function syncMbrToCalendar(params: {
  userId: string;
  mbrEntryId: string;
  scheduledDate: string | null; // yyyy-MM-dd
  startTime?: string;           // HH:mm (default 11:00)
  durationMin?: number;         // default 30
  dealName: string;
  account: string;
  dealId: string;
  notes?: string;
  attendees?: string[];
  cal: {
    createEvent: (i: any) => Promise<{ id: string; htmlLink?: string } | null>;
    updateEvent: (id: string, p: any) => Promise<{ id: string; htmlLink?: string } | null>;
    deleteEvent: (id: string) => Promise<boolean>;
    connected: boolean;
  };
}): Promise<string | null> {
  if (!params.cal.connected) return null;

  const { data: existing } = await supabase
    .from("mbr_calendar_links")
    .select("id, google_event_id")
    .eq("mbr_entry_id", params.mbrEntryId)
    .eq("user_id", params.userId)
    .maybeSingle();

  // If schedule cleared, delete linked event (if any)
  if (!params.scheduledDate) {
    if (existing?.google_event_id) {
      await params.cal.deleteEvent(existing.google_event_id);
      await supabase.from("mbr_calendar_links").delete().eq("id", existing.id);
    }
    return null;
  }

  const time = params.startTime || "11:00";
  const dur = params.durationMin || 30;
  const start = new Date(`${params.scheduledDate}T${time}:00`);
  const end = new Date(start.getTime() + dur * 60_000);

  const summary = `MBR — ${params.account} (${params.dealName})`;
  const dealUrl = `${window.location.origin}/deals/${params.dealId}?tab=MBR`;
  const description = [
    params.notes ? params.notes : "",
    "",
    `Linked deal: ${dealUrl}`,
  ].filter(Boolean).join("\n");

  const payload = {
    summary,
    description,
    start: start.toISOString(),
    end: end.toISOString(),
    attendees: params.attendees,
  };

  if (existing?.google_event_id) {
    const updated = await params.cal.updateEvent(existing.google_event_id, payload);
    if (updated) {
      await supabase
        .from("mbr_calendar_links")
        .update({ html_link: updated.htmlLink || null, last_synced_at: new Date().toISOString() })
        .eq("id", existing.id);
      return updated.id;
    }
    return null;
  }

  const created = await params.cal.createEvent(payload);
  if (!created) return null;
  await supabase.from("mbr_calendar_links").insert({
    user_id: params.userId,
    mbr_entry_id: params.mbrEntryId,
    google_event_id: created.id,
    html_link: created.htmlLink || null,
  });
  return created.id;
}