import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

interface Props {
  value: string[];
  allTags: string[];
  onChange: (v: string[]) => void;
  children: React.ReactNode;
}

const TAG_COLORS = [
  "bg-violet-500/15 text-violet-700 border-violet-300",
  "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  "bg-sky-500/15 text-sky-700 border-sky-300",
  "bg-amber-500/15 text-amber-700 border-amber-300",
  "bg-rose-500/15 text-rose-700 border-rose-300",
  "bg-teal-500/15 text-teal-700 border-teal-300",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function CxTagsPopover({ value, allTags, onChange, children }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const available = allTags.filter(t => !value.includes(t) && t.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !allTags.includes(search.trim()) && !value.includes(search.trim());

  const toggle = (tag: string) => {
    if (value.includes(tag)) onChange(value.filter(t => t !== tag));
    else onChange([...value, tag]);
  };

  const create = () => {
    const t = search.trim();
    if (t) { onChange([...value, t]); setSearch(""); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <Input
          autoFocus
          placeholder="Search or create…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && canCreate) create(); }}
          className="h-7 text-xs mb-2"
        />
        {/* Active tags */}
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {value.map(t => (
              <Badge key={t} variant="outline" className={`text-[10px] cursor-pointer ${tagColor(t)}`} onClick={() => toggle(t)}>
                {t} <X className="h-2.5 w-2.5 ml-0.5" />
              </Badge>
            ))}
          </div>
        )}
        {/* Available */}
        <div className="max-h-32 overflow-y-auto space-y-0.5">
          {available.map(t => (
            <button key={t} className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs rounded hover:bg-accent" onClick={() => toggle(t)}>
              <Badge variant="outline" className={`text-[9px] ${tagColor(t)}`}>{t}</Badge>
            </button>
          ))}
        </div>
        {/* Create */}
        {canCreate && (
          <button className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-primary mt-1 border-t border-border pt-1.5" onClick={create}>
            <Plus className="h-3 w-3" /> Create "{search.trim()}"
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { tagColor };
