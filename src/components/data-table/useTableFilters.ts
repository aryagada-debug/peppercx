import { useMemo, useState, useCallback } from "react";

export type ColumnFilters = Record<string, Set<string>>;
export type SortDir = "asc" | "desc";
export interface SortState { columnId: string; dir: SortDir }

export interface UseTableFiltersOptions<T> {
  rows: T[];
  /** Map of columnId -> function returning the cell's filterable/sortable value */
  accessors: Record<string, (row: T) => string | number | boolean | null | undefined>;
  /** Optional initial sort */
  initialSort?: SortState | null;
  /** Optional initial group-by column id */
  initialGroupBy?: string | null;
}

export function useTableFilters<T>({
  rows,
  accessors,
  initialSort = null,
  initialGroupBy = null,
}: UseTableFiltersOptions<T>) {
  const [filters, setFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<SortState | null>(initialSort);
  const [groupBy, setGroupBy] = useState<string | null>(initialGroupBy);

  const setColumnFilter = useCallback((columnId: string, values: Set<string>) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (values.size === 0) delete next[columnId];
      else next[columnId] = values;
      return next;
    });
  }, []);

  const clearFilter = useCallback((columnId: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => setFilters({}), []);

  const toggleSort = useCallback((columnId: string) => {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, dir: "asc" };
      if (prev.dir === "asc") return { columnId, dir: "desc" };
      return null;
    });
  }, []);

  // Unique values per column (computed from full rows so options don't shrink as user filters)
  const uniqueValues = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const colId of Object.keys(accessors)) {
      const set = new Set<string>();
      for (const row of rows) {
        const v = accessors[colId](row);
        set.add(v == null || v === "" ? "—" : String(v));
      }
      out[colId] = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return out;
  }, [rows, accessors]);

  const filtered = useMemo(() => {
    const activeCols = Object.keys(filters);
    if (activeCols.length === 0) return rows;
    return rows.filter((row) =>
      activeCols.every((colId) => {
        const v = accessors[colId]?.(row);
        const key = v == null || v === "" ? "—" : String(v);
        return filters[colId].has(key);
      })
    );
  }, [rows, filters, accessors]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const acc = accessors[sort.columnId];
    if (!acc) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), undefined, { numeric: true });
    });
    if (sort.dir === "desc") copy.reverse();
    return copy;
  }, [filtered, sort, accessors]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const acc = accessors[groupBy];
    if (!acc) return null;
    const map = new Map<string, T[]>();
    for (const row of sorted) {
      const v = acc(row);
      const key = v == null || v === "" ? "—" : String(v);
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }, [sorted, groupBy, accessors]);

  return {
    // state
    filters,
    sort,
    groupBy,
    // setters
    setColumnFilter,
    clearFilter,
    clearAllFilters,
    toggleSort,
    setGroupBy,
    // derived
    uniqueValues,
    rows: sorted,
    grouped,
    activeFilterCount: Object.keys(filters).length,
  };
}
