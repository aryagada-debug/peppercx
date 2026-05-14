import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Person = { name: string; email: string };

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  extraOptions?: Person[];
}

let cache: Person[] | null = null;
let cachePromise: Promise<Person[]> | null = null;

async function loadPeople(): Promise<Person[]> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const { data } = await supabase
      .from("staffing_people")
      .select("name, email")
      .eq("leaving", false)
      .eq("tbh", false)
      .not("email", "is", null)
      .order("name", { ascending: true });
    const list = (data || [])
      .filter((p) => p.email && p.email.includes("@"))
      .map((p) => ({ name: p.name || p.email, email: (p.email as string).toLowerCase() }));
    cache = list;
    return list;
  })();
  return cachePromise;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function AttendeeMultiSelect({ value, onChange, placeholder = "Add team member or type any email…", extraOptions = [] }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadPeople().then(setPeople); }, []);

  const allOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Person[] = [];
    for (const p of [...extraOptions, ...people]) {
      const e = p.email.toLowerCase();
      if (seen.has(e)) continue;
      seen.add(e);
      out.push({ ...p, email: e });
    }
    return out;
  }, [people, extraOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selected = new Set(value.map((v) => v.toLowerCase()));
    return allOptions
      .filter((p) => !selected.has(p.email))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.includes(q))
      .slice(0, 50);
  }, [allOptions, query, value]);

  const q = query.trim();
  const showAddCustom = isValidEmail(q) && !filtered.some((p) => p.email === q.toLowerCase());
  const totalRows = filtered.length + (showAddCustom ? 1 : 0);

  useEffect(() => { setHighlight(0); }, [query, open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const add = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) return;
    if (value.some((v) => v.toLowerCase() === e)) return;
    onChange([...value, e]);
    setQuery("");
  };
  const remove = (email: string) => onChange(value.filter((v) => v.toLowerCase() !== email.toLowerCase()));

  const selectIndex = (i: number) => {
    if (showAddCustom && i === 0) { add(q); return; }
    const idx = showAddCustom ? i - 1 : i;
    const p = filtered[idx];
    if (p) add(p.email);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="border border-border rounded-md px-2 py-1.5 bg-background min-h-[36px] flex flex-wrap items-center gap-1 cursor-text focus-within:ring-1 focus-within:ring-ring"
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
      >
        {value.map((email) => {
          const p = allOptions.find((o) => o.email === email.toLowerCase());
          const isExternal = !p;
          const chip = (
            <Badge variant="secondary" className="gap-1 font-normal">
              {isExternal && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
              <span className="text-xs">{p?.name || email}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(email); }} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
          return isExternal ? (
            <TooltipProvider key={email} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>{chip}</TooltipTrigger>
                <TooltipContent>External attendee · {email}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : <span key={email}>{chip}</span>;
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { const v = query.trim(); if (v && isValidEmail(v)) { add(v); } }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, Math.max(totalRows - 1, 0))); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") {
              if (totalRows > 0 && open) { e.preventDefault(); selectIndex(highlight); }
              else if (q) { e.preventDefault(); add(q); }
            } else if (e.key === ",") { if (q) { e.preventDefault(); add(q); } }
            else if (e.key === "Escape") { setOpen(false); }
            else if (e.key === "Backspace" && !query && value.length) remove(value[value.length - 1]);
          }}
          placeholder={value.length ? "" : placeholder}
          className="flex-1 min-w-[160px] bg-transparent outline-none text-sm h-7"
        />
      </div>
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          {totalRows === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {q ? (isValidEmail(q) ? `Press Enter to add "${q}"` : "Type a name or full email") : "Start typing to search team members…"}
            </div>
          ) : (
            <>
              {showAddCustom && (
                <button
                  type="button"
                  onClick={() => selectIndex(0)}
                  onMouseEnter={() => setHighlight(0)}
                  className={cn("w-full text-left px-3 py-2 text-sm border-b border-border", highlight === 0 ? "bg-accent" : "")}
                >
                  Add "<span className="font-medium">{q}</span>" <span className="text-xs text-muted-foreground">(custom email)</span>
                </button>
              )}
              {filtered.map((p, i) => {
                const idx = showAddCustom ? i + 1 : i;
                return (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => selectIndex(idx)}
                    onMouseEnter={() => setHighlight(idx)}
                    className={cn("w-full text-left px-3 py-2", highlight === idx ? "bg-accent" : "")}
                  >
                    <div className="text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </button>
                );
              })}
            </>
          )}
          <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border bg-muted/30">
            ↑↓ to navigate · Enter to add · type any email for external attendees
          </div>
        </div>
      )}
    </div>
  );
}
