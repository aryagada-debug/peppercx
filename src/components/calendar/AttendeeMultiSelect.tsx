import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

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

export function AttendeeMultiSelect({ value, onChange, placeholder = "Search team or type email…", extraOptions = [] }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  const add = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) return;
    if (value.some((v) => v.toLowerCase() === e)) return;
    onChange([...value, e]);
    setQuery("");
  };
  const remove = (email: string) => onChange(value.filter((v) => v.toLowerCase() !== email.toLowerCase()));

  return (
    <div className="border border-border rounded-md px-2 py-1.5 bg-background min-h-[36px] flex flex-wrap items-center gap-1">
      {value.map((email) => {
        const p = allOptions.find((o) => o.email === email.toLowerCase());
        return (
          <Badge key={email} variant="secondary" className="gap-1 font-normal">
            <span className="text-xs">{p?.name || email}</span>
            <button type="button" onClick={() => remove(email)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) { e.preventDefault(); add(query); }
              if (e.key === "Backspace" && !query && value.length) remove(value[value.length - 1]);
              if (e.key === "," && query.trim()) { e.preventDefault(); add(query); }
            }}
            placeholder={value.length ? "" : placeholder}
            className="flex-1 min-w-[160px] bg-transparent outline-none text-sm h-7"
          />
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[320px]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                {isValidEmail(query.trim())
                  ? <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => { add(query); setOpen(false); }}>Add "{query.trim()}"</button>
                  : <span className="px-2 py-1.5 text-xs text-muted-foreground">Type a name or full email</span>}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((p) => (
                  <CommandItem key={p.email} value={p.email} onSelect={() => { add(p.email); setOpen(false); }}>
                    <div className="flex flex-col">
                      <span className="text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}