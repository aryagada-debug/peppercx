import { useEffect, useState } from "react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { rgyData, podMembers } from "@/data/dashboardMocks";
import type { RGYRow } from "@/types/dashboard";

interface GlobalSearchProps {
  onSelectDeal?: (deal: RGYRow) => void;
}

export function GlobalSearch({ onSelectDeal }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 text-ui text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
        aria-label="Open search"
      >
        <span>Search…</span>
        <kbd className="pointer-events-none text-caption border border-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search deals, people…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Deals">
            {rgyData.map((d) => (
              <CommandItem
                key={d.id}
                value={`${d.deal} ${d.client}`}
                onSelect={() => {
                  onSelectDeal?.(d);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{d.deal}</span>
                <span className="ml-2 text-muted-foreground">{d.client}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="People">
            {podMembers.map((p) => (
              <CommandItem key={p.id} value={`${p.name} ${p.role}`}>
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 text-muted-foreground">{p.role}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
