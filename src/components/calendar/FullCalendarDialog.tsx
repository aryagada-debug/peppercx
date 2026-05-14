import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addMinutes, format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Loader2, CalendarDays } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGoogleCalendar, type GCalEvent } from "@/hooks/useGoogleCalendar";
import { CalendarConnectButton } from "@/components/calendar/CalendarConnectButton";
import { EventFormDialog, type EventFormValue } from "@/components/calendar/EventFormDialog";
import { WeekGrid, getWeekStart } from "@/components/calendar/WeekGrid";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function FullCalendarDialog({ open, onOpenChange }: Props) {
  const { connected, listEvents, createEvent, updateEvent, deleteEvent } = useGoogleCalendar();
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<GCalEvent | null>(null);
  const [creating, setCreating] = useState<{ start: string; end: string } | null>(null);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const refresh = useCallback(async () => {
    if (!connected) { setEvents([]); return; }
    setLoading(true);
    try {
      const evs = await listEvents({
        timeMin: weekStart.toISOString(),
        timeMax: weekEnd.toISOString(),
        maxResults: 250,
      });
      setEvents(evs);
    } finally {
      setLoading(false);
    }
  }, [connected, listEvents, weekStart, weekEnd]);

  useEffect(() => { if (open) void refresh(); }, [open, refresh]);

  const handleSave = async (v: EventFormValue) => {
    const payload = { summary: v.summary, description: v.description, start: v.start, end: v.end, attendees: v.attendees, location: v.location };
    if (v.id) await updateEvent(v.id, payload);
    else await createEvent(payload);
    await refresh();
  };

  const handleDelete = async () => {
    if (!editing) return;
    await deleteEvent(editing.id);
    setEditing(null);
    await refresh();
  };

  const headerLabel = format(weekStart, "MMMM yyyy");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 gap-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium px-2 py-1 rounded bg-muted text-foreground flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-primary" /> Planner
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekStart((d) => addDays(d, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekStart((d) => addDays(d, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="h-7" onClick={() => setWeekStart(getWeekStart(new Date()))}>
                Today
              </Button>
              <h2 className="text-lg font-medium ml-1">{headerLabel}</h2>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              {connected && (
                <Button size="sm" className="h-7 gap-1" onClick={() => {
                  const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1);
                  setCreating({ start: s.toISOString(), end: addMinutes(s, 30).toISOString() });
                }}>
                  <Plus className="h-3.5 w-3.5" /> New event
                </Button>
              )}
              <CalendarConnectButton />
              <div className="w-7" />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden p-3 bg-background">
            {!connected ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Connect Google Calendar to view and edit your week.</p>
                <CalendarConnectButton size="default" />
              </div>
            ) : (
              <WeekGrid
                weekStart={weekStart}
                events={events}
                onSlotClick={(sel) =>
                  setCreating({ start: sel.start.toISOString(), end: sel.end.toISOString() })
                }
                onEventClick={(ev) => setEditing(ev)}
                className="h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EventFormDialog
        open={!!creating}
        onOpenChange={(o) => !o && setCreating(null)}
        initial={creating ? { start: creating.start, end: creating.end } : null}
        onSave={async (v) => { await handleSave(v); setCreating(null); }}
      />
      <EventFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ? {
          id: editing.id,
          summary: editing.summary,
          description: editing.description,
          start: editing.start,
          end: editing.end,
          attendees: editing.attendees?.map(a => a.email).filter(Boolean) as string[] | undefined,
        } : null}
        onSave={async (v) => { await handleSave(v); setEditing(null); }}
        onDelete={handleDelete}
      />
    </>
  );
}