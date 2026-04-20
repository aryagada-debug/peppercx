import { Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SortState = { sortKey: string | null; sortDir: "asc" | "desc" };

export interface ColHeaderProps {
  label: string;
  colKey: string;
  sortKey?: string;
  align?: "left" | "right" | "center";
  sortState: SortState;
  onSort: (k: string) => void;
  colFilters: Record<string, string>;
  openFilter: string | null;
  setOpenFilter: (k: string | null) => void;
  setFilter: (k: string, v: string) => void;
  clearFilter: (k: string) => void;
  options?: string[];
  numeric?: boolean;
  placeholder?: string;
  className?: string;
}

export function ColHeader({
  label, colKey, sortKey, align = "left", sortState, onSort,
  colFilters, openFilter, setOpenFilter, setFilter, clearFilter,
  options, numeric, placeholder, className,
}: ColHeaderProps) {
  const active = !!colFilters[colKey];
  const isSorted = sortKey && sortState.sortKey === sortKey;
  const SortIcon = !isSorted ? ArrowUpDown : sortState.sortDir === "asc" ? ArrowUp : ArrowDown;
  const alignCls = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th className={cn(
      "py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium",
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
      className,
    )}>
      <div className={cn("flex items-center gap-1", alignCls)}>
        {sortKey ? (
          <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <span>{label}</span>
            <SortIcon className={cn("h-3 w-3", isSorted ? "text-foreground" : "opacity-50")} />
          </button>
        ) : (
          <span>{label}</span>
        )}
        <Popover open={openFilter === colKey} onOpenChange={(o) => setOpenFilter(o ? colKey : null)}>
          <PopoverTrigger asChild>
            <button className={cn("p-0.5 rounded hover:bg-secondary", active && "text-primary")} title="Filter">
              <Filter className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            {options ? (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                <button
                  onClick={() => { clearFilter(colKey); setOpenFilter(null); }}
                  className={cn("w-full text-left text-xs px-2 py-1 rounded hover:bg-secondary", !active && "bg-secondary")}
                >All</button>
                {options.map(opt => (
                  <button key={opt}
                    onClick={() => { setFilter(colKey, opt); setOpenFilter(null); }}
                    className={cn("w-full text-left text-xs px-2 py-1 rounded hover:bg-secondary capitalize", colFilters[colKey] === opt && "bg-primary text-primary-foreground")}
                  >{opt}</button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  autoFocus
                  type={numeric ? "number" : "text"}
                  placeholder={placeholder || `Filter ${label.toLowerCase()}...`}
                  value={colFilters[colKey] || ""}
                  onChange={(e) => setFilter(colKey, e.target.value)}
                  className="h-7 text-xs"
                />
                {active && (
                  <button onClick={() => { clearFilter(colKey); setOpenFilter(null); }} className="text-[11px] text-muted-foreground hover:text-foreground">Clear</button>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </th>
  );
}

export function useColumnFilters() {
  // helper hook signature to be implemented inline by pages; left here for future centralization
}