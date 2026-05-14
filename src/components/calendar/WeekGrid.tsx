import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { addDays, addMinutes, differenceInMinutes, format, isSameDay, parseISO, startOfDay, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import type { GCalEvent } from "@/hooks/useGoogleCalendar";

export interface SlotSelection {
  start: Date;
  end: Date;
}

interface Props {
  weekStart: Date;            // start-of-week (Sunday)
  events: GCalEvent[];
  startHour?: number;         // default 7
  endHour?: number;           // default 21
  slotMinutes?: number;       // default 30
  hourHeight?: number;        // px per hour, default 56
  selection?: SlotSelection | null;
  onSlotClick?: (sel: SlotSelection) => void;
  onEventClick?: (ev: GCalEvent) => void;
  className?: string;
  showNowLine?: boolean;
}

/**
 * Lightweight Google/ClickUp-style week grid.
 * - 7 day columns (starting at `weekStart`).
 * - Hour rows from `startHour` to `endHour`.
 * - Click on empty slot -> onSlotClick (default 30m duration).
 * - Click on event -> onEventClick.
 * - Optional highlighted `selection` block.
 */
export function WeekGrid({
  weekStart,
  events,
  startHour = 7,
  endHour = 21,
  slotMinutes = 30,
  hourHeight = 56,
  selection,
  onSlotClick,
  onEventClick,
  className,
  showNowLine = true,
}: Props) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const totalMinutes = (endHour - startHour) * 60;
  const totalHeight = (totalMinutes / 60) * hourHeight;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const minutesFromTop = (d: Date) => {
    const m = d.getHours() * 60 + d.getMinutes() - startHour * 60;
    return Math.max(0, Math.min(totalMinutes, m));
  };
  const topPx = (d: Date) => (minutesFromTop(d) / 60) * hourHeight;

  // Group events by day for layout
  const eventsByDay = useMemo(() => {
    const map: Record<string, GCalEvent[]> = {};
    days.forEach((d) => (map[d.toDateString()] = []));
    events.forEach((ev) => {
      if (!ev.start) return;
      try {
        const s = parseISO(ev.start);
        const key = s.toDateString();
        if (map[key]) map[key].push(ev);
      } catch {}
    });
    return map;
  }, [days, events]);

  const handleColumnClick = useCallback(
    (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSlotClick) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minutes = Math.round((y / hourHeight) * 60 / slotMinutes) * slotMinutes;
      const start = addMinutes(startOfDay(day), startHour * 60 + minutes);
      const end = addMinutes(start, 30);
      onSlotClick({ start, end });
    },
    [hourHeight, onSlotClick, slotMinutes, startHour],
  );

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  return (
    <div className={cn("flex flex-col rounded-md border border-border bg-card overflow-hidden", className)}>
      {/* Day header */}
      <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className="px-2 py-2 text-center border-l border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(d, "EEE")}</div>
              <div className={cn("text-sm tabular-nums", isToday ? "text-primary font-medium" : "text-foreground")}>
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="overflow-auto" style={{ maxHeight: 560 }}>
        <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))`, height: totalHeight }}>
          {/* Hour gutter */}
          <div className="relative border-r border-border bg-muted/20">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-1 text-[10px] tabular-nums text-muted-foreground"
                style={{ top: i * hourHeight - 6 }}
              >
                {format(new Date(2020, 0, 1, h), "h a")}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayEvents = eventsByDay[day.toDateString()] || [];
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className="relative border-l border-border cursor-pointer"
                onClick={(e) => handleColumnClick(day, e)}
              >
                {/* Hour grid lines */}
                {hours.slice(0, -1).map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-b border-border/60"
                    style={{ top: (i + 1) * hourHeight - 1 }}
                  />
                ))}

                {/* Now line */}
                {showNowLine && isToday && (() => {
                  const top = topPx(now);
                  if (top < 0 || top > totalHeight) return null;
                  return (
                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
                      <div className="h-px bg-destructive" />
                      <div className="h-2 w-2 rounded-full bg-destructive -mt-1 -ml-1" />
                    </div>
                  );
                })()}

                {/* Selection */}
                {selection && isSameDay(selection.start, day) && (() => {
                  const top = topPx(selection.start);
                  const h = Math.max(20, (differenceInMinutes(selection.end, selection.start) / 60) * hourHeight);
                  return (
                    <div
                      className="absolute left-1 right-1 rounded-md border-2 border-primary bg-primary/15 z-10 pointer-events-none"
                      style={{ top, height: h }}
                    />
                  );
                })()}

                {/* Events */}
                {dayEvents.map((ev) => {
                  try {
                    const s = parseISO(ev.start);
                    const e = ev.end ? parseISO(ev.end) : addMinutes(s, 30);
                    const top = topPx(s);
                    const height = Math.max(18, (differenceInMinutes(e, s) / 60) * hourHeight - 2);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(evt) => { evt.stopPropagation(); onEventClick?.(ev); }}
                        className="absolute left-1 right-1 rounded-md bg-primary/15 border border-primary/40 hover:bg-primary/25 text-left px-1.5 py-0.5 overflow-hidden z-[5]"
                        style={{ top, height }}
                        title={ev.summary}
                      >
                        <div className="text-[11px] font-medium text-primary truncate leading-tight">{ev.summary}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums truncate">
                          {format(s, "h:mm a")} – {format(e, "h:mm a")}
                        </div>
                      </button>
                    );
                  } catch {
                    return null;
                  }
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function getWeekStart(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 0 });
}