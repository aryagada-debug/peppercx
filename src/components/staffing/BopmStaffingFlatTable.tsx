import { useMemo, useRef, useState, useEffect } from "react";
import { Search, Plus, Trash2, RotateCcw, X, Send, Info, Columns3, Check, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/csvTargets";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";
import { uid } from "@/data/staffingData";
import { submitStaffingBatch, type BatchItem } from "@/lib/approvals";
import { AddStaffingMemberDialog } from "./AddStaffingMemberDialog";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  horizontalListSortingStrategy, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Pastel HSL palette per role category. Header gets a saturated swatch,
// cells inherit a very subtle tint so the column groups are visually scannable
// without overwhelming the data.
const CATEGORY_STYLES: Record<string, { head: string; cell: string; dot: string; label: string }> = {
  "Operations":          { head: "bg-violet-100/80 text-violet-900 border-violet-200",  cell: "bg-violet-50/40",  dot: "bg-violet-500",  label: "Operations" },
  "Content":             { head: "bg-sky-100/80 text-sky-900 border-sky-200",            cell: "bg-sky-50/40",     dot: "bg-sky-500",     label: "Content" },
  "Content Strategy":    { head: "bg-cyan-100/80 text-cyan-900 border-cyan-200",         cell: "bg-cyan-50/40",    dot: "bg-cyan-500",    label: "Content Strategy" },
  "SEO":                 { head: "bg-emerald-100/80 text-emerald-900 border-emerald-200",cell: "bg-emerald-50/40", dot: "bg-emerald-500", label: "SEO" },
  "Creative Strategy":   { head: "bg-fuchsia-100/80 text-fuchsia-900 border-fuchsia-200",cell: "bg-fuchsia-50/40", dot: "bg-fuchsia-500", label: "Creative Strategy" },
  "Creative Copy":       { head: "bg-pink-100/80 text-pink-900 border-pink-200",         cell: "bg-pink-50/40",    dot: "bg-pink-500",    label: "Creative Copy" },
  "Creative Art":        { head: "bg-rose-100/80 text-rose-900 border-rose-200",         cell: "bg-rose-50/40",    dot: "bg-rose-500",    label: "Creative Art" },
  "Video":               { head: "bg-orange-100/80 text-orange-900 border-orange-200",   cell: "bg-orange-50/40",  dot: "bg-orange-500",  label: "Video" },
  "Performance & Growth":{ head: "bg-amber-100/80 text-amber-900 border-amber-200",      cell: "bg-amber-50/40",   dot: "bg-amber-500",   label: "Performance & Growth" },
  "Other":               { head: "bg-slate-100/80 text-slate-900 border-slate-200",      cell: "bg-slate-50/40",   dot: "bg-slate-500",   label: "Other" },
};
const styleFor = (cat?: string) => CATEGORY_STYLES[cat || "Other"] || CATEGORY_STYLES["Other"];

interface Props {
  deals: Deal[];
  people: Person[];
  allPeople: Person[];
  assignments: StaffingAssignment[];
}

const MONTH_HOURS = 160;

type DealDraft = {
  adds: StaffingAssignment[];
  updates: Record<string, Partial<StaffingAssignment>>;
  removes: Record<string, true>;
};

const emptyDraft = (): DealDraft => ({ adds: [], updates: {}, removes: {} });

/**
 * Horizontal pivot staffing view for BOPMs.
 * Rows = (Account · Deal). Columns = Roles. Each cell shows the person(s)
 * staffed for that role with an inline allocation %; hrs/wk are auto-derived.
 * Functionality (staging + batched submit to Central Cx) is unchanged.
 */
export function BopmStaffingFlatTable({ deals, people, allPeople, assignments }: Props) {
  const [search, setSearch] = useState("");
  const [addForDeal, setAddForDeal] = useState<string | null>(null);
  const [allocDraft, setAllocDraft] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, DealDraft>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [noteByDeal, setNoteByDeal] = useState<Record<string, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Persisted user reordering: team order + per-team role-key order.
  const [teamOrder, setTeamOrder] = useState<string[] | null>(null);
  const [colOrderByTeam, setColOrderByTeam] = useState<Record<string, string[]>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);

  const allPersonById = useMemo(() => new Map(allPeople.map(p => [p.id, p])), [allPeople]);
  const dealById = useMemo(() => new Map(deals.map(d => [d.id, d])), [deals]);

  const getDraft = (dealId: string): DealDraft => drafts[dealId] || emptyDraft();
  const setDraft = (dealId: string, next: DealDraft) =>
    setDrafts(prev => ({ ...prev, [dealId]: next }));
  const draftCount = (d: DealDraft) =>
    d.adds.length + Object.keys(d.updates).length + Object.keys(d.removes).length;

  const stageUpdate = (dealId: string, assignmentId: string, patch: Partial<StaffingAssignment>) => {
    const cur = getDraft(dealId);
    const addIdx = cur.adds.findIndex(a => a.id === assignmentId);
    if (addIdx >= 0) {
      const nextAdds = cur.adds.slice();
      nextAdds[addIdx] = { ...nextAdds[addIdx], ...patch };
      setDraft(dealId, { ...cur, adds: nextAdds });
      return;
    }
    setDraft(dealId, { ...cur, updates: { ...cur.updates, [assignmentId]: { ...(cur.updates[assignmentId] || {}), ...patch } } });
  };
  const stageAdd = (dealId: string, a: StaffingAssignment) => {
    const cur = getDraft(dealId);
    setDraft(dealId, { ...cur, adds: [...cur.adds, { ...a, id: a.id || uid() }] });
  };
  const stageRemove = (dealId: string, assignmentId: string) => {
    const cur = getDraft(dealId);
    const addIdx = cur.adds.findIndex(a => a.id === assignmentId);
    if (addIdx >= 0) {
      const nextAdds = cur.adds.slice(); nextAdds.splice(addIdx, 1);
      setDraft(dealId, { ...cur, adds: nextAdds });
      return;
    }
    setDraft(dealId, { ...cur, removes: { ...cur.removes, [assignmentId]: true } });
  };
  const unstageRemove = (dealId: string, assignmentId: string) => {
    const cur = getDraft(dealId);
    const { [assignmentId]: _, ...rest } = cur.removes;
    setDraft(dealId, { ...cur, removes: rest });
  };
  const unstageUpdate = (dealId: string, assignmentId: string) => {
    const cur = getDraft(dealId);
    const { [assignmentId]: _, ...rest } = cur.updates;
    setDraft(dealId, { ...cur, updates: rest });
  };
  const discardDraft = (dealId: string) => {
    setDrafts(prev => { const { [dealId]: _, ...rest } = prev; return rest; });
    setNoteByDeal(prev => { const { [dealId]: _, ...rest } = prev; return rest; });
  };

  const submitDraft = async (deal: Deal) => {
    const d = getDraft(deal.id);
    const items: BatchItem[] = [];
    for (const a of d.adds) {
      items.push({ type: "staffing.add", dealId: deal.id, targetId: a.id, payload: a });
    }
    for (const [assignmentId, patch] of Object.entries(d.updates)) {
      const current = assignments.find(x => x.id === assignmentId);
      items.push({
        type: "staffing.update", dealId: deal.id, targetId: assignmentId,
        previous: current || {}, payload: { id: assignmentId, ...patch },
      });
    }
    for (const assignmentId of Object.keys(d.removes)) {
      const current = assignments.find(x => x.id === assignmentId);
      items.push({
        type: "staffing.remove", dealId: deal.id, targetId: assignmentId,
        previous: current || {}, payload: { id: assignmentId },
      });
    }
    if (!items.length) return;
    setSubmitting(prev => ({ ...prev, [deal.id]: true }));
    const title = `${deal.account} — ${deal.dealName} · ${items.length} staffing change${items.length === 1 ? "" : "s"}`;
    const res = await submitStaffingBatch({
      title,
      note: (noteByDeal[deal.id] || "").trim(),
      items,
    });
    setSubmitting(prev => ({ ...prev, [deal.id]: false }));
    if (res) discardDraft(deal.id);
  };

  // ── Build the horizontal pivot data ───────────────────────────────────────
  type CellEntry = {
    assignmentId: string;
    personId: string;
    allocationPct: number;
    isAdded: boolean;
    isUpdated: boolean;
    isMarkedRemove: boolean;
  };

  // For each deal, get the effective assignment list (existing + adds, applying updates/removes)
  const dealRoleMap = useMemo(() => {
    // Map<dealId, Map<roleKey, CellEntry[]>>
    const out = new Map<string, Map<string, CellEntry[]>>();
    for (const d of deals) {
      const dDraft = drafts[d.id] || emptyDraft();
      const byRole = new Map<string, CellEntry[]>();
      const aList = assignments.filter(a => a.dealId === d.id);
      for (const a of aList) {
        const patch = dDraft.updates[a.id];
        const entry: CellEntry = {
          assignmentId: a.id,
          personId: patch?.personId ?? a.personId,
          allocationPct: patch?.allocationPct ?? a.allocationPct,
          isAdded: false,
          isUpdated: !!patch,
          isMarkedRemove: !!dDraft.removes[a.id],
        };
        const key = patch?.roleKey ?? a.roleKey ?? "—";
        if (!byRole.has(key)) byRole.set(key, []);
        byRole.get(key)!.push(entry);
      }
      for (const a of dDraft.adds) {
        const entry: CellEntry = {
          assignmentId: a.id,
          personId: a.personId,
          allocationPct: a.allocationPct,
          isAdded: true,
          isUpdated: false,
          isMarkedRemove: false,
        };
        const key = a.roleKey || "—";
        if (!byRole.has(key)) byRole.set(key, []);
        byRole.get(key)!.push(entry);
      }
      out.set(d.id, byRole);
    }
    return out;
  }, [deals, assignments, drafts]);

  // Union of all role keys across visible deals
  const allRoleKeys = useMemo(() => {
    const set = new Set<string>();
    dealRoleMap.forEach(byRole => byRole.forEach((_, k) => set.add(k)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dealRoleMap]);

  // Derive the dominant RoleCategory for each role column from the people
  // currently staffed in it (so we can colour-group same-department columns).
  const roleCategory = useMemo(() => {
    const out = new Map<string, string>();
    for (const rk of allRoleKeys) {
      const counts = new Map<string, number>();
      dealRoleMap.forEach(byRole => {
        (byRole.get(rk) || []).forEach(e => {
          const cat = allPersonById.get(e.personId)?.roleCategory || "Other";
          counts.set(cat, (counts.get(cat) || 0) + 1);
        });
      });
      let best = "Other"; let bestN = -1;
      counts.forEach((n, c) => { if (n > bestN) { best = c; bestN = n; } });
      out.set(rk, best);
    }
    return out;
  }, [allRoleKeys, dealRoleMap, allPersonById]);

  // Group role columns by category. User-customised orders (teamOrder /
  // colOrderByTeam) win; new teams or new role keys fall back to defaults.
  const groupedColumns = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const rk of allRoleKeys) {
      const c = roleCategory.get(rk) || "Other";
      (groups[c] ||= []).push(rk);
    }
    // Apply per-team custom order, append any new keys at the end.
    const orderedGroups: Record<string, string[]> = {};
    for (const team of Object.keys(groups)) {
      const custom = colOrderByTeam[team] || [];
      const set = new Set(groups[team]);
      const ordered = custom.filter(k => set.has(k));
      const orderedSet = new Set(ordered);
      const rest = groups[team].filter(k => !orderedSet.has(k)).sort((a, b) => a.localeCompare(b));
      orderedGroups[team] = [...ordered, ...rest];
    }

    // Apply team order, append new teams at the end (default catalogue order).
    const catOrder = Object.keys(CATEGORY_STYLES);
    const presentTeams = Object.keys(orderedGroups);
    const presentSet = new Set(presentTeams);
    const customTeam = (teamOrder || []).filter(t => presentSet.has(t));
    const customTeamSet = new Set(customTeam);
    const restTeams = [
      ...catOrder.filter(t => presentSet.has(t) && !customTeamSet.has(t)),
      ...presentTeams.filter(t => !catOrder.includes(t) && !customTeamSet.has(t)),
    ];
    const finalTeams = [...customTeam, ...restTeams];
    return { teams: finalTeams, byTeam: orderedGroups };
  }, [allRoleKeys, roleCategory, teamOrder, colOrderByTeam]);

  const orderedRoleKeys = useMemo(
    () => groupedColumns.teams.flatMap(t => groupedColumns.byTeam[t] || []),
    [groupedColumns]
  );

  const visibleRoleKeys = useMemo(
    () => orderedRoleKeys.filter(rk => !hiddenCols.has(rk)),
    [orderedRoleKeys, hiddenCols]
  );

  // Drag handlers
  const handleColumnDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const aId = String(active.id);
    const oId = String(over.id);
    const team = roleCategory.get(aId) || "Other";
    const teamOf = roleCategory.get(oId) || "Other";
    if (team !== teamOf) return; // only reorder within same team
    const list = groupedColumns.byTeam[team] || [];
    const fromIdx = list.indexOf(aId);
    const toIdx = list.indexOf(oId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = arrayMove(list, fromIdx, toIdx);
    setColOrderByTeam(prev => ({ ...prev, [team]: next }));
  };

  const handleTeamDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const teams = groupedColumns.teams;
    const fromIdx = teams.indexOf(String(active.id));
    const toIdx = teams.indexOf(String(over.id));
    if (fromIdx < 0 || toIdx < 0) return;
    setTeamOrder(arrayMove(teams, fromIdx, toIdx));
  };

  // ── Column resize handlers ───────────────────────────────────────────────
  const startResize = (rk: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[rk] ?? 200;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(120, Math.min(560, startW + (ev.clientX - startX)));
      setColWidths(prev => ({ ...prev, [rk]: w }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
  };

  // Filter deals by search (matches account/deal/person within deal)
  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...deals].sort((a, b) =>
      (a.account || "").localeCompare(b.account || "") ||
      (a.dealName || "").localeCompare(b.dealName || "")
    );
    if (!q) return sorted;
    return sorted.filter(d => {
      const byRole = dealRoleMap.get(d.id);
      const personHay = byRole ? Array.from(byRole.values()).flat()
        .map(e => allPersonById.get(e.personId)?.name || "").join(" ").toLowerCase() : "";
      const hay = `${d.account} ${d.dealName} ${d.dealId} ${personHay}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deals, search, dealRoleMap, allPersonById]);

  // Aggregate top stats
  const totals = useMemo(() => {
    const uniquePeople = new Set<string>();
    let allocSum = 0;
    assignments.forEach(a => uniquePeople.add(a.personId));
    uniquePeople.forEach(pid => {
      allocSum += assignments.filter(a => a.personId === pid).reduce((s, a) => s + a.allocationPct, 0);
    });
    return {
      dealCount: deals.length,
      peopleCount: uniquePeople.size,
      avgUtilPct: uniquePeople.size > 0 ? Math.round(allocSum / uniquePeople.size) : 0,
      assignmentCount: assignments.length,
    };
  }, [deals, assignments]);

  const dealsWithDrafts = Object.keys(drafts).filter(dId => draftCount(drafts[dId]) > 0);

  const dealsForAdd = useMemo(() => deals.slice().sort((a, b) =>
    (a.account || "").localeCompare(b.account || "") || (a.dealName || "").localeCompare(b.dealName || "")
  ), [deals]);

  // ── Render a single cell entry (one staffed person under a deal+role) ────
  const renderEntry = (deal: Deal, roleKey: string, e: CellEntry) => {
    const p = allPersonById.get(e.personId);
    const teamCat = (p?.roleCategory || "Other") as RoleCategory;
    const sameTeam = allPeople.filter(pp => pp.roleCategory === teamCat && !pp.leaving);
    const others = allPeople.filter(pp => pp.roleCategory !== teamCat && !pp.leaving);

    const draftKey = e.assignmentId;
    const draftVal = allocDraft[draftKey];
    const allocVal = draftVal !== undefined ? draftVal : String(e.allocationPct);
    const allocNum = Number(allocVal);
    const hrs = ((Number.isFinite(allocNum) ? allocNum : e.allocationPct) / 100) * MONTH_HOURS / 4.33;

    return (
      <div
        key={e.assignmentId}
        className={cn(
          "rounded-md border px-1.5 py-1 space-y-1 transition-colors",
          e.isMarkedRemove ? "bg-rose-50/70 border-rose-200" :
          e.isAdded ? "bg-emerald-50/70 border-emerald-200" :
          e.isUpdated ? "bg-amber-50/70 border-amber-200" :
          "bg-background border-border/60"
        )}
      >
        <div className="flex items-center gap-1">
          <select
            value={e.personId}
            disabled={e.isMarkedRemove}
            onChange={ev => {
              const val = ev.target.value;
              if (val && val !== e.personId) stageUpdate(deal.id, e.assignmentId, { personId: val });
            }}
            className={cn(
              "h-6 px-1.5 rounded border border-border bg-background text-[11px] flex-1 min-w-0 truncate",
              e.isMarkedRemove && "line-through opacity-60"
            )}
            title="Choose a different person"
          >
            <option value={e.personId}>{p?.name || "—"}{p?.tbh ? " (TBH)" : ""}</option>
            <optgroup label={`Same team (${teamCat})`}>
              {sameTeam.filter(pp => pp.id !== e.personId).slice(0, 80).map(pp => (
                <option key={pp.id} value={pp.id}>{pp.name}{pp.tbh ? " (TBH)" : ""}</option>
              ))}
            </optgroup>
            <optgroup label="Other teams">
              {others.slice(0, 80).map(pp => (
                <option key={pp.id} value={pp.id}>{pp.name} · {pp.roleCategory}</option>
              ))}
            </optgroup>
          </select>
          {e.isUpdated && !e.isMarkedRemove && (
            <button
              type="button"
              onClick={() => unstageUpdate(deal.id, e.assignmentId)}
              title="Revert edits"
              className="h-6 w-6 inline-flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-secondary/50"
            ><RotateCcw className="h-3 w-3" /></button>
          )}
          {e.isMarkedRemove ? (
            <button
              type="button"
              onClick={() => unstageRemove(deal.id, e.assignmentId)}
              title="Cancel removal"
              className="h-6 px-1.5 inline-flex items-center gap-0.5 rounded border border-border text-[10px] text-muted-foreground hover:bg-secondary/50"
            ><X className="h-2.5 w-2.5" /></button>
          ) : (
            <button
              type="button"
              onClick={() => stageRemove(deal.id, e.assignmentId)}
              title={e.isAdded ? "Remove from this request" : "Mark for removal"}
              className="h-6 w-6 inline-flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
            ><Trash2 className="h-3 w-3" /></button>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={e.isMarkedRemove}
              value={allocVal}
              onChange={ev => setAllocDraft(prev => ({ ...prev, [draftKey]: ev.target.value }))}
              onBlur={() => {
                const n = Math.max(0, Math.min(100, Number(allocVal)));
                if (Number.isFinite(n) && n !== e.allocationPct) {
                  stageUpdate(deal.id, e.assignmentId, { allocationPct: n });
                }
                setAllocDraft(prev => { const next = { ...prev }; delete next[draftKey]; return next; });
              }}
              className="h-6 w-12 px-1 rounded border border-border bg-background text-right font-mono text-[11px] disabled:opacity-50"
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{hrs.toFixed(1)}h/wk</span>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-3">
      {/* Header summary */}
      <div className="flex items-end justify-between gap-3 px-1">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{totals.dealCount} deals</span>
          <span className="mx-1.5">·</span>
          <span className="font-medium text-foreground">{totals.peopleCount} people</span>
          <span className="mx-1.5">·</span>
          <span className="font-medium text-foreground">{totals.avgUtilPct}% avg utilization</span>
          <span className="mx-1.5">·</span>
          <span className="font-medium text-foreground">{totals.assignmentCount} assignments</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Staffing — pivot view</h3>
            <p className="text-[11px] text-muted-foreground">
              One row per deal · one column per role. Edit person or % inline; changes are sent to Central Cx.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search account, deal, person…"
                className="h-8 pl-7 pr-3 rounded-md border border-border bg-background text-xs w-64 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                onClick={() => setPickerOpen(o => !o)}
                className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background text-xs text-foreground hover:bg-secondary/50"
                title="Show / hide role columns"
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
                <span className="text-[10px] text-muted-foreground">
                  {visibleRoleKeys.length}/{orderedRoleKeys.length}
                </span>
              </button>
              {pickerOpen && (
                <div className="absolute right-0 mt-1 z-30 w-72 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-popover shadow-lg p-2 text-xs">
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Role columns</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setHiddenCols(new Set())}
                        className="text-[10px] text-primary hover:underline"
                      >Show all</button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        onClick={() => setHiddenCols(new Set(orderedRoleKeys))}
                        className="text-[10px] text-muted-foreground hover:underline"
                      >Hide all</button>
                    </div>
                  </div>
                  {Object.keys(CATEGORY_STYLES).map(cat => {
                    const inCat = orderedRoleKeys.filter(rk => (roleCategory.get(rk) || "Other") === cat);
                    if (inCat.length === 0) return null;
                    const s = styleFor(cat);
                    return (
                      <div key={cat} className="mt-1.5">
                        <div className="flex items-center gap-1.5 px-1.5 py-1">
                          <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</span>
                        </div>
                        {inCat.map(rk => {
                          const checked = !hiddenCols.has(rk);
                          return (
                            <button
                              type="button"
                              key={rk}
                              onClick={() => {
                                setHiddenCols(prev => {
                                  const next = new Set(prev);
                                  if (next.has(rk)) next.delete(rk); else next.add(rk);
                                  return next;
                                });
                              }}
                              className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-secondary/60 text-left"
                            >
                              <span className={cn(
                                "h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0",
                                checked ? "bg-primary border-primary" : "border-border bg-background"
                              )}>
                                {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                              </span>
                              <span className="text-foreground truncate">{rk}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <select
              onChange={e => { if (e.target.value) { setAddForDeal(e.target.value); e.target.value = ""; } }}
              className="h-8 px-2 rounded-md border border-border bg-background text-xs text-muted-foreground"
              defaultValue=""
            >
              <option value="" disabled>+ Add person to a deal…</option>
              {dealsForAdd.map(d => (
                <option key={d.id} value={d.id}>{d.account} — {d.dealName}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: "100%", tableLayout: "fixed" }}>
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left w-[220px] sticky left-0 bg-secondary/60 z-10 border-r border-border">Account · Deal</th>
                <th className="px-3 py-2 text-right w-[90px] border-r border-border">MRR</th>
                {visibleRoleKeys.length === 0 ? (
                  <th className="px-3 py-2 text-left text-muted-foreground/60">No roles staffed yet</th>
                ) : visibleRoleKeys.map(rk => {
                  const cat = roleCategory.get(rk) || "Other";
                  const s = styleFor(cat);
                  const w = colWidths[rk] ?? 200;
                  return (
                    <th
                      key={rk}
                      style={{ width: w, minWidth: w, maxWidth: w }}
                      className={cn(
                        "relative px-2 py-2 text-left whitespace-nowrap border-r border-border/60 group",
                        s.head
                      )}
                      title={`${rk} · ${cat}`}
                    >
                      <div className="flex items-center gap-1.5 pr-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", s.dot)} />
                        <span className="truncate">{rk}</span>
                      </div>
                      <span
                        onMouseDown={(ev) => startResize(rk, ev)}
                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 transition-opacity"
                        title="Drag to resize"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredDeals.length === 0 && (
                <tr><td colSpan={2 + Math.max(1, visibleRoleKeys.length)} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  {search ? "No deals match your search." : "No active deals to staff."}
                </td></tr>
              )}
              {filteredDeals.map(d => {
                const byRole = dealRoleMap.get(d.id) || new Map<string, CellEntry[]>();
                return (
                  <tr key={d.id} className="border-t border-border/50 align-top hover:bg-secondary/20">
                    <td className="px-3 py-2 sticky left-0 bg-card z-10 border-r border-border">
                      <div className="font-medium text-foreground truncate max-w-[220px]">{d.account}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{d.dealName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{d.dealId}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-foreground border-r border-border whitespace-nowrap">
                      {formatINR(d.mrr || 0)}
                    </td>
                    {visibleRoleKeys.length === 0 && (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setAddForDeal(d.id)}
                          className="h-6 px-2 inline-flex items-center gap-1 rounded border border-dashed border-border text-[11px] text-muted-foreground hover:bg-secondary/50"
                        ><Plus className="h-3 w-3" /> Add person</button>
                      </td>
                    )}
                    {visibleRoleKeys.map(rk => {
                      const entries = byRole.get(rk) || [];
                      const cat = roleCategory.get(rk) || "Other";
                      const s = styleFor(cat);
                      const w = colWidths[rk] ?? 200;
                      return (
                        <td
                          key={rk}
                          style={{ width: w, minWidth: w, maxWidth: w }}
                          className={cn("px-2 py-2 border-r border-border/60 align-top", s.cell)}
                        >
                          <div className="space-y-1">
                            {entries.map(e => renderEntry(d, rk, e))}
                            <button
                              type="button"
                              onClick={() => setAddForDeal(d.id)}
                              className="h-6 w-full inline-flex items-center justify-center gap-1 rounded border border-dashed border-border/60 text-[10px] text-muted-foreground/80 hover:bg-secondary/30 hover:text-foreground"
                              title={`Add another person to ${rk}`}
                            ><Plus className="h-3 w-3" />{entries.length === 0 ? "Add" : ""}</button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-deal submission cards for any deals with staged changes */}
      {dealsWithDrafts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
            <Info className="h-3 w-3" />
            Each deal's staged changes are sent as one batched request to Central Cx. Each item is reviewed independently.
          </div>
          {dealsWithDrafts.map(dId => {
            const d = dealById.get(dId);
            if (!d) return null;
            const draft = drafts[dId];
            const dCount = draftCount(draft);
            const isSubmitting = !!submitting[dId];
            return (
              <div key={dId} className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-[12px] text-foreground flex-wrap">
                  <Send className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{d.account} — {d.dealName}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {dCount} staged ({draft.adds.length} add · {Object.keys(draft.updates).length} edit · {Object.keys(draft.removes).length} remove)
                  </span>
                </div>
                <input
                  value={noteByDeal[dId] || ""}
                  onChange={e => setNoteByDeal(prev => ({ ...prev, [dId]: e.target.value }))}
                  placeholder="Add a note for Central Cx (why are you proposing these changes?)"
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-xs"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => discardDraft(dId)}
                    disabled={isSubmitting}
                    className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-secondary/50"
                  ><X className="h-3 w-3" /> Discard</button>
                  <button
                    type="button"
                    onClick={() => submitDraft(d)}
                    disabled={isSubmitting}
                    className="h-7 px-3 inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 disabled:opacity-60"
                  >
                    <Send className="h-3 w-3" /> {isSubmitting ? "Sending…" : `Send ${dCount} change${dCount === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addForDeal && (
        <AddStaffingMemberDialog
          open={!!addForDeal}
          onOpenChange={v => { if (!v) setAddForDeal(null); }}
          people={allPeople}
          assignments={assignments}
          deals={deals}
          dealId={addForDeal}
          onAdd={(assignment) => { stageAdd(addForDeal!, assignment); setAddForDeal(null); }}
        />
      )}
    </section>
  );
}
