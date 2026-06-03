import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, RotateCcw, X, Send, Info, Columns3, Check, GripVertical, Trash2, Lock, Unlock, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/csvTargets";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";
import { uid, ROLE_SLOTS, ROLE_TO_PEOPLE_FILTER, ROLE_SENIORITY_PARENTS, getDescendantPersonIds, isAssignmentExpired, ACTIVE_DEAL_STATUSES } from "@/data/staffingData";
import { submitStaffingBatch, type BatchItem } from "@/lib/approvals";
import { AddStaffingMemberDialog } from "./AddStaffingMemberDialog";
import { RequestStaffingDialog } from "./RequestStaffingDialog";
import { BopmFilter, dealMatchesBopm, dealsStaffedByName } from "@/components/access/BopmFilter";
import { DealTypeFilter, dealMatchesType, type DealTypeFilterValue } from "@/components/filters/DealTypeFilter";
import { useAllPersonNames, dealCellMatchesPerson, useVsdHierarchy, VSD_NAMES } from "@/hooks/queries/legacy";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  horizontalListSortingStrategy, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useUserRole } from "@/hooks/useUserRole";
import { useClients } from "@/hooks/useClients";
import { toast } from "@/hooks/use-toast";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { DealApplicabilityPopover } from "./DealApplicabilityPopover";
import { useDealApplicabilityQuery } from "@/hooks/queries/useDealApplicabilityQuery";
import { buildApplicabilityIndex, isApplicableFromIndex } from "@/lib/applicability";
import { ROLE_TYPE_TO_DEPT } from "@/data/staffingData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Pastel HSL palette per role category. Header gets a saturated swatch,
// cells inherit a very subtle tint so the column groups are visually scannable
// without overwhelming the data.
// Category palette: light tint + colored dot, with dark-mode-aware tokens.
// head text uses *-800 in light / *-200 in dark; backgrounds use /15 opacity so they read on both themes.
// Each category gets:
//   head  – the column-header surface (lifted, always readable in dark mode)
//   cell  – the body cell tint (very subtle group banding)
//   dot   – the dot in front of the column label
//   chip  – staffed person pill (filled tint + brighter border + bright text)
//   add   – empty "+ Add …" placeholder pill (dashed, hint-coloured)
// All values use Tailwind colour stops with `/NN` opacity so they read in
// both light and dark themes against our semantic surfaces.
const CATEGORY_STYLES: Record<string, { head: string; cell: string; dot: string; label: string; chip: string; add: string }> = {
  "Operations":          { head: "bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/30",   cell: "bg-violet-500/5",   dot: "bg-violet-500",   label: "Operations",
                           chip: "bg-violet-500/15 dark:bg-violet-500/25 border-violet-500/40 text-violet-900 dark:text-violet-100",
                           add:  "border-violet-500/40 text-violet-700/80 dark:text-violet-200/70 hover:bg-violet-500/15 hover:text-violet-900 dark:hover:text-violet-100 hover:border-violet-500/60" },
  "Content":             { head: "bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/30",            cell: "bg-teal-500/5",     dot: "bg-teal-500",     label: "Content",
                           chip: "bg-teal-500/15 dark:bg-teal-500/25 border-teal-500/40 text-teal-900 dark:text-teal-100",
                           add:  "border-teal-500/40 text-teal-700/80 dark:text-teal-200/70 hover:bg-teal-500/15 hover:text-teal-900 dark:hover:text-teal-100 hover:border-teal-500/60" },
  "Content Strategy":    { head: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border-cyan-500/30",            cell: "bg-cyan-500/5",     dot: "bg-cyan-500",     label: "Content Strategy",
                           chip: "bg-cyan-500/15 dark:bg-cyan-500/25 border-cyan-500/40 text-cyan-900 dark:text-cyan-100",
                           add:  "border-cyan-500/40 text-cyan-700/80 dark:text-cyan-200/70 hover:bg-cyan-500/15 hover:text-cyan-900 dark:hover:text-cyan-100 hover:border-cyan-500/60" },
  "SEO":                 { head: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",cell: "bg-emerald-500/5",  dot: "bg-emerald-500",  label: "SEO",
                           chip: "bg-emerald-500/15 dark:bg-emerald-500/25 border-emerald-500/40 text-emerald-900 dark:text-emerald-100",
                           add:  "border-emerald-500/40 text-emerald-700/80 dark:text-emerald-200/70 hover:bg-emerald-500/15 hover:text-emerald-900 dark:hover:text-emerald-100 hover:border-emerald-500/60" },
  "Creative Strategy":   { head: "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200 border-fuchsia-500/30",cell: "bg-fuchsia-500/5",  dot: "bg-fuchsia-500",  label: "Creative Strategy",
                           chip: "bg-fuchsia-500/15 dark:bg-fuchsia-500/25 border-fuchsia-500/40 text-fuchsia-900 dark:text-fuchsia-100",
                           add:  "border-fuchsia-500/40 text-fuchsia-700/80 dark:text-fuchsia-200/70 hover:bg-fuchsia-500/15 hover:text-fuchsia-900 dark:hover:text-fuchsia-100 hover:border-fuchsia-500/60" },
  "Creative Copy":       { head: "bg-pink-500/15 text-pink-800 dark:text-pink-200 border-pink-500/30",            cell: "bg-pink-500/5",     dot: "bg-pink-500",     label: "Creative Copy",
                           chip: "bg-pink-500/15 dark:bg-pink-500/25 border-pink-500/40 text-pink-900 dark:text-pink-100",
                           add:  "border-pink-500/40 text-pink-700/80 dark:text-pink-200/70 hover:bg-pink-500/15 hover:text-pink-900 dark:hover:text-pink-100 hover:border-pink-500/60" },
  "Creative Art":        { head: "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30",            cell: "bg-rose-500/5",     dot: "bg-rose-500",     label: "Creative Art",
                           chip: "bg-rose-500/15 dark:bg-rose-500/25 border-rose-500/40 text-rose-900 dark:text-rose-100",
                           add:  "border-rose-500/40 text-rose-700/80 dark:text-rose-200/70 hover:bg-rose-500/15 hover:text-rose-900 dark:hover:text-rose-100 hover:border-rose-500/60" },
  "Video":               { head: "bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/30",    cell: "bg-orange-500/5",   dot: "bg-orange-500",   label: "Video",
                           chip: "bg-orange-500/15 dark:bg-orange-500/25 border-orange-500/40 text-orange-900 dark:text-orange-100",
                           add:  "border-orange-500/40 text-orange-700/80 dark:text-orange-200/70 hover:bg-orange-500/15 hover:text-orange-900 dark:hover:text-orange-100 hover:border-orange-500/60" },
  "Performance & Growth":{ head: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",        cell: "bg-amber-500/5",    dot: "bg-amber-500",    label: "Performance & Growth",
                           chip: "bg-amber-500/15 dark:bg-amber-500/25 border-amber-500/40 text-amber-900 dark:text-amber-100",
                           add:  "border-amber-500/40 text-amber-700/80 dark:text-amber-200/70 hover:bg-amber-500/15 hover:text-amber-900 dark:hover:text-amber-100 hover:border-amber-500/60" },
  "Other":               { head: "bg-slate-500/15 text-slate-800 dark:text-slate-200 border-slate-500/30",        cell: "bg-slate-500/5",    dot: "bg-slate-500",    label: "Other",
                           chip: "bg-slate-500/15 dark:bg-slate-500/25 border-slate-500/40 text-slate-900 dark:text-slate-100",
                           add:  "border-slate-500/40 text-slate-700/80 dark:text-slate-200/70 hover:bg-slate-500/15 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-500/60" },
};

