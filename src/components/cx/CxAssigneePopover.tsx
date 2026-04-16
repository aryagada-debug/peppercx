import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  spaceId: string | null;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}

export function CxAssigneePopover({ spaceId, value, onChange, children }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !spaceId) return;
    supabase.from("cx_space_members").select("member_name").eq("space_id", spaceId)
      .then(({ data }) => setMembers((data || []).map(d => d.member_name)));
  }, [open, spaceId]);

  const filtered = members.filter(m => m.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <Input
          autoFocus
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs mb-2"
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {value && (
            <button
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-muted-foreground"
              onClick={() => { onChange(""); setOpen(false); }}
            >
              Clear assignee
            </button>
          )}
          {filtered.map(m => (
            <button
              key={m}
              className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs rounded hover:bg-accent"
              onClick={() => { onChange(m); setOpen(false); }}
            >
              <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">
                {m.charAt(0).toUpperCase()}
              </div>
              <span className={m === value ? "font-medium text-foreground" : "text-foreground"}>{m}</span>
            </button>
          ))}
          {filtered.length === 0 && members.length === 0 && (
            <p className="text-[10px] text-muted-foreground px-2 py-2">No members in space. Add via Members.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
