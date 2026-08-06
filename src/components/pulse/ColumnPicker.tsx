import { useMemo, useState } from "react";
import { Columns3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  COLUMNS_BY_GROUP, GROUP_LABELS, GROUP_ORDER, DEFAULT_VISIBLE, ALL_COLUMN_IDS,
} from "./responseColumns";

export function ColumnPicker({
  visible,
  onChange,
}: {
  visible: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [q, setQ] = useState("");
  const total = ALL_COLUMN_IDS.length;

  const groups = useMemo(() => {
    const f = q.trim().toLowerCase();
    return GROUP_ORDER.map((g) => ({
      key: g,
      label: GROUP_LABELS[g],
      cols: COLUMNS_BY_GROUP[g].filter((c) => !f || c.label.toLowerCase().includes(f)),
    })).filter((g) => g.cols.length > 0);
  }, [q]);

  const toggle = (id: string) => {
    const n = new Set(visible);
    n.has(id) ? n.delete(id) : n.add(id);
    onChange(n);
  };
  const setGroup = (ids: string[], on: boolean) => {
    const n = new Set(visible);
    ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
    onChange(n);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Columns3 className="h-3.5 w-3.5 mr-1" />
          Columns
          <span className="ml-1 text-[10px] text-muted-foreground">{visible.size}/{total}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] p-0">
        <div className="p-2 border-b border-border flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search questions…"
            className="h-7 flex-1 px-2 rounded-md border border-border bg-card text-xs"
          />
          <button
            className="text-[11px] text-muted-foreground underline hover:text-foreground whitespace-nowrap"
            onClick={() => onChange(new Set(ALL_COLUMN_IDS))}
          >
            Select all
          </button>
          <button
            className="text-[11px] text-muted-foreground underline hover:text-foreground whitespace-nowrap"
            onClick={() => onChange(new Set(DEFAULT_VISIBLE))}
          >
            Reset
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2 space-y-3">
          {groups.map((g) => {
            const ids = g.cols.map((c) => c.id);
            const allOn = ids.every((id) => visible.has(id));
            const someOn = ids.some((id) => visible.has(id));
            return (
              <div key={g.key}>
                <div className="flex items-center justify-between px-1 pb-1">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    {g.label}
                    {someOn && <Check className={cn("h-3 w-3", allOn ? "text-primary" : "text-muted-foreground/60")} />}
                  </div>
                  <div className="flex gap-2">
                    <button className="text-[10px] text-muted-foreground underline hover:text-foreground" onClick={() => setGroup(ids, true)}>All</button>
                    <button className="text-[10px] text-muted-foreground underline hover:text-foreground" onClick={() => setGroup(ids, false)}>None</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {g.cols.map((c) => (
                    <label key={c.id} className="flex items-start gap-1.5 text-[11px] cursor-pointer select-none rounded px-1 py-0.5 hover:bg-secondary">
                      <Checkbox className="mt-0.5" checked={visible.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                      <span className="leading-tight">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