// Aliases for the new role-slot categories (so they get the same swatches as
// their legacy equivalents). Order in this map is intentional: Delivery Ops
// first, then capability teams. `Object.keys(CATEGORY_STYLES)` later drives
// the default left-to-right column-group order in the Sheet view.
const NEW_CATEGORY_STYLES: typeof CATEGORY_STYLES = {
  "Delivery Ops":    { ...CATEGORY_STYLES["Operations"], label: "Delivery Ops and CS" },
  "Creative Video":  { ...CATEGORY_STYLES["Video"],      label: "Creative — Video" },
  "Creative Design": { ...CATEGORY_STYLES["Creative Art"], label: "Creative — Design" },
};
// Prepend Delivery Ops + content/SEO so they always render first, before the
// legacy entries (which we keep for back-compat with old assignments).
const ORDERED_CATEGORY_STYLES: typeof CATEGORY_STYLES = {
  "Delivery Ops":     NEW_CATEGORY_STYLES["Delivery Ops"],
  "Content":          CATEGORY_STYLES["Content"],
  "Content Strategy": CATEGORY_STYLES["Content Strategy"],
  "SEO":              CATEGORY_STYLES["SEO"],
  "Creative Strategy": CATEGORY_STYLES["Creative Strategy"],
  "Creative Copy":    CATEGORY_STYLES["Creative Copy"],
  "Creative Design":  NEW_CATEGORY_STYLES["Creative Design"],
  "Creative Art":     CATEGORY_STYLES["Creative Art"],
  "Creative Video":   NEW_CATEGORY_STYLES["Creative Video"],
  "Video":            CATEGORY_STYLES["Video"],
  "Operations":       CATEGORY_STYLES["Operations"],
  "Performance & Growth": CATEGORY_STYLES["Performance & Growth"],
  "Other":            CATEGORY_STYLES["Other"],
};
// Re-export the ordered map under the original name so the rest of the file
// (which already references `CATEGORY_STYLES`) inherits the new default
// ordering and the new entries automatically.
Object.keys(CATEGORY_STYLES).forEach(k => delete (CATEGORY_STYLES as any)[k]);
Object.assign(CATEGORY_STYLES, ORDERED_CATEGORY_STYLES);
const styleFor = (cat?: string) => CATEGORY_STYLES[cat || "Other"] || CATEGORY_STYLES["Other"];
const VIRTUAL_ROW_HEIGHT = 72;
const VIRTUAL_OVERSCAN_ROWS = 8;

// ── Compact inline date picker (used for per-assignment start/end dates) ───
function InlineDatePicker({
  value, onChange, placeholder, disabled, dealHint,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  placeholder: string;
  disabled?: boolean;
  dealHint?: string;
}) {
  const [open, setOpen] = useState(false);
  let selected: Date | undefined;
  try { selected = value ? parseISO(value) : undefined; } catch { selected = undefined; }
  const label = value ? format(selected as Date, "dd MMM yy") : placeholder;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-5 inline-flex items-center gap-1 px-1 rounded border border-border/60 bg-background/70 text-[10px] font-mono whitespace-nowrap",
            "hover:border-border hover:bg-background disabled:opacity-50",
            !value && "text-muted-foreground italic"
          )}
          title={dealHint ? `Deal: ${dealHint}` : placeholder}
        >
          <CalendarIcon className="h-2.5 w-2.5 opacity-60" />
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : undefined);
            setOpen(false);
          }}
          initialFocus
          className={cn("p-2 pointer-events-auto")}
        />
        <div className="border-t border-border px-2 py-1.5 flex items-center justify-between gap-2 text-[10px]">
          <span className="text-muted-foreground truncate">
            {dealHint ? `Deal: ${dealHint}` : ""}
          </span>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(undefined); setOpen(false); }}
              className="text-destructive hover:underline"
            >Clear</button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Hierarchy helpers (driven by ROLE_SLOTS order, which is top-down) ────
const ROLE_SLOT_BY_KEY = new Map(ROLE_SLOTS.map((s, i) => [s.roleKey, { ...s, rank: i }]));
const ROLE_LABEL = (rk: string) => ROLE_SLOT_BY_KEY.get(rk)?.roleLabel || rk;
const ROLE_CATEGORY_OF = (rk: string): string => ROLE_SLOT_BY_KEY.get(rk)?.category || "Other";
const ROLE_RANK = (rk: string): number => ROLE_SLOT_BY_KEY.get(rk)?.rank ?? 999;
const ROLE_LABEL_OF = (rk: string): string => {
  const slot = ROLE_SLOT_BY_KEY.get(rk);
  if (slot?.roleLabel) return slot.roleLabel;
  // Strip leading "rt_" taxonomy prefix and humanize the remainder.
  const clean = rk.replace(/^rt_/i, "").replace(/_/g, " ").trim();
  return clean
    .split(/\s+/)
    .map(w => w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))
    .join(" ");
};

type PersonGroups = { exact: Person[]; family: Person[]; other: Person[] };

/**
 * Two-stage candidate resolution for a role-slot column on a specific deal:
 *
 *   Stage 1 — strict roleTitle match against ROLE_TO_PEOPLE_FILTER.
 *   Stage 2 — hierarchy / pod scope:
 *     • If anyone in a "parent" role (per ROLE_SENIORITY_PARENTS) is already
 *       staffed on this deal, restrict to people who report (transitively)
 *       to one of those staffed seniors.
 *     • Otherwise, fall back to people whose pod matches the deal's pod
 *       (case-insensitive). If the deal has no pod, no fallback is applied.
 *
 * Excludes `leaving` people. `family`/`other` retained for shape compatibility.
 */
function resolvePeopleForRole(
  rk: string,
  allPeople: Person[],
  ctx?: { deal?: Deal | null; dealAssignments?: StaffingAssignment[] }
): PersonGroups {
  const titles = new Set((ROLE_TO_PEOPLE_FILTER[rk] || []).map(t => t.toLowerCase()));
  // Stage 1: strict roleTitle match.
  const stage1: Person[] = [];
  for (const p of allPeople) {
    if (p.leaving) continue;
    const rt = (p.roleTitle || "").toLowerCase();
    if (titles.has(rt)) stage1.push(p);
  }

  // No deal context → return Stage 1 (used outside the deal grid).
  if (!ctx || !ctx.deal) return { exact: stage1, family: [], other: [] };

  // Stage 2a: senior-driven scope.
  const parentRoles = new Set(ROLE_SENIORITY_PARENTS[rk] || []);
  const seniorIds: string[] = [];
  if (parentRoles.size && ctx.dealAssignments) {
    for (const a of ctx.dealAssignments) {
      if (parentRoles.has(a.roleKey)) seniorIds.push(a.personId);
    }
  }
  if (seniorIds.length) {
    const seniorById = new Map(allPeople.map(p => [p.id, p]));
    const seniorNames = seniorIds
      .map(id => seniorById.get(id)?.name || "")
      .filter(Boolean);
    const descendants = getDescendantPersonIds(seniorNames, allPeople);
    const scoped = stage1.filter(p => descendants.has(p.id));
    return { exact: scoped, family: [], other: [] };
  }

  // Stage 2b: pod fallback.
  const dealPod = (ctx.deal.pod || "").trim().toLowerCase();
  if (dealPod && dealPod !== "unassigned") {
    const scoped = stage1.filter(p => (p.pod || "").trim().toLowerCase() === dealPod);
    if (scoped.length) return { exact: scoped, family: [], other: [] };
  }

  return { exact: stage1, family: [], other: [] };
}

/** Backwards-compatible flat list (unused now, kept for safety). */
function peopleForRole(rk: string, allPeople: Person[]): Person[] {
  const g = resolvePeopleForRole(rk, allPeople);
  return [...g.exact, ...g.family, ...g.other];
}

