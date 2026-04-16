import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, nextSaturday, nextMonday } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  children: React.ReactNode;
}

const quickOptions = [
  { label: "Today", fn: () => new Date() },
  { label: "Tomorrow", fn: () => addDays(new Date(), 1) },
  { label: "This Weekend", fn: () => nextSaturday(new Date()) },
  { label: "Next Week", fn: () => nextMonday(addDays(new Date(), 1)) },
  { label: "2 Weeks", fn: () => addDays(new Date(), 14) },
  { label: "4 Weeks", fn: () => addDays(new Date(), 28) },
];

export function CxDatePickerPopover({ value, onChange, children }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : undefined;

  const pick = (d: Date) => {
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto p-0 flex" align="start">
        {/* Quick options */}
        <div className="border-r border-border px-2 py-3 space-y-0.5 min-w-[130px]">
          {quickOptions.map(o => (
            <button
              key={o.label}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-foreground"
              onClick={() => pick(o.fn())}
            >
              {o.label}
            </button>
          ))}
          {value && (
            <button
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-destructive mt-1"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              Clear
            </button>
          )}
        </div>
        {/* Calendar */}
        <Calendar
          mode="single"
          selected={selected}
          onSelect={d => { if (d) pick(d); }}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
