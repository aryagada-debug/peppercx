import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Filter, Search, X, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTableFilters } from "./useTableFilters";

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  /** Cell renderer */
  cell: (row: T) => React.ReactNode;
  /** Returns a sortable/filterable scalar value. Required for filterable/sortable columns. */
  accessor?: (row: T) => string | number | boolean | null | undefined;
  align?: "left" | "right" | "center";
  width?: string;
  className?: string;
  filterable?: boolean;
  sortable?: boolean;
  /** Allow this column to be picked as the group-by column */
  groupable?: boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Title shown in the toolbar (left side) */
  title?: React.ReactNode;
  /** Extra controls rendered in the toolbar right side */
  toolbarRight?: React.ReactNode;
  /** Enable a global text search (searches across all string accessors) */
  enableGlobalSearch?: boolean;
  /** Compact rows */
  dense?: boolean;
  /** Empty state */
  emptyMessage?: string;
  /** Initial group-by column id */
  initialGroupBy?: string | null;
}

function ColumnFilterPopover({
  columnId,
  options,
  selected,
  onChange,
  onClear,
}: {
  columnId: string;
  options: string[];
  selected: Set<string> | undefined;
  onChange: (next: Set<string>) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const filteredOpts = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );
  const active = !!selected && selected.size > 0;
  const allShownSelected = filteredOpts.every((o) => selected?.has(o));

  const toggle = (opt: string) => {
    const next = new Set(selected ?? []);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "ml-1 rounded p-0.5 transition-colors",
            active
              ? "text-primary bg-primary/10"
              : "text-muted-foreground/60 hover:text-foreground hover:bg-accent"
          )}
          aria-label={`Filter ${columnId}`}
        >
          <Filter className="h-3 w-3" fill={active ? "currentColor" : "none"} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-60 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border text-[11px]">
          <button
            className="text-primary hover:underline"
            onClick={() => {
              const next = new Set(selected ?? []);
              if (allShownSelected) filteredOpts.forEach((o) => next.delete(o));
              else filteredOpts.forEach((o) => next.add(o));
              onChange(next);
            }}
          >
            {allShownSelected ? "Clear shown" : "Select all"}
          </button>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            Clear filter
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filteredOpts.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              No options
            </div>
          )}
          {filteredOpts.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-accent cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected?.has(opt) ?? false}
                onChange={() => toggle(opt)}
                className="rounded border-border"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  title,
  toolbarRight,
  enableGlobalSearch = false,
  dense = true,
  emptyMessage = "No results match your filters.",
  initialGroupBy = null,
}: DataTableProps<T>) {
  const [globalSearch, setGlobalSearch] = useState("");

  const accessors = useMemo(() => {
    const out: Record<string, (row: T) => string | number | boolean | null | undefined> = {};
    for (const c of columns) if (c.accessor) out[c.id] = c.accessor;
    return out;
  }, [columns]);

  const groupableColumns = useMemo(() => columns.filter((c) => c.groupable), [columns]);

  const searched = useMemo(() => {
    if (!enableGlobalSearch || !globalSearch.trim()) return rows;
    const q = globalSearch.toLowerCase();
    return rows.filter((row) =>
      columns.some((c) => {
        const v = c.accessor?.(row);
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [rows, globalSearch, enableGlobalSearch, columns]);

  const {
    filters,
    sort,
    groupBy,
    setColumnFilter,
    clearFilter,
    clearAllFilters,
    toggleSort,
    setGroupBy,
    uniqueValues,
    rows: processed,
    grouped,
    activeFilterCount,
  } = useTableFilters({ rows: searched, accessors, initialGroupBy });

  const colCount = columns.length;
  const cellPad = dense ? "py-1.5 px-3" : "py-2.5 px-3";

  const renderHeader = () => (
    <thead>
      <tr className="bg-secondary/40 border-b border-border">
        {columns.map((c) => {
          const isSorted = sort?.columnId === c.id;
          const isFilterable = c.filterable && c.accessor;
          const isSortable = c.sortable !== false && c.accessor;
          const align =
            c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";
          return (
            <th
              key={c.id}
              className={cn(
                "py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap",
                align,
                c.className
              )}
              style={c.width ? { width: c.width } : undefined}
            >
              <div
                className={cn(
                  "inline-flex items-center gap-0.5",
                  c.align === "right" && "flex-row-reverse",
                  c.align === "center" && "justify-center"
                )}
              >
                <button
                  type="button"
                  onClick={() => isSortable && toggleSort(c.id)}
                  className={cn(
                    "inline-flex items-center gap-1",
                    isSortable && "hover:text-foreground cursor-pointer"
                  )}
                >
                  <span>{c.header}</span>
                  {isSorted &&
                    (sort!.dir === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    ))}
                </button>
                {isFilterable && (
                  <ColumnFilterPopover
                    columnId={c.id}
                    options={uniqueValues[c.id] ?? []}
                    selected={filters[c.id]}
                    onChange={(next) => setColumnFilter(c.id, next)}
                    onClear={() => clearFilter(c.id)}
                  />
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );

  const renderRow = (row: T) => (
    <tr
      key={rowKey(row)}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      className={cn(
        "border-b border-border/50 hover:bg-accent/10 transition-colors",
        onRowClick && "cursor-pointer"
      )}
    >
      {columns.map((c) => {
        const align =
          c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";
        return (
          <td
            key={c.id}
            className={cn(cellPad, "text-xs text-foreground", align, c.className)}
          >
            {c.cell(row)}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {(title || enableGlobalSearch || groupableColumns.length > 0 || activeFilterCount > 0 || toolbarRight) && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {title && <div className="text-xs font-medium text-foreground">{title}</div>}
            <span className="text-[11px] text-muted-foreground">
              {processed.length} {processed.length === 1 ? "row" : "rows"}
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <X className="h-3 w-3" />
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {enableGlobalSearch && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-7 pl-7 text-xs w-48"
                />
              </div>
            )}
            {groupableColumns.length > 0 && (
              <div className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <Select
                  value={groupBy ?? "__none"}
                  onValueChange={(v) => setGroupBy(v === "__none" ? null : v)}
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue placeholder="Group by…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" className="text-xs">No grouping</SelectItem>
                    {groupableColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        Group by {typeof c.header === "string" ? c.header : c.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {toolbarRight}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-ui">
          {renderHeader()}
          <tbody>
            {grouped
              ? grouped.map((g) => (
                  <React.Fragment key={g.key}>
                    <tr className="bg-secondary/30 border-b border-border sticky">
                      <td
                        colSpan={colCount}
                        className="py-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-foreground"
                      >
                        {g.key}{" "}
                        <span className="ml-1 text-muted-foreground font-normal normal-case">
                          ({g.items.length})
                        </span>
                      </td>
                    </tr>
                    {g.items.map(renderRow)}
                  </React.Fragment>
                ))
              : processed.map(renderRow)}
            {processed.length === 0 && (
              <tr>
                <td colSpan={colCount} className="py-12 text-center text-muted-foreground text-xs">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
