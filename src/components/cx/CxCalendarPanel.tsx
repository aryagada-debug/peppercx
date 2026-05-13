import React, { useState, useEffect, useCallback } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X, ExternalLink, LogOut, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, parseISO } from "date-fns";

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink?: string;
  attendees?: number;
}

interface Props {
  open: boolean;
  onToggle: () => void;
}

export function CxCalendarPanel({ open, onToggle }: Props) {
  const { connected, checking, connecting, connect, disconnect, listEvents } = useGoogleCalendar();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchEvents = useCallback(async () => {
    const monthStart = startOfMonth(calMonth).toISOString();
    const monthEnd = endOfMonth(calMonth).toISOString();
    const rows = await listEvents({ timeMin: monthStart, timeMax: monthEnd, maxResults: 250 });
    setEvents(rows.map((e) => ({ ...e, attendees: e.attendees?.length || 0 })));
  }, [calMonth, listEvents]);

  useEffect(() => {
    if (!connected) { setEvents([]); return; }
    void fetchEvents();
  }, [connected, fetchEvents]);

  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-card border border-r-0 border-border rounded-l-lg p-2 hover:bg-accent transition-colors shadow-sm"
        title="Open Calendar"
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  // Mini calendar helpers
  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const eventDates = new Set(events.map(e => {
    try { return format(parseISO(e.start), "yyyy-MM-dd"); } catch { return ""; }
  }).filter(Boolean));

  const dayEvents = events.filter(e => {
    try { return isSameDay(parseISO(e.start), selectedDate); } catch { return false; }
  });

  return (
    <div className="w-[340px] border-l border-border bg-card flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          {connected && (
            <button onClick={disconnect} className="p-1 rounded hover:bg-accent" title="Disconnect">
              <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <button onClick={onToggle} className="p-1 rounded hover:bg-accent">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {checking ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !connected ? (
        /* Not connected state */
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-sm font-medium text-foreground mb-1">Google Calendar</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Connect your Google account to sync tasks with calendar events and see meetings.
          </p>
          <Button size="sm" className="text-xs" onClick={connect} disabled={connecting}>
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Connect Google Calendar
          </Button>
          <p className="text-[10px] text-muted-foreground mt-3">
            Requires Google OAuth sign-in
          </p>
        </div>
      ) : (
        /* Connected state */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mini calendar */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setCalMonth(subMonths(calMonth, 1))} className="p-1 rounded hover:bg-accent">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-medium">{format(calMonth, "MMMM yyyy")}</span>
              <button onClick={() => setCalMonth(addMonths(calMonth, 1))} className="p-1 rounded hover:bg-accent">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0 text-center">
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                <div key={d} className="text-[10px] text-muted-foreground py-1">{d}</div>
              ))}
              {Array.from({ length: startDay }).map((_, i) => <div key={`e-${i}`} />)}
              {days.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const hasEvent = eventDates.has(dateStr);
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "relative h-7 w-7 mx-auto text-[11px] rounded-full flex items-center justify-center transition-colors",
                      isSelected ? "bg-primary text-primary-foreground" : isToday(day) ? "bg-accent font-medium" : "hover:bg-accent",
                      !isSameMonth(day, calMonth) && "text-muted-foreground/40"
                    )}
                  >
                    {day.getDate()}
                    {hasEvent && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Events for selected date */}
          <div className="border-t border-border flex-1 overflow-y-auto">
            <div className="px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">{format(selectedDate, "EEE, MMM d")}</span>
            </div>
            {dayEvents.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-muted-foreground">No events on this day</p>
              </div>
            ) : (
              <div className="px-2 pb-2 space-y-1">
                {dayEvents.map(ev => (
                  <div key={ev.id} className="rounded-md border border-border p-2 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{ev.summary}</span>
                      {ev.htmlLink && (
                        <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {ev.start ? format(parseISO(ev.start), "h:mm a") : "All day"}
                        {ev.end ? ` – ${format(parseISO(ev.end), "h:mm a")}` : ""}
                      </span>
                    </div>
                    {ev.attendees > 0 && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">{ev.attendees} attendee{ev.attendees !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
