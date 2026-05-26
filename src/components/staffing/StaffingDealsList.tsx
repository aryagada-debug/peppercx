/**
 * Default view of `Staffing & Capacity` — a paged list of `DealStaffingCard`s
 * with the same filter bar concepts as the Sheet view (search, BOPM filter,
 * deal-type filter, active-only toggle). Pages 20 cards at a time so a
 * 500-deal workspace doesn't try to mount everything at once.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BopmFilter, dealMatchesBopm, dealsStaffedByName } from "@/components/access/BopmFilter";
import { DealTypeFilter, dealMatchesType, type DealTypeFilterValue } from "@/components/filters/DealTypeFilter";
import { useAllPersonNames } from "@/hooks/queries/legacy";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";
import { ACTIVE_DEAL_STATUSES } from "@/data/staffingData";
import { DealStaffingCard } from "./DealStaffingCard";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
  isAdmin: boolean;
  enableBopmFilter?: boolean;
  bopmFilterScopedVsd?: string | null;
  onAddAssignment: (a: StaffingAssignment) => void;
  onUpdateAssignment: (id: string, patch: Partial<StaffingAssignment>) => void;
  onDeleteAssignment: (id: string) => void;
  onUpdatePerson?: (id: string, patch: Partial<Person>) => void;
}

const PAGE_SIZE = 20;

export function StaffingDealsList({
  deals, people, assignments, isAdmin, enableBopmFilter = true, bopmFilterScopedVsd,
  onAddAssignment, onUpdateAssignment, onDeleteAssignment, onUpdatePerson,
}: Props) {
  const [search, setSearch] = useState("");
  const [bopm, setBopm] = useState("All");
  const [dealType, setDealType] = useState<DealTypeFilterValue>("All");
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);
  const registeredNames = useAllPersonNames();

  const staffedDealIds = useMemo(
    () => (bopm === "All" ? null : dealsStaffedByName(bopm, people, assignments)),
    [bopm, people, assignments],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter(d => {
      if (activeOnly && !ACTIVE_DEAL_STATUSES.has(d.dealStatus)) return false;
      if (!dealMatchesType(d.dealType, dealType)) return false;
      if (enableBopmFilter && bopm !== "All" && !dealMatchesBopm(d as any, bopm, registeredNames, staffedDealIds || undefined)) return false;
      if (q) {
        const hay = `${d.account || ""} ${d.dealName || ""} ${d.geo || ""} ${d.pod || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deals, search, dealType, activeOnly, enableBopmFilter, bopm, registeredNames, staffedDealIds]);

  const visible = filtered.slice(0, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg p-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deals…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="h-8 pl-7 text-sm"
          />
        </div>
        <DealTypeFilter value={dealType} onChange={v => { setDealType(v); setPage(1); }} />
        {enableBopmFilter && (
          <BopmFilter value={bopm} onChange={v => { setBopm(v); setPage(1); }} scopedVsd={bopmFilterScopedVsd} />
        )}
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-2">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={e => { setActiveOnly(e.target.checked); setPage(1); }}
            className="h-3.5 w-3.5 accent-primary"
          />
          Active deals only
        </label>
        <span className="text-xs text-muted-foreground ml-auto">
          Showing {visible.length} of {filtered.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl text-center py-12 text-sm text-muted-foreground">
          No deals match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(d => (
            <DealStaffingCard
              key={d.id}
              deal={d}
              deals={deals}
              people={people}
              assignments={assignments}
              isAdmin={isAdmin}
              defaultOpen={visible.length <= 5}
              onAddAssignment={onAddAssignment}
              onUpdateAssignment={onUpdateAssignment}
              onDeleteAssignment={onDeleteAssignment}
              onUpdatePerson={onUpdatePerson}
            />
          ))}
          {visible.length < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
                Load {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}