// ── Styled person picker (replaces the bare native <select>) ──────────────
function PersonPickerPopover({
  currentId, candidates, candidateGroups, managerName, disabled, triggerLabel, triggerClassName,
  emptyLabel = "No people available",
  placeholder = "Search…",
  onSelect,
  align = "start",
  footer,
  assignments,
  deals,
}: {
  currentId?: string;
  /** Flat list — used when caller hasn't supplied groups. */
  candidates?: Person[];
  /** Pre-tiered candidate groups; takes precedence over `candidates` when present. */
  candidateGroups?: PersonGroups;
  /** Optional senior teammate; if provided, their direct reports float to the top of each group. */
  managerName?: string;
  disabled?: boolean;
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  emptyLabel?: string;
  placeholder?: string;
  onSelect: (personId: string) => void;
  align?: "start" | "center" | "end";
  footer?: (close: () => void) => React.ReactNode;
  assignments?: StaffingAssignment[];
  deals?: Deal[];
}) {
  const utilByPerson = useMemo(() => {
    const m = new Map<string, { total: number; items: { dealId: string; dealName: string; allocationPct: number; roleKey: string }[] }>();
    if (!assignments) return m;
    const dealName = (id: string) => {
      const d = deals?.find(x => x.id === id);
      return d ? `${d.account} — ${d.dealName}` : id;
    };
    for (const a of assignments) {
      if (isAssignmentExpired(a)) continue;
      const cur = m.get(a.personId) || { total: 0, items: [] };
      cur.total += a.allocationPct || 0;
      cur.items.push({ dealId: a.dealId, dealName: dealName(a.dealId), allocationPct: a.allocationPct || 0, roleKey: a.roleKey });
      m.set(a.personId, cur);
    }
    return m;
  }, [assignments, deals]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort each tier so direct reports of `managerName` come first.
  const sortByManager = useCallback((arr: Person[]) => {
    if (!managerName) return arr.slice();
    const mn = managerName.toLowerCase();
    return arr.slice().sort((a, b) => {
      const am = ((a as any).reportingManager || "").toLowerCase() === mn ? 0 : 1;
      const bm = ((b as any).reportingManager || "").toLowerCase() === mn ? 0 : 1;
      return am - bm;
    });
  }, [managerName]);

  const groups = useMemo<PersonGroups>(() => {
    if (candidateGroups) return candidateGroups;
    return { exact: candidates || [], family: [], other: [] };
  }, [candidateGroups, candidates]);

  const filteredGroups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matchOne = (p: Person) =>
      !needle ||
      (p.name || "").toLowerCase().includes(needle) ||
      (p.roleTitle || "").toLowerCase().includes(needle) ||
      ((p as any).designation || "").toLowerCase().includes(needle);
    return {
      exact: sortByManager(groups.exact.filter(matchOne)),
      family: sortByManager(groups.family.filter(matchOne)),
      other: sortByManager(groups.other.filter(matchOne)),
    };
  }, [q, groups, sortByManager]);

  const flatList = useMemo(
    () => [...filteredGroups.exact, ...filteredGroups.family, ...filteredGroups.other],
    [filteredGroups]
  );
  const totalCount = flatList.length;

  const renderRow = (pp: Person) => {
    const u = utilByPerson.get(pp.id) || { total: 0, items: [] };
    const free = Math.max(0, 100 - u.total);
    const utilColor =
      u.total > 100 ? "text-rose-600"
      : u.total >= 80 ? "text-amber-600"
      : "text-emerald-600";
    const isExpanded = expandedId === pp.id;
    return (
      <div
        key={pp.id}
        className={cn(
          "rounded-md mb-0.5 border border-transparent",
          pp.id === currentId && "bg-primary/5"
        )}
      >
        <div className="flex items-center gap-1.5 px-1.5 py-1.5">
          <Check className={cn("h-3 w-3 flex-shrink-0", pp.id === currentId ? "text-primary" : "opacity-0")} />
          <button
            type="button"
            onClick={() => { onSelect(pp.id); setOpen(false); setQ(""); }}
            className="flex-1 min-w-0 text-left"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-foreground truncate">{pp.name}</span>
              {pp.tbh && <span className="text-[9px] text-amber-700 border border-amber-300 rounded px-1">TBH</span>}
              {pp.leaving && <span className="text-[9px] text-rose-700 border border-rose-300 rounded px-1">Leaving</span>}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {[pp.roleTitle, (pp as any).designation, (pp as any).pod, pp.region].filter(Boolean).join(" · ")}
            </div>
          </button>
          <div className="text-right shrink-0 leading-tight">
            <div className={cn("text-[10.5px] font-mono font-medium", utilColor)}>{u.total}%</div>
            <div className="text-[9px] text-muted-foreground">{u.items.length} deal{u.items.length !== 1 ? "s" : ""} · {free}% free</div>
          </div>
          {assignments && (
            <button
              type="button"
              onClick={(ev) => { ev.stopPropagation(); setExpandedId(isExpanded ? null : pp.id); }}
              className="p-0.5 text-muted-foreground hover:text-foreground"
              title="Show engagements"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
            </button>
          )}
        </div>
        {isExpanded && (
          <div className="px-2 pb-2 -mt-0.5 space-y-0.5 border-t border-border/40 bg-secondary/20">
            {u.items.length === 0 ? (
              <div className="text-[10px] text-muted-foreground py-1.5">No current assignments — fully available.</div>
            ) : u.items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 pt-1">
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] text-foreground truncate">{it.dealName}</div>
                  <div className="text-[9px] text-muted-foreground truncate">{it.roleKey}</div>
                </div>
                <span className="text-[10px] font-mono text-foreground">{it.allocationPct}%</span>
                <span className="text-[9px] font-mono text-muted-foreground">{(it.allocationPct/100*40).toFixed(1)}h/wk</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn("group/picker", triggerClassName)}
          title="Click to change person"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-0 group-hover/picker:opacity-60 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-1.5">
        <div className="relative mb-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="w-full h-7 pl-7 pr-2 rounded-md border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {totalCount === 0 ? (
            <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">{emptyLabel}</div>
          ) : (
            <>{flatList.map(renderRow)}</>
          )}
        </div>
        {footer && (
          <div className="mt-1 pt-1 border-t border-border/60">
            {footer(() => { setOpen(false); setQ(""); })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Sortable column header (drag-and-drop reorder within a team) ──────────
function SortableColHeader({
  rk, cat, width, onResize, children,
}: {
  rk: string; cat: string; width: number;
  onResize: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rk });
  const s = styleFor(cat);
  const style: React.CSSProperties = {
    width, minWidth: width, maxWidth: width,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 5 : undefined,
  };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative px-2 py-2 text-left whitespace-nowrap border-r border-border/60 group",
        s.head
      )}
      title={`${rk} · ${cat}`}
    >
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100 -ml-0.5"
          title="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", s.dot)} />
        <span className="truncate">{ROLE_LABEL_OF(rk)}</span>
        {children}
      </div>
      <span
        onMouseDown={onResize}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 transition-opacity"
        title="Drag to resize"
      />
    </th>
  );
}

// ── Picker rows: sortable team group + sortable role inside ───────────────
function SortableTeamSection({
  team, children,
}: { team: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `team:${team}` });
  const s = styleFor(team);
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="mt-1.5 rounded border border-transparent hover:border-border/60">
      <div className="flex items-center gap-1.5 px-1.5 py-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          title="Drag to reorder team"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <span className={cn("h-2 w-2 rounded-full", s.dot)} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</span>
      </div>
      {children}
    </div>
  );
}

function SortablePickerRow({
  rk, checked, onToggle,
}: { rk: string; checked: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rk });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded hover:bg-secondary/60"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        title="Drag to reorder"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 flex items-center gap-2 py-0.5 text-left"
      >
        <span className={cn(
          "h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0",
          checked ? "bg-primary border-primary" : "border-border bg-background"
        )}>
          {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </span>
        <span className="text-foreground truncate">{ROLE_LABEL_OF(rk)}</span>
      </button>
    </div>
  );
}

