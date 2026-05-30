import { Filter, ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  width?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  /** When set, the header becomes draggable for column reordering. */
  sortableId?: string;
}

export function ColHeader({
  label, colKey, sortKey, align = "left", sortState, onSort,
  colFilters, openFilter, setOpenFilter, setFilter, clearFilter,
  options, numeric, placeholder, className, width, onResizeStart, sortableId,
}: ColHeaderProps) {
  const active = !!colFilters[colKey];
  const isSorted = sortKey && sortState.sortKey === sortKey;
  const SortIcon = !isSorted ? ArrowUpDown : sortState.sortDir === "asc" ? ArrowUp : ArrowDown;
  const alignCls = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  const sortable = useSortable({ id: sortableId ?? `__static_${colKey}`, disabled: !sortableId });
  const dragStyle: React.CSSProperties = sortableId
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.5 : undefined,
        zIndex: sortable.isDragging ? 30 : undefined,
      }
    : {};
  const widthStyle: React.CSSProperties = width
    ? { width, minWidth: width, maxWidth: width }
    : {};
  return (
    <th
      ref={sortableId ? sortable.setNodeRef : undefined}
      className={cn(
      "relative py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium",
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
      className,
    )}
      style={{ ...widthStyle, ...dragStyle }}
    >
      <div className={cn("flex items-center gap-1", alignCls)}>
        {sortableId && (
          <button
            {...sortable.attributes}
            {...sortable.listeners}
            className="opacity-0 group-hover/headrow:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing -ml-1 mr-0.5 text-muted-foreground"
            title="Drag to reorder column"
            aria-label="Drag column"
            type="button"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
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
      {onResizeStart && (
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none hover:bg-primary/40 active:bg-primary"
          title="Drag to resize"
        />
      )}
    </th>
  );
}

export function useColumnFilters() {
  // helper hook signature to be implemented inline by pages; left here for future centralization
}