import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Calendar, ExternalLink } from "lucide-react";
import type { MBRDeal, MBREntry } from "@/hooks/useMBRData";
import { useGoogleCalendar, type GCalEvent } from "@/hooks/useGoogleCalendar";
import { CalendarConnectButton } from "@/components/calendar/CalendarConnectButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { syncMbrToCalendar } from "@/lib/mbrCalendarSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WeekGrid, getWeekStart } from "@/components/calendar/WeekGrid";
import { addDays, addMinutes } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  deal: MBRDeal;
  entry: MBREntry | null;
  onSave: (params: {
    dealId: string;
    status: string;
    mode: string | null;
    notes: string | null;
    updatedBy: string;
    scheduledDate?: string | null;
    anirudhAdded?: boolean;
    anirudhJoining?: boolean;
  }) => Promise<void>;
}

export function ScheduleOnlyDialog({ open, onClose, deal, entry, onSave }: Props) {
  const [scheduledDate, setScheduledDate] = useState(entry?.scheduledDate || "");
  const [scheduledTime, setScheduledTime] = useState("11:00");
  const [durationMin, setDurationMin] = useState(30);
  const [attendeesStr, setAttendeesStr] = useState("");
  const [saving, setSaving] = useState(false);
  const { connected: calConnected, createEvent, updateEvent, deleteEvent, listEvents } = useGoogleCalendar();
  const { user } = useAuth();

  const baseDate = useMemo(() => scheduledDate ? new Date(scheduledDate + "T00:00:00") : new Date(), [scheduledDate]);
  const weekStart = useMemo(() => getWeekStart(baseDate), [baseDate]);
  const [events, setEvents] = useState<GCalEvent[]>([]);

  useEffect(() => {
    if (!open || !calConnected) { setEvents([]); return; }
    const tMin = weekStart.toISOString();
    const tMax = addDays(weekStart, 7).toISOString();
    listEvents({ timeMin: tMin, timeMax: tMax, maxResults: 250 }).then(setEvents);
  }, [open, calConnected, weekStart, listEvents]);

  const selection = useMemo(() => {
    if (!scheduledDate) return null;
    const [hh, mm] = scheduledTime.split(":").map(Number);
    const start = new Date(scheduledDate + "T00:00:00");
    start.setHours(hh || 11, mm || 0, 0, 0);
    const end = addMinutes(start, durationMin || 30);
    return { start, end };
  }, [scheduledDate, scheduledTime, durationMin]);

  const handleSave = async () => {
    if (!scheduledDate) return;
    setSaving(true);
    try {
      await onSave({
        dealId: deal.id,
        status: entry?.status || "Pending",
        mode: entry?.mode ?? null,
        notes: entry?.notes ?? null,
        updatedBy: "user",
        scheduledDate,
        anirudhAdded: entry?.anirudhAdded ?? false,
        anirudhJoining: entry?.anirudhJoining ?? false,
      });
      if (calConnected && user) {
        const { data: refetched } = await supabase
          .from("mbr_entries")
          .select("id")
          .eq("deal_id", deal.id)
          .eq("scheduled_date", scheduledDate)
          .maybeSingle();
        const mbrId = refetched?.id || entry?.id;
        if (mbrId) {
          const attendees = attendeesStr.split(",").map(s => s.trim()).filter(Boolean);
          const result = await syncMbrToCalendar({
            userId: user.id,
            mbrEntryId: mbrId,
            scheduledDate,
            startTime: scheduledTime,
            durationMin,
            dealName: deal.dealName,
            account: deal.account,
            dealId: deal.id,
            attendees: attendees.length ? attendees : undefined,
            cal: { createEvent, updateEvent, deleteEvent, connected: calConnected },
          });
          if (result) toast.success("MBR added to your Google Calendar");
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Schedule MBR — {deal.dealName}
            </DialogTitle>
            <CalendarConnectButton />
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 py-2">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="h-9" />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Time</label>
                <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="h-9" disabled={!calConnected} title={!calConnected ? "Connect calendar to set time" : ""} />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (min)</label>
                <Input type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 30)} className="h-9" disabled={!calConnected} />
              </div>
            </div>

            {calConnected && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Attendees (optional)</label>
                <Input placeholder="comma-separated emails" value={attendeesStr} onChange={(e) => setAttendeesStr(e.target.value)} className="h-9" />
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Saving will create a Google Calendar invite for everyone listed.</p>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Tip: click any slot in the week view to set the date and time.
            </p>
          </div>

          <div className="min-h-[440px]">
            {calConnected ? (
              <WeekGrid
                weekStart={weekStart}
                events={events}
                selection={selection}
                onSlotClick={(sel) => {
                  const y = sel.start.getFullYear();
                  const m = String(sel.start.getMonth() + 1).padStart(2, "0");
                  const d = String(sel.start.getDate()).padStart(2, "0");
                  const hh = String(sel.start.getHours()).padStart(2, "0");
                  const mm = String(sel.start.getMinutes()).padStart(2, "0");
                  setScheduledDate(`${y}-${m}-${d}`);
                  setScheduledTime(`${hh}:${mm}`);
                }}
                className="h-full"
              />
            ) : (
              <div className="h-full min-h-[440px] flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 text-center px-6">
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Connect Google Calendar to pick a slot from your week.</p>
                <CalendarConnectButton />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !scheduledDate} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