interface Props {
  deals: Deal[];
  people: Person[];
  allPeople: Person[];
  assignments: StaffingAssignment[];
  /** When true, edits commit directly via the supplied handlers instead of routing through Central Cx approval. */
  directEdit?: boolean;
  onAddAssignment?: (a: StaffingAssignment) => Promise<any> | any;
  onUpdateAssignment?: (id: string, patch: Partial<StaffingAssignment>) => Promise<any> | any;
  onDeleteAssignment?: (id: string) => Promise<any> | any;
  /** Used to clear stale BOPM names from the deal sheet (virtual chips). */
  onUpdateDeal?: (dealId: string, updates: Partial<Deal>) => Promise<any> | any;
  /** When true, render a "Filter by BOPM" dropdown in the header. Used by VSD/Admin views. */
  enableBopmFilter?: boolean;
  /** Optional VSD scope for the BOPM filter dropdown (limits options to that VSD's pod). */
  bopmFilterScopedVsd?: string | null;
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
export function BopmStaffingFlatTable({
  deals, people, allPeople, assignments,
  directEdit, onAddAssignment, onUpdateAssignment, onDeleteAssignment,
  onUpdateDeal, enableBopmFilter, bopmFilterScopedVsd,
}: Props) {
  const [search, setSearch] = useState("");
  const [bopmFilter, setBopmFilter] = useState<string>("All");
  const { isAdmin } = useUserRole();
  const { deleteDeal: deleteDealMutation } = useClients();
  const { lockStaffing } = useStaffingMutations();
  const { data: applicabilityRows } = useDealApplicabilityQuery();
  const applicabilityIndex = useMemo(
    () => buildApplicabilityIndex(applicabilityRows),
    [applicabilityRows],
  );
  const [lockBusy, setLockBusy] = useState<Record<string, boolean>>({});
  const toggleLock = useCallback(async (dealId: string, lock: boolean) => {
    if (lockBusy[dealId]) return;
    setLockBusy(p => ({ ...p, [dealId]: true }));
    try { await lockStaffing(dealId, lock); } catch { /* toast handled */ }
    finally { setLockBusy(p => { const n = { ...p }; delete n[dealId]; return n; }); }
  }, [lockStaffing, lockBusy]);
  const [deleteDealTarget, setDeleteDealTarget] = useState<{ id: string; account: string; dealName: string } | null>(null);
  const [deletingDeal, setDeletingDeal] = useState(false);
  const [vsdFilter, setVsdFilter] = useState<string>("All");
  const [activeOnly, setActiveOnly] = useState<boolean>(true);
  const [dealTypeFilter, setDealTypeFilter] = useState<DealTypeFilterValue>("All");
  const { vsdForDeal } = useVsdHierarchy();
  const allPersonNames = useAllPersonNames();
  // "Request staffing" replaces the old direct-add flow. We capture the deal
  // (and optional role/category context) and route through staffing_review_requests.
  const [requestForDeal, setRequestForDeal] = useState<{ dealId: string; roleKey?: string; category?: string } | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ dealId: string; roleKey: string; category: string } | null>(null);
  // Engagement-aware change: opens the dialog in edit mode for an existing assignment.
  const [editEntry, setEditEntry] = useState<{
    dealId: string; assignmentId: string; roleKey: string;
    category: string; allocationPct: number;
  } | null>(null);
  const [allocDraft, setAllocDraft] = useState<Record<string, string>>({});
  const [savingAlloc, setSavingAlloc] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, DealDraft>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [noteByDeal, setNoteByDeal] = useState<Record<string, string>>({});
  // Deals the user just edited (added/removed staffing). Kept visible for a
  // few seconds so filter recomputation can't make the row vanish before
  // the next refetch finishes.
  const [recentlyTouched, setRecentlyTouched] = useState<Record<string, number>>({});
  const markTouched = useCallback((dealId: string) => {
    setRecentlyTouched((prev) => ({ ...prev, [dealId]: Date.now() + 8000 }));
    setTimeout(() => {
      setRecentlyTouched((prev) => {
        const next = { ...prev };
        if ((next[dealId] || 0) <= Date.now()) delete next[dealId];
        return next;
      });
    }, 8500);
  }, []);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableViewportHeight, setTableViewportHeight] = useState(560);

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

  useEffect(() => {
    const el = tableViewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setTableViewportHeight(el.clientHeight || 560);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const allPersonById = useMemo(() => new Map(allPeople.map(p => [p.id, p])), [allPeople]);
  const dealById = useMemo(() => new Map(deals.map(d => [d.id, d])), [deals]);

  // Set of deal IDs where the selected BOPM filter person is actively
  // staffed (assignment-based). Falls back to text-field match inside
  // `dealMatchesBopm` only when undefined.
  const bopmStaffedDealIds = useMemo(
    () => bopmFilter && bopmFilter !== "All"
      ? dealsStaffedByName(bopmFilter, allPeople, assignments)
      : undefined,
    [bopmFilter, allPeople, assignments],
  );

  // Build the VSD pill row from the data itself: union of the canonical
  // VSD_NAMES + any distinct VSD value `vsdForDeal` resolves for deals in
  // scope. With the hardcoded-only list, any deal whose VSD wasn't one of
  // the five canonical names silently collapsed into "Unassigned" — making
  // many deals appear to vanish when a user picked a VSD pill.
  const vsdPillOptions = useMemo(() => {
    // Pill counts must reflect the same base filters that gate the table
    // (Active-only toggle + Deal Type filter), otherwise the pills lie:
    // e.g. a VSD pill says "12" but selecting it shows only 3 rows because
    // 9 of those deals are closed/won-lost. We deliberately do NOT apply
    // the search / BOPM / VSD filters here — pill counts should describe
    // what would happen if the user clicked the pill, not the current
    // already-narrowed view.
    const now = Date.now();
    const stickyIds = new Set(
      Object.entries(recentlyTouched)
        .filter(([, exp]) => exp > now)
        .map(([id]) => id)
    );
    const baseDeals = deals.filter(d => {
      if (stickyIds.has(d.id)) return true;
      if (activeOnly && !ACTIVE_DEAL_STATUSES.has((d as any).dealStatus || "")) return false;
      if (dealTypeFilter !== "All" && !dealMatchesType((d as any).dealType, dealTypeFilter)) return false;
      return true;
    });
    const counts = new Map<string, number>();
    counts.set("All", baseDeals.length);
    let unassigned = 0;
    for (const d of baseDeals) {
      const v = vsdForDeal(d as any);
      if (!v) { unassigned++; continue; }
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    counts.set("Yet to be assigned", unassigned);
    // Make sure the canonical names always show up even if zero deals match.
    for (const v of VSD_NAMES) if (!counts.has(v)) counts.set(v, 0);
    const names = Array.from(counts.keys())
      .filter(k => k !== "All" && k !== "Yet to be assigned")
      .sort((a, b) => a.localeCompare(b));
    return {
      counts,
      list: [
        { key: "All", label: "All" },
        ...names.map(v => ({ key: v, label: v })),
        { key: "Yet to be assigned", label: "Unassigned" },
      ],
    };
  }, [deals, vsdForDeal, activeOnly, dealTypeFilter, recentlyTouched]);

  const hasActiveFilters =
    !!search ||
    bopmFilter !== "All" ||
    vsdFilter !== "All" ||
    dealTypeFilter !== "All";
  const clearAllFilters = useCallback(() => {
    setSearch("");
    setBopmFilter("All");
    setVsdFilter("All");
    setDealTypeFilter("All");
  }, []);

  // Index assignments by dealId once. Previously dealRoleMap did
  // assignments.filter(a => a.dealId === d.id) inside a loop over every
  // deal — O(deals × assignments) ≈ 780 k iterations on the live dataset
  // for every render / keystroke. One pass replaces the hot loop.
  const assignmentsByDeal = useMemo(() => {
    const out = new Map<string, StaffingAssignment[]>();
    for (const a of assignments) {
      let arr = out.get(a.dealId);
      if (!arr) { arr = []; out.set(a.dealId, arr); }
      arr.push(a);
    }
    return out;
  }, [assignments]);

  // Build a fast tokenised lookup for dealCellMatchesPerson once per
  // (allPeople, allPersonNames) pair. Previously each of the 3 BOPM virtual
  // columns called allPeople.filter(... regex tests ...) for every deal —
  // ~1.5 M regex executions per render on the live dataset. Now we just look
  // a token up in a Map<lowercased token, Person[]>.
  const personByCellToken = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const p of allPeople) {
      if (p.leaving) continue;
      const name = (p.name || "").trim();
      if (!name) continue;
      // Use the canonical matcher once per (token, person) — but we collapse
      // the search by indexing on every plausible alias (full name + first
      // word + first two words). dealCellMatchesPerson runs at most once per
      // unique cell token below.
      const lc = name.toLowerCase();
      const parts = lc.split(/\s+/).filter(Boolean);
      const aliases = new Set<string>([lc]);
      if (parts[0]) aliases.add(parts[0]);
      if (parts.length >= 2) aliases.add(`${parts[0]} ${parts[1]}`);
      aliases.forEach(alias => {
        let arr = map.get(alias);
        if (!arr) { arr = []; map.set(alias, arr); }
        arr.push(p);
      });
    }
    return map;
  }, [allPeople]);

  const resolveCellToken = useCallback((token: string): Person[] => {
    const t = token.trim().toLowerCase();
    if (!t) return [];
    const seeds = personByCellToken.get(t)
      || personByCellToken.get(t.split(/\s+/)[0] || "")
      || allPeople;
    // Final strict check — keeps the exact same matching semantics as before.
    const out: Person[] = [];
    for (const p of seeds) {
      if (p.leaving) continue;
      if (dealCellMatchesPerson(token, p.name, allPersonNames)) out.push(p);
    }
    return out;
  }, [personByCellToken, allPeople, allPersonNames]);

  const getDraft = (dealId: string): DealDraft => drafts[dealId] || emptyDraft();
  const setDraft = (dealId: string, next: DealDraft) =>
    setDrafts(prev => ({ ...prev, [dealId]: next }));
  const draftCount = (d: DealDraft) =>
    d.adds.length + Object.keys(d.updates).length + Object.keys(d.removes).length;

  const stageUpdate = (dealId: string, assignmentId: string, patch: Partial<StaffingAssignment>) => {
    if (directEdit && onUpdateAssignment) {
      if (patch.allocationPct !== undefined) {
        setSavingAlloc(prev => ({ ...prev, [assignmentId]: patch.allocationPct! }));
      }
      return Promise.resolve(onUpdateAssignment(assignmentId, patch)).finally(() => {
        if (patch.allocationPct !== undefined) {
          setSavingAlloc(prev => {
            const next = { ...prev };
            delete next[assignmentId];
            return next;
          });
        }
      });
    }
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
    if (directEdit && onAddAssignment) {
      markTouched(dealId);
      onAddAssignment(a);
      return;
    }
    const cur = getDraft(dealId);
    setDraft(dealId, { ...cur, adds: [...cur.adds, { ...a, id: a.id || uid() }] });
  };
  const stageRemove = (dealId: string, assignmentId: string) => {
    if (directEdit && onDeleteAssignment) {
      markTouched(dealId);
      onDeleteAssignment(assignmentId);
      return;
    }
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
    isExpired?: boolean;
    startDate?: string;
    endDate?: string;
    /** Read-only entry derived from the deal sheet (principal_bopm /
     *  senior_bopm / bopm text fields) — not an actual staffing_assignment row. */
    isVirtual?: boolean;
    /** Raw cell text when no Person record could be resolved. Render as a
     *  muted chip so the user still sees who's tagged on the deal sheet. */
    rawText?: string;
  };

  // For each deal, get the effective assignment list (existing + adds, applying updates/removes)
  const dealRoleMap = useMemo(() => {
    // Map<dealId, Map<roleKey, CellEntry[]>>
    const out = new Map<string, Map<string, CellEntry[]>>();
    for (const d of deals) {
      const dDraft = drafts[d.id] || emptyDraft();
      const byRole = new Map<string, CellEntry[]>();
      const aList = assignmentsByDeal.get(d.id) || [];
      for (const a of aList) {
        const patch = dDraft.updates[a.id];
        const effectiveEnd = (patch as any)?.endDate ?? a.endDate;
        const entry: CellEntry = {
          assignmentId: a.id,
          personId: patch?.personId ?? a.personId,
          allocationPct: savingAlloc[a.id] ?? patch?.allocationPct ?? a.allocationPct,
          isAdded: false,
          isUpdated: !!patch,
          isMarkedRemove: !!dDraft.removes[a.id],
          startDate: (patch as any)?.startDate ?? a.startDate,
          endDate: effectiveEnd,
          isExpired: isAssignmentExpired({ endDate: effectiveEnd }),
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
          startDate: a.startDate,
          endDate: a.endDate,
        };
        const key = a.roleKey || "—";
        if (!byRole.has(key)) byRole.set(key, []);
        byRole.get(key)!.push(entry);
      }
      // Defensively dedupe entries by assignmentId within each role so that any
      // legacy duplicates in the dataset can never cause duplicate React keys
      // (which previously caused render glitches / phantom rows).
      byRole.forEach((list, role) => {
        if (list.length < 2) return;
        const seen = new Set<string>();
        const deduped: CellEntry[] = [];
        for (const e of list) {
          if (seen.has(e.assignmentId)) continue;
          seen.add(e.assignmentId);
          deduped.push(e);
        }
        byRole.set(role, deduped);
      });
      out.set(d.id, byRole);
    }
    return out;
  }, [deals, drafts, assignmentsByDeal, resolveCellToken, savingAlloc]);

  // Default columns = full role catalogue, top-down hierarchy from ROLE_SLOTS,
  // plus any extra role keys we encounter on existing assignments (legacy).
  const allRoleKeys = useMemo(() => {
    const ordered: string[] = ROLE_SLOTS.map(s => s.roleKey);
    const seen = new Set(ordered);
    dealRoleMap.forEach(byRole => byRole.forEach((_, k) => {
      if (!seen.has(k)) { ordered.push(k); seen.add(k); }
    }));
    return ordered;
  }, [dealRoleMap]);

  // Each role column inherits its team/category directly from ROLE_SLOTS so the
  // colour-grouped headers stay stable even when nobody is staffed yet.
  const roleCategory = useMemo(() => {
    const out = new Map<string, string>();
    for (const rk of allRoleKeys) out.set(rk, ROLE_CATEGORY_OF(rk));
    return out;
  }, [allRoleKeys]);

  // Group role columns by category. User-customised orders (teamOrder /
  // colOrderByTeam) win; new teams or new role keys fall back to defaults.
  const groupedColumns = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const rk of allRoleKeys) {
      const c = roleCategory.get(rk) || "Other";
      (groups[c] ||= []).push(rk);
    }
    // Apply per-team custom order, append any new keys at the end (top-down
    // by ROLE_SLOTS rank — head first, then juniors).
    const orderedGroups: Record<string, string[]> = {};
    for (const team of Object.keys(groups)) {
      const custom = colOrderByTeam[team] || [];
      const set = new Set(groups[team]);
      const ordered = custom.filter(k => set.has(k));
      const orderedSet = new Set(ordered);
      const rest = groups[team]
        .filter(k => !orderedSet.has(k))
        .sort((a, b) => ROLE_RANK(a) - ROLE_RANK(b));
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
    const now = Date.now();
    const stickyIds = new Set(
      Object.entries(recentlyTouched)
        .filter(([, exp]) => exp > now)
        .map(([id]) => id)
    );
    const activeFiltered = activeOnly
      ? sorted.filter(d => stickyIds.has(d.id) || ACTIVE_DEAL_STATUSES.has((d as any).dealStatus || ""))
      : sorted;
    const typeFiltered = dealTypeFilter === "All"
      ? activeFiltered
      : activeFiltered.filter(d => stickyIds.has(d.id) || dealMatchesType((d as any).dealType, dealTypeFilter));
    const vsdFiltered = vsdFilter && vsdFilter !== "All"
      ? typeFiltered.filter(d => {
          if (stickyIds.has(d.id)) return true;
          const resolved = vsdForDeal(d as any);
          if (vsdFilter === "Yet to be assigned") return !resolved;
          return resolved === vsdFilter;
        })
      : typeFiltered;
    const bopmFiltered = bopmFilter && bopmFilter !== "All"
      ? vsdFiltered.filter(d => stickyIds.has(d.id) || dealMatchesBopm(d as any, bopmFilter, allPersonNames, bopmStaffedDealIds))
      : vsdFiltered;
    if (!q) return bopmFiltered;
    return bopmFiltered.filter(d => {
      const byRole = dealRoleMap.get(d.id);
      const personHay = byRole ? Array.from(byRole.values()).flat()
        .map(e => allPersonById.get(e.personId)?.name || "").join(" ").toLowerCase() : "";
      const hay = `${d.account} ${d.dealName} ${d.dealId} ${personHay}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deals, search, bopmFilter, vsdFilter, activeOnly, dealTypeFilter, vsdForDeal, dealRoleMap, allPersonById, allPersonNames, bopmStaffedDealIds, recentlyTouched]);

  // Note: a fixed-height row virtualiser used to live here, but each row's
  // actual height varies widely (depending on number of staffed people per
  // role), so the assumed VIRTUAL_ROW_HEIGHT was always wrong. That made the
  // top/bottom padders disagree with reality and caused the viewport to keep
  // growing / jumping as the user scrolled ("continuously scrolling and
  // glitching"). We now render all filtered deals directly — at our current
  // dataset size this is comfortably fast and, more importantly, correct.
  const virtualRows = useMemo(() => ({
    start: 0,
    deals: filteredDeals,
    topPad: 0,
    bottomPad: 0,
  }), [filteredDeals]);

  useEffect(() => {
    setTableScrollTop(0);
    if (tableViewportRef.current) tableViewportRef.current.scrollTop = 0;
  }, [search, bopmFilter, vsdFilter, activeOnly, dealTypeFilter]);

  // Aggregate top stats
  const totals = useMemo(() => {
    // Single pass: O(assignments) instead of O(uniquePeople × assignments).
    const allocByPerson = new Map<string, number>();
    let activeCount = 0;
    for (const a of assignments) {
      if (isAssignmentExpired(a)) continue;
      activeCount++;
      allocByPerson.set(a.personId, (allocByPerson.get(a.personId) || 0) + a.allocationPct);
    }
    let allocSum = 0;
    allocByPerson.forEach(v => { allocSum += v; });
    const uniquePeopleCount = allocByPerson.size;
    return {
      dealCount: deals.length,
      peopleCount: uniquePeopleCount,
      avgUtilPct: uniquePeopleCount > 0 ? Math.round(allocSum / uniquePeopleCount) : 0,
      assignmentCount: activeCount,
    };
  }, [deals, assignments]);

  const dealsWithDrafts = Object.keys(drafts).filter(dId => draftCount(drafts[dId]) > 0);

  // ── CSV export of the currently filtered Sheet view ──────────────────────
  const handleExportCsv = useCallback(() => {
    const esc = (v: unknown) => {
      const s = v === undefined || v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      "Client",
      "Deal Name",
      "Deal ID",
      "Deal Status",
      "Role Category",
      "Role",
      "Person",
      "Allocation %",
      "Allocation (hrs/month)",
      "Staffed",
    ];
    const rows: string[][] = [];
    for (const d of filteredDeals) {
      const byRole = dealRoleMap.get(d.id) || new Map<string, CellEntry[]>();
      for (const rk of orderedRoleKeys) {
        const cat = ROLE_CATEGORY_OF(rk);
        const role = ROLE_LABEL_OF(rk);
        const entries = (byRole.get(rk) || []).filter(e => !e.isMarkedRemove);
        if (entries.length === 0) {
          rows.push([
            d.account || "",
            d.dealName || "",
            (d as any).dealId || d.id,
            (d as any).dealStatus || "",
            cat,
            role,
            "",
            "",
            "",
            "Not Staffed",
          ]);
          continue;
        }
        for (const e of entries) {
          const p = allPersonById.get(e.personId);
          const pct = Number(e.allocationPct) || 0;
          const hrs = Math.round((pct / 100) * MONTH_HOURS * 10) / 10;
          rows.push([
            d.account || "",
            d.dealName || "",
            (d as any).dealId || d.id,
            (d as any).dealStatus || "",
            cat,
            role,
            p?.name || e.rawText || "—",
            String(pct),
            String(hrs),
            "Staffed",
          ]);
        }
      }
    }
    const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `staffing-sheet-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [filteredDeals, dealRoleMap, orderedRoleKeys, allPersonById]);

  const dealsForAdd = useMemo(() => deals.slice().sort((a, b) =>
    (a.account || "").localeCompare(b.account || "") || (a.dealName || "").localeCompare(b.dealName || "")
  ), [deals]);

  // ── Render a single cell entry (one staffed person under a deal+role) ────
  const renderEntry = (deal: Deal, roleKey: string, e: CellEntry) => {
    const p = allPersonById.get(e.personId);
    // Strict scope: only people whose designation matches this column AND who
    // (when a more senior teammate is already staffed) report to that manager.
    const cat = ROLE_CATEGORY_OF(roleKey);
    const colRank = ROLE_RANK(roleKey);
    const byRoleForDeal = dealRoleMap.get(deal.id) || new Map<string, CellEntry[]>();
    const seniorMgr = (() => {
      let best: { person: Person; rank: number } | null = null;
      byRoleForDeal.forEach((arr, otherRk) => {
        if (ROLE_CATEGORY_OF(otherRk) !== cat) return;
        const r = ROLE_RANK(otherRk);
        if (r >= colRank) return;
        arr.forEach(en => {
          if (en.isMarkedRemove) return;
          const pp = allPersonById.get(en.personId);
          if (!pp) return;
          if (!best || r < best.rank) best = { person: pp, rank: r };
        });
      });
      return best?.person;
    })();
    // Hierarchy/pod-scoped candidate resolution. Manager soft-sort still applied
    // inside the picker.
    const dealAssignmentsEffective: StaffingAssignment[] = [];
    byRoleForDeal.forEach((arr, otherRk) => {
      arr.forEach(en => {
        if (en.isMarkedRemove) return;
        dealAssignmentsEffective.push({
          id: en.assignmentId,
          dealId: deal.id,
          roleKey: otherRk,
          personId: en.personId,
          allocationPct: en.allocationPct,
        });
      });
    });
    const colGroups = resolvePeopleForRole(roleKey, allPeople, {
      deal,
      dealAssignments: dealAssignmentsEffective,
    });

    const draftKey = e.assignmentId;
    const draftVal = allocDraft[draftKey];
    const allocVal = draftVal !== undefined ? draftVal : String(e.allocationPct);
    const allocNum = Number(allocVal);
    const hrs = ((Number.isFinite(allocNum) ? allocNum : e.allocationPct) / 100) * MONTH_HOURS / 4.33;
    const chipStyle = styleFor(ROLE_CATEGORY_OF(roleKey));

    return (
      <div
        key={e.assignmentId}
        className={cn(
          "group/entry rounded-md border px-1.5 py-1 transition-colors",
          e.isMarkedRemove ? "bg-destructive/10 border-destructive/30" :
          e.isAdded ? "bg-positive/10 border-positive/30" :
          e.isUpdated ? "bg-warning/10 border-warning/30" :
          chipStyle.chip,
          e.isExpired && !e.isMarkedRemove && "opacity-50 font-light"
        )}
        title={e.isExpired ? `No longer staffed (ended ${e.endDate})` : undefined}
      >
        <div className="flex items-center gap-1.5">
          {/* Name as styled popover trigger (same row as %) */}
          <div className="flex-1 min-w-0">
            <PersonPickerPopover
              currentId={e.personId}
              candidateGroups={colGroups}
              managerName={seniorMgr?.name}
              assignments={assignments}
              deals={deals}
              disabled={!!e.isMarkedRemove}
              triggerClassName={cn(
                "w-full inline-flex items-center justify-between gap-1 px-1 py-0.5 rounded-sm text-[11px] font-medium text-foreground hover:bg-foreground/5 hover:ring-1 hover:ring-border transition-colors",
                e.isMarkedRemove && "line-through opacity-60"
              )}
              triggerLabel={`${p?.name || "—"}${p?.tbh ? " (TBH)" : ""}`}
              emptyLabel={`No ${ROLE_LABEL(roleKey)} available`}
              onSelect={(personId) => {
                if (personId !== e.personId) {
                  stageUpdate(deal.id, e.assignmentId, { personId });
                }
              }}
            />
          </div>
          {/* % allocation inline */}
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            disabled={e.isMarkedRemove || e.isVirtual}
            value={allocVal}
            onChange={ev => setAllocDraft(prev => ({ ...prev, [draftKey]: ev.target.value }))}
            onBlur={() => {
              if (e.isVirtual) {
                setAllocDraft(prev => { const next = { ...prev }; delete next[draftKey]; return next; });
                return;
              }
              const n = Math.max(0, Math.min(100, Number(allocVal)));
              if (Number.isFinite(n) && n !== e.allocationPct) {
                stageUpdate(deal.id, e.assignmentId, { allocationPct: n });
              }
              setAllocDraft(prev => { const next = { ...prev }; delete next[draftKey]; return next; });
            }}
            className="h-5 w-9 px-1 rounded border border-border/60 bg-background/70 text-right font-mono text-[10px] disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            title={e.isVirtual ? "Read-only (synced from deal sheet)" : `${hrs.toFixed(1)} h/wk`}
          />
          <span className="text-[9px] text-muted-foreground -ml-0.5">%</span>
          {/* Remove (×) — replaces the old trash icon */}
          {e.isMarkedRemove ? (
            <button
              type="button"
              onClick={() => unstageRemove(deal.id, e.assignmentId)}
              title="Cancel removal"
              className="h-4 w-4 inline-flex items-center justify-center rounded text-[10px] text-muted-foreground hover:text-foreground"
            ><RotateCcw className="h-2.5 w-2.5" /></button>
          ) : (
            <button
              type="button"
              onClick={() => stageRemove(deal.id, e.assignmentId)}
              title={e.isAdded ? "Remove from this request" : "Mark for removal"}
              className="h-4 w-4 inline-flex items-center justify-center rounded text-muted-foreground/60 opacity-0 group-hover/entry:opacity-100 hover:text-rose-600 transition-opacity"
            ><X className="h-3 w-3" /></button>
          )}
          {e.isUpdated && !e.isMarkedRemove && (
            <button
              type="button"
              onClick={() => unstageUpdate(deal.id, e.assignmentId)}
              title="Revert edits"
              className="h-4 w-4 inline-flex items-center justify-center rounded text-amber-700 hover:text-amber-900"
            ><RotateCcw className="h-2.5 w-2.5" /></button>
          )}
        </div>
        {!e.isVirtual && (
          <div className="flex items-center gap-1 mt-1 pl-1">
            <InlineDatePicker
              value={e.startDate}
              disabled={!!e.isMarkedRemove}
              placeholder="Start"
              dealHint={deal.startDate}
              onChange={(v) => stageUpdate(deal.id, e.assignmentId, { startDate: v })}
            />
            <span className="text-[9px] text-muted-foreground">→</span>
            <InlineDatePicker
              value={e.endDate}
              disabled={!!e.isMarkedRemove}
              placeholder="End"
              dealHint={deal.endDate}
              onChange={(v) => stageUpdate(deal.id, e.assignmentId, { endDate: v })}
            />
          </div>
        )}
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
        <header className="px-3 py-2 border-b border-border flex items-center justify-end gap-2 flex-wrap">
            <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
              <button
                onClick={() => setActiveOnly(true)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  activeOnly
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Show only Active Deal, Deal Disputed, New Deal in SLA/PO, Deal in Renewal Process"
              >
                Active{" "}
                <span className="opacity-70 ml-0.5">
                  {deals.filter(d => ACTIVE_DEAL_STATUSES.has((d as any).dealStatus || "")).length}
                </span>
              </button>
              <button
                onClick={() => setActiveOnly(false)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  !activeOnly
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Include closed/churned deals"
              >
                All deals <span className="opacity-70 ml-0.5">{deals.length}</span>
              </button>
            </div>
            <DealTypeFilter value={dealTypeFilter} onChange={setDealTypeFilter} />
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search account, deal, person…"
                className="h-8 pl-7 pr-3 rounded-md border border-border bg-background text-xs w-64 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            {enableBopmFilter && (
              <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5 overflow-x-auto max-w-full">
                {vsdPillOptions.list.map(v => {
                  const c = vsdPillOptions.counts.get(v.key) ?? 0;
                  return (
                    <button
                      key={v.key}
                      onClick={() => setVsdFilter(v.key)}
                      title={`${v.label} · ${c} deal${c === 1 ? "" : "s"}`}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                        vsdFilter === v.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {v.label} <span className="opacity-70 ml-0.5">{c}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {enableBopmFilter && (
              <BopmFilter
                value={bopmFilter}
                onChange={setBopmFilter}
                scopedVsd={
                  vsdFilter !== "All" && vsdFilter !== "Yet to be assigned"
                    ? vsdFilter
                    : (bopmFilterScopedVsd ?? undefined)
                }
                className="h-8 w-[200px] text-xs"
              />
            )}
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
                <div className="absolute right-0 mt-1 z-30 w-80 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-popover shadow-lg p-2 text-xs">
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Role columns · drag to reorder
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => { setHiddenCols(new Set()); setTeamOrder(null); setColOrderByTeam({}); }}
                        className="text-[10px] text-primary hover:underline"
                      >Reset</button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        onClick={() => setHiddenCols(new Set(orderedRoleKeys))}
                        className="text-[10px] text-muted-foreground hover:underline"
                      >Hide all</button>
                    </div>
                  </div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTeamDragEnd}
                  >
                    <SortableContext
                      items={groupedColumns.teams.map(t => `team:${t}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {groupedColumns.teams.map(team => {
                        const inCat = groupedColumns.byTeam[team] || [];
                        if (inCat.length === 0) return null;
                        return (
                          <SortableTeamSection key={team} team={team}>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleColumnDragEnd}
                            >
                              <SortableContext items={inCat} strategy={verticalListSortingStrategy}>
                                {inCat.map(rk => (
                                  <SortablePickerRow
                                    key={rk}
                                    rk={rk}
                                    checked={!hiddenCols.has(rk)}
                                    onToggle={() => {
                                      setHiddenCols(prev => {
                                        const next = new Set(prev);
                                        if (next.has(rk)) next.delete(rk); else next.add(rk);
                                        return next;
                                      });
                                    }}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          </SortableTeamSection>
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background text-xs text-foreground hover:bg-secondary/50"
              title="Download CSV of the current Sheet view"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            {!directEdit && (
              <select
                onChange={e => { if (e.target.value) { setRequestForDeal({ dealId: e.target.value }); e.target.value = ""; } }}
                className="h-8 px-2 rounded-md border border-border bg-background text-xs text-muted-foreground"
                defaultValue=""
              >
                <option value="" disabled>+ Request staffing for a deal…</option>
                {dealsForAdd.map(d => (
                  <option key={d.id} value={d.id}>{d.account} — {d.dealName}</option>
                ))}
              </select>
            )}
        </header>

        <div
          ref={tableViewportRef}
          onScroll={e => setTableScrollTop(e.currentTarget.scrollTop)}
          className="max-h-[calc(100vh-260px)] min-h-[420px] overflow-auto"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
          <table className="text-xs border-collapse" style={{ minWidth: "100%", tableLayout: "fixed" }}>
            <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 z-20">
              <tr>
                <th className="px-3 py-2 text-left w-[220px] sticky left-0 bg-secondary z-30 border-r border-border">Account · Deal</th>
                <th className="px-3 py-2 text-right w-[90px] border-r border-border bg-secondary">MRR</th>
                {visibleRoleKeys.length === 0 ? (
                  <th className="px-3 py-2 text-left text-muted-foreground/60">No roles staffed yet</th>
                ) : (
                  <SortableContext items={visibleRoleKeys} strategy={horizontalListSortingStrategy}>
                    {visibleRoleKeys.map(rk => {
                      const cat = roleCategory.get(rk) || "Other";
                      const w = colWidths[rk] ?? 200;
                      return (
                        <SortableColHeader
                          key={rk}
                          rk={rk}
                          cat={cat}
                          width={w}
                          onResize={(ev) => startResize(rk, ev)}
                        />
                      );
                    })}
                  </SortableContext>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredDeals.length === 0 && (
                <tr><td colSpan={2 + Math.max(1, visibleRoleKeys.length)} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  {hasActiveFilters || !activeOnly ? (
                    <span className="inline-flex items-center gap-2">
                      No deals match these filters.
                      <button
                        type="button"
                        onClick={() => { clearAllFilters(); setActiveOnly(true); }}
                        className="text-primary hover:underline"
                      >Clear filters</button>
                    </span>
                  ) : (
                    "No active deals to staff."
                  )}
                </td></tr>
              )}
              {virtualRows.topPad > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={2 + Math.max(1, visibleRoleKeys.length)} style={{ height: virtualRows.topPad, padding: 0, border: 0 }} />
                </tr>
              )}
              {virtualRows.deals.map(d => {
                const byRole = dealRoleMap.get(d.id) || new Map<string, CellEntry[]>();
                return (
                  <tr key={d.id} className="border-t border-border align-top hover:bg-accent/30 transition-colors group/row">
                     <td className="px-3 py-2 sticky left-0 bg-card group-hover/row:bg-accent/30 z-10 border-r border-border transition-colors">
                       <div className="flex items-start justify-between gap-2">
                         <Link
                           to={`/deals/${d.id}?tab=Staffing`}
                           className="block hover:underline flex-1 min-w-0"
                           title={`Open ${d.account} — ${d.dealName} staffing`}
                         >
                           <div className="font-medium text-foreground truncate max-w-[220px]">{d.account}</div>
                           <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{d.dealName}</div>
                           <div className="font-mono text-[10px] text-muted-foreground">{d.dealId}</div>
                         </Link>
                         {isAdmin && (
                           <button
                             type="button"
                             title="Delete deal (admin only)"
                             aria-label={`Delete deal ${d.account} ${d.dealName}`}
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               setDeleteDealTarget({ id: d.id, account: d.account, dealName: d.dealName });
                             }}
                             className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                           >
                             <Trash2 className="h-3.5 w-3.5" />
                           </button>
                         )}
                       </div>
                        <StaffingLockChip
                          deal={d}
                          isAdmin={isAdmin}
                          busy={!!lockBusy[d.id]}
                          onToggle={(lock) => toggleLock(d.id, lock)}
                        />
                        {isAdmin && (
                          <div className="mt-1">
                            <DealApplicabilityPopover
                              dealId={d.id}
                              dealLabel={`${d.account} — ${d.dealName}`}
                            />
                          </div>
                        )}
                     </td>
                    <td className="px-3 py-2 text-right font-mono text-foreground border-r border-border whitespace-nowrap">
                      {formatINR(d.mrr || 0)}
                    </td>
                    {visibleRoleKeys.length === 0 && !directEdit && (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setRequestForDeal({ dealId: d.id })}
                          className="h-6 px-2 inline-flex items-center gap-1 rounded border border-dashed border-border text-[11px] text-muted-foreground hover:bg-secondary/50"
                        ><Plus className="h-3 w-3" /> Request staffing</button>
                      </td>
                    )}
                    {visibleRoleKeys.map(rk => {
                      const entries = byRole.get(rk) || [];
                      const cat = roleCategory.get(rk) || "Other";
                      const s = styleFor(cat);
                      const w = colWidths[rk] ?? 200;
                      const deptId = ROLE_TYPE_TO_DEPT[rk] || "";
                      const applicable = deptId
                        ? isApplicableFromIndex(applicabilityIndex, d.id, deptId, rk)
                        : true;
                      if (!applicable) {
                        return (
                          <td
                            key={rk}
                            style={{ width: w, minWidth: w, maxWidth: w }}
                            className={cn(
                              "px-1.5 py-1.5 border-r border-border/60 align-top text-center text-muted-foreground/40 text-[10px] bg-muted/20",
                            )}
                            title="Not applicable to this deal"
                          >
                            —
                          </td>
                        );
                      }
                      if (directEdit && onAddAssignment) {
                        return (
                          <td
                            key={rk}
                            style={{ width: w, minWidth: w, maxWidth: w }}
                            className={cn("px-1.5 py-1.5 border-r border-border/60 align-top", s.cell)}
                          >
                            <div className="space-y-1">
                              {entries.map(e => renderEntry(d, rk, e))}
                              <button
                                type="button"
                                onClick={() => setQuickAdd({ dealId: d.id, roleKey: rk, category: cat })}
                                className={cn(
                                  "w-full flex items-center justify-between gap-1 px-1.5 py-1 text-[10.5px] rounded-md border border-dashed transition-colors",
                                  s.add
                                )}
                              >
                                <span className="truncate">+ Add {ROLE_LABEL(rk)}</span>
                              </button>
                            </div>
                          </td>
                        );
                      }

                      // Determine "manager" filter for this column on this deal:
                      // if a more-senior person from the same team is already
                      // staffed, restrict the picker to that manager's reports
                      // (plus the manager themselves). The column's own role
                      // hierarchy rank is the cutoff.
                      const colRank = ROLE_RANK(rk);
                      const sameTeamEntries: { person: Person; rank: number }[] = [];
                      byRole.forEach((arr, otherRk) => {
                        if (ROLE_CATEGORY_OF(otherRk) !== cat) return;
                        const r = ROLE_RANK(otherRk);
                        arr.forEach(en => {
                          if (en.isMarkedRemove) return;
                          const pp = allPersonById.get(en.personId);
                          if (pp) sameTeamEntries.push({ person: pp, rank: r });
                        });
                      });
                      // The "manager" is the most senior staffed person in the
                      // team whose rank is strictly more senior than the
                      // column's own role. Falls back to roleTitle/designation
                      // if a senior team member is staffed elsewhere.
                      const manager = sameTeamEntries
                        .filter(x => x.rank < colRank)
                        .sort((a, b) => a.rank - b.rank)[0]?.person;
                      // Tiered candidate resolution; manager is a soft sort
                      // applied inside the picker. Exclude people already
                      // staffed on this deal in this role.
                      const usedIds = new Set(entries.filter(x => !x.isMarkedRemove).map(x => x.personId));
                      const dealAssignmentsEffective: StaffingAssignment[] = [];
                      byRole.forEach((arr, otherRk) => {
                        arr.forEach(en => {
                          if (en.isMarkedRemove) return;
                          dealAssignmentsEffective.push({
                            id: en.assignmentId,
                            dealId: d.id,
                            roleKey: otherRk,
                            personId: en.personId,
                            allocationPct: en.allocationPct,
                          });
                        });
                      });
                      const groupsAll = resolvePeopleForRole(rk, allPeople, {
                        deal: d,
                        dealAssignments: dealAssignmentsEffective,
                      });
                      const pickerGroups: PersonGroups = {
                        exact: groupsAll.exact.filter(pp => !usedIds.has(pp.id)),
                        family: groupsAll.family.filter(pp => !usedIds.has(pp.id)),
                        other: groupsAll.other.filter(pp => !usedIds.has(pp.id)),
                      };
                      const pickerTotal = pickerGroups.exact.length + pickerGroups.family.length + pickerGroups.other.length;
                      const pickerKey = `picker:${d.id}:${rk}`;
                      return (
                        <td
                          key={rk}
                          style={{ width: w, minWidth: w, maxWidth: w }}
                          className={cn("px-1.5 py-1.5 border-r border-border/60 align-top", s.cell)}
                        >
                          <div className="space-y-1">
                            {entries.map(e => renderEntry(d, rk, e))}
                            <PersonPickerPopover
                              key={pickerKey}
                              candidateGroups={pickerGroups}
                              managerName={manager?.name}
                              assignments={assignments}
                              deals={deals}
                              disabled={pickerTotal === 0}
                              triggerClassName={cn(
                                "w-full flex items-center justify-between gap-1 px-1.5 py-1 text-[10.5px] rounded-md border border-dashed transition-colors",
                                pickerTotal === 0
                                  ? "text-muted-foreground/50 border-border/30 cursor-not-allowed"
                                  : s.add
                              )}
                              triggerLabel={
                                pickerTotal === 0
                                  ? `No ${ROLE_LABEL(rk)} available`
                                  : (manager ? `+ Add (under ${manager.name.split(" ")[0]})` : `+ Add ${ROLE_LABEL(rk)}`)
                              }
                              emptyLabel={`No ${ROLE_LABEL(rk)} available`}
                              onSelect={(personId) => {
                                stageAdd(d.id, {
                                  id: uid(),
                                  dealId: d.id,
                                  personId,
                                  roleKey: rk,
                                  category: cat as RoleCategory,
                                  allocationPct: 50,
                                  startDate: d.startDate,
                                  endDate: d.endDate,
                                } as StaffingAssignment);
                              }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {virtualRows.bottomPad > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={2 + Math.max(1, visibleRoleKeys.length)} style={{ height: virtualRows.bottomPad, padding: 0, border: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
          </DndContext>
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

      {requestForDeal && (() => {
        const d = deals.find(x => x.id === requestForDeal.dealId);
        const label = d ? `${d.account} — ${d.dealName}` : requestForDeal.dealId;
        return (
          <RequestStaffingDialog
            open={!!requestForDeal}
            onOpenChange={v => { if (!v) setRequestForDeal(null); }}
            dealId={requestForDeal.dealId}
            dealLabel={label}
            initialRoleKey={requestForDeal.roleKey}
            initialCategory={requestForDeal.category}
          />
        );
      })()}

      {quickAdd && directEdit && onAddAssignment && (
        <AddStaffingMemberDialog
          open={!!quickAdd}
          onOpenChange={v => { if (!v) setQuickAdd(null); }}
          people={allPeople}
          assignments={assignments}
          deals={deals}
          dealId={quickAdd.dealId}
          initialCategory={quickAdd.category as RoleCategory}
          initialRoleKey={quickAdd.roleKey}
          onAdd={(assignment) => {
            // Strip the dialog-only `category` field — `staffing_assignments`
            // has no such column and a stray key was making the insert payload
            // diverge from `StaffingAssignment`.
            const { category: _omit, ...clean } = assignment as StaffingAssignment & { category?: unknown };
            markTouched(quickAdd.dealId);
            onAddAssignment({ ...clean, roleKey: quickAdd.roleKey });
            setQuickAdd(null);
          }}
        />
      )}

      {editEntry && (
        <AddStaffingMemberDialog
          open={!!editEntry}
          onOpenChange={v => { if (!v) setEditEntry(null); }}
          people={allPeople}
          assignments={assignments}
          deals={deals}
          dealId={editEntry.dealId}
          initialCategory={editEntry.category as RoleCategory}
          initialRoleKey={editEntry.roleKey}
          initialAllocationPct={editEntry.allocationPct}
          editingAssignmentId={editEntry.assignmentId}
          onAdd={() => { /* not used in edit mode */ }}
          onUpdate={(assignmentId, patch) => {
            stageUpdate(editEntry.dealId, assignmentId, patch);
            setEditEntry(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteDealTarget} onOpenChange={(open) => { if (!open && !deletingDeal) setDeleteDealTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDealTarget && (
                <>
                  <span className="font-medium text-foreground">{deleteDealTarget.account}</span> — {deleteDealTarget.dealName}
                  <br />
                  This moves the deal and its staffing assignments to Trash. You can restore from Settings → Trash within 30 days.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDeal}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingDeal}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteDealTarget) return;
                setDeletingDeal(true);
                try {
                  await deleteDealMutation(deleteDealTarget.id);
                  toast({ title: "Deal moved to Trash", description: `${deleteDealTarget.account} — ${deleteDealTarget.dealName}` });
                  setDeleteDealTarget(null);
                } catch (err: any) {
                  toast({ title: "Failed to delete deal", description: err?.message || "Please try again.", variant: "destructive" });
                } finally {
                  setDeletingDeal(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDeal ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// Compact "Staffing locked / unlocked" chip rendered inside the sticky
// Account · Deal cell. Admins (Central CX) can click to toggle; everyone
// else sees a read-only chip. Uses semantic green (locked = Staffed) and
// amber (unlocked = Unstaffed) per the project design memory.
function StaffingLockChip({
  deal, isAdmin, busy, onToggle,
}: {
  deal: Deal;
  isAdmin: boolean;
  busy: boolean;
  onToggle: (lock: boolean) => void;
}) {
  const locked = !!deal.staffingLockedAt;
  const lockedDate = locked && deal.staffingLockedAt
    ? new Date(deal.staffingLockedAt).toLocaleDateString()
    : "";
  const baseChip = "inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border";
  const lockedStyle = "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400";
  const unlockedStyle = "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (!isAdmin) {
    return (
      <span
        className={cn(baseChip, locked ? lockedStyle : unlockedStyle)}
        title={locked
          ? `Staffed${deal.staffingLockedByName ? ` · locked by ${deal.staffingLockedByName}` : ""}${lockedDate ? ` · ${lockedDate}` : ""}`
          : "Unstaffed — awaiting Central CX lock"}
      >
        {locked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
        {locked ? "Staffed" : "Unstaffed"}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(!locked); }}
      className={cn(
        baseChip,
        locked ? lockedStyle : unlockedStyle,
        "hover:opacity-80 disabled:opacity-50 cursor-pointer",
      )}
      title={locked
        ? `Staffed${deal.staffingLockedByName ? ` · locked by ${deal.staffingLockedByName}` : ""}${lockedDate ? ` · ${lockedDate}` : ""} — click to unlock`
        : "Click to lock staffing (mark as Staffed)"}
    >
      {locked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
      {locked ? "Staffed" : "Unstaffed"}
    </button>
  );
}
