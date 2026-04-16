import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}

const PRIORITIES = [
  { label: "Urgent", color: "text-red-500", bg: "bg-red-500/10" },
  { label: "High", color: "text-orange-500", bg: "bg-orange-500/10" },
  { label: "Normal", color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "Low", color: "text-gray-400", bg: "bg-gray-400/10" },
];

export function CxPriorityPopover({ value, onChange, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-44 p-2" align="start">
        {PRIORITIES.map(p => (
          <button
            key={p.label}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left",
              value === p.label && "bg-accent font-medium"
            )}
            onClick={() => { onChange(p.label); setOpen(false); }}
          >
            <Flag className={cn("h-3.5 w-3.5", p.color)} />
            <span>{p.label}</span>
          </button>
        ))}
        {value && value !== "None" && (
          <button
            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-muted-foreground mt-1 border-t border-border pt-1.5"
            onClick={() => { onChange("None"); setOpen(false); }}
          >
            Clear priority
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function PriorityFlag({ priority }: { priority: string }) {
  const p = PRIORITIES.find(pr => pr.label === priority);
  if (!p || priority === "None") return null;
  return <Flag className={cn("h-3 w-3", p.color)} />;
}
