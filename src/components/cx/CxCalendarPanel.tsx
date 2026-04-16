import React from "react";
import { CalendarDays, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onToggle: () => void;
}

export function CxCalendarPanel({ open, onToggle }: Props) {
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

  return (
    <div className="w-[340px] border-l border-border bg-card flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Calendar</span>
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-accent">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-sm font-medium text-foreground mb-1">Google Calendar</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Connect your Google account to sync tasks with calendar events and see meetings.
        </p>
        <Button size="sm" className="text-xs">
          Connect Google Calendar
        </Button>
        <p className="text-[10px] text-muted-foreground mt-3">
          Requires Google OAuth sign-in
        </p>
      </div>
    </div>
  );
}
