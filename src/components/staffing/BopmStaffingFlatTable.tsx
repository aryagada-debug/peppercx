import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Search, Plus, RotateCcw, X, Send, Info, Columns3, Check, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/csvTargets";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";
import { uid, ROLE_SLOTS, ROLE_TO_PEOPLE_FILTER, isAssignmentExpired } from "@/data/staffingData";
import { submitStaffingBatch, type BatchItem } from "@/lib/approvals";
import { AddStaffingMemberDialog } from "./AddStaffingMemberDialog";
import { BopmFilter, dealMatchesBopm } from "@/components/access/BopmFilter";
import { useAllPersonNames, dealCellMatchesPerson } from "@/hooks/useAppUsers";
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

// Per-slot designation keywords used for tier-2 (broader) candidate matching.
// People whose `designation` or `roleTitle` contains any of these tokens
// (case-insensitive) and who share the slot's roleCategory are surfaced as
// "Same role family" candidates even when their HRIS roleTitle doesn't
// exactly equal the canonical labels in ROLE_TO_PEOPLE_FILTER.
const ROLE_DESIGNATION_KEYWORDS: Record<string, string[]> = {
  vsd: ["vsd", "vertical", "head of"],
  principal_bopm: ["principal"],
  senior_bopm: ["senior bopm", "sr bopm", "sr. bopm"],
  bopm: ["bopm"],
  managing_editor: ["managing editor", "director - content", "director content", "associate director - content"],
  content_lead: ["content lead", "quality success"],
  senior_editor: ["senior editor", "sr editor", "sr. editor"],
  seo_leader: ["director", "avp", "head", "leader"],
  seo_group_head: ["group head", "growth lead"],
  sr_seo_manager: ["senior seo manager", "sr seo manager", "sr. seo manager", "senior manager"],
  seo_manager: ["seo manager", "business manager"],
  sr_seo_analyst: ["senior seo analyst", "sr seo analyst", "sr. seo analyst"],
  seo_analyst: ["analyst", "assistant manager"],
  strategy_cd: ["creative director - strategy", "cd - strategy", "creative director"],
  strategy_acd: ["associate creative director - strategy", "acd - strategy"],
  strategy_sr: ["strategist", "group head - strategy", "associate group head"],
  cd_copy: ["cd - copy", "creative director - copy", "group head copy"],
  acd_copy: ["acd - copy", "associate creative director - copy"],
  sr_copywriter: ["senior copywriter", "sr copywriter", "sr. copywriter"],
  jr_copywriter: ["copywriter"],
  sr_cd_art: ["senior creative director", "sr cd", "sr. cd", "creative director - design"],
  acd_art: ["acd - art", "associate creative director - design", "acd design"],
  art_director: ["art director", "director - design"],
  sr_designer: ["senior designer", "sr designer", "sr. designer"],
  jr_designer: ["designer"],
  production_head: ["production head", "head of production", "executive producer"],
  ad_video_pm: ["ad - video", "associate director - video", "creative producer"],
  video_pm: ["video pm", "acp", "producer"],
  video_editor_1: ["video editor", "editor"],
  video_editor_2: ["video editor", "editor"],
  influencer: ["influencer"],
  perf_growth: ["performance", "growth"],
};

type PersonGroups = { exact: Person[]; family: Person[]; other: Person[] };

/**
 * Tiered resolution of candidates for a role-slot column:
 *  - Tier 1 (exact): roleTitle matches the canonical filter.
 *  - Tier 2 (family): same roleCategory + designation/roleTitle hits a keyword.
 *  - Tier 3 (other): same roleCategory, rest.
 * Excludes leaving people. People appear in only one tier.
 */
function resolvePeopleForRole(rk: string, allPeople: Person[]): PersonGroups {
  const slotCat = ROLE_CATEGORY_OF(rk);
  const titles = new Set((ROLE_TO_PEOPLE_FILTER[rk] || []).map(t => t.toLowerCase()));
  const keywords = (ROLE_DESIGNATION_KEYWORDS[rk] || []).map(k => k.toLowerCase());
  const exact: Person[] = [];
  const family: Person[] = [];
  const other: Person[] = [];
  for (const p of allPeople) {
    if (p.leaving) continue;
    const rt = (p.roleTitle || "").toLowerCase();
    const dg = ((p as any).designation || "").toLowerCase();
    if (titles.has(rt)) { exact.push(p); continue; }
    const sameCat = (p.roleCategory || "") === slotCat;
    if (!sameCat) continue;
    const kw = keywords.length > 0 && keywords.some(k => rt.includes(k) || dg.includes(k));
    if (kw) family.push(p);
    else other.push(p);
  }
  return { exact, family, other };
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
  const [showOther, setShowOther] = useState(false);

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

  const totalCount = filteredGroups.exact.length + filteredGroups.family.length + filteredGroups.other.length;

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

  const SectionHeader = ({ label, count }: { label: string; count: number }) =>
    count === 0 ? null : (
      <div className="px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
        {label} <span className="opacity-60">· {count}</span>
      </div>
    );

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
            <>
              <SectionHeader label="Best match" count={filteredGroups.exact.length} />
              {filteredGroups.exact.map(renderRow)}
              <SectionHeader label="Same role family" count={filteredGroups.family.length} />
              {filteredGroups.family.map(renderRow)}
              {filteredGroups.other.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowOther(v => !v)}
                    className="w-full text-left px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-muted-foreground font-medium hover:text-foreground flex items-center gap-1"
                  >
                    <ChevronDown className={cn("h-3 w-3 transition-transform", showOther && "rotate-180")} />
                    Other team members <span className="opacity-60">· {filteredGroups.other.length}</span>
                  </button>
                  {showOther && filteredGroups.other.map(renderRow)}
                </>
              )}
            </>
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
        <span className="truncate">{rk}</span>
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
        <span className="text-foreground truncate">{rk}</span>
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
  enableBopmFilter, bopmFilterScopedVsd,
}: Props) {
  const [search, setSearch] = useState("");
  const [bopmFilter, setBopmFilter] = useState<string>("All");
  const allPersonNames = useAllPersonNames();
  const [addForDeal, setAddForDeal] = useState<string | null>(null);
  // Engagement-aware add: opens the full dialog scoped to a specific role/category.
  const [addCell, setAddCell] = useState<{ dealId: string; roleKey: string; category: string } | null>(null);
  // Engagement-aware change: opens the dialog in edit mode for an existing assignment.
  const [editEntry, setEditEntry] = useState<{
    dealId: string; assignmentId: string; roleKey: string;
    category: string; allocationPct: number;
  } | null>(null);
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
    if (directEdit && onUpdateAssignment) {
      onUpdateAssignment(assignmentId, patch);
      return;
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
      onAddAssignment(a);
      return;
    }
    const cur = getDraft(dealId);
    setDraft(dealId, { ...cur, adds: [...cur.adds, { ...a, id: a.id || uid() }] });
  };
  const stageRemove = (dealId: string, assignmentId: string) => {
    if (directEdit && onDeleteAssignment) {
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
      const aList = assignments.filter(a => a.dealId === d.id);
      for (const a of aList) {
        const patch = dDraft.updates[a.id];
        const effectiveEnd = (patch as any)?.endDate ?? a.endDate;
        const entry: CellEntry = {
          assignmentId: a.id,
          personId: patch?.personId ?? a.personId,
          allocationPct: patch?.allocationPct ?? a.allocationPct,
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
      // Synthesise read-only "virtual" entries for the BOPM-tier columns from
      // the deal sheet text. The sheet (principal_bopm / senior_bopm / bopm)
      // is the source of truth for *who* is on a deal; staffing_assignments
      // for those role keys are an override layer for explicit allocations.
      // We only inject a virtual entry when no real assignment for the same
      // (roleKey, personId) already exists, so admins who *do* explicitly
      // staff a BOPM with a % continue to see their entry untouched.
      const virtualBopmFields: Array<{ roleKey: string; cell: string | undefined }> = [
        { roleKey: "principal_bopm", cell: d.principalBopm },
        { roleKey: "senior_bopm",    cell: d.seniorBopm },
        { roleKey: "bopm",           cell: d.bopm },
      ];
      for (const { roleKey, cell } of virtualBopmFields) {
        const text = (cell || "").trim();
        if (!text) continue;
        const existing = byRole.get(roleKey) || [];
        const tokens = text.split(/[,;/]|\band\b|&/i).map(s => s.trim()).filter(Boolean);
        const seenPids = new Set<string>(existing.map(en => en.personId));
        const list = existing.slice();
        for (const tok of tokens) {
          // Try to resolve the cell text to a Person via the same
          // unambiguous matcher we use for access scoping.
          const candidates = allPeople.filter(pp =>
            !pp.leaving && dealCellMatchesPerson(tok, pp.name, allPersonNames)
          );
          if (candidates.length === 1) {
            const pp = candidates[0];
            if (seenPids.has(pp.id)) continue;
            seenPids.add(pp.id);
            list.push({
              assignmentId: `virtual:${d.id}:${roleKey}:${pp.id}`,
              personId: pp.id,
              allocationPct: 0,
              isAdded: false,
              isUpdated: false,
              isMarkedRemove: false,
              isVirtual: true,
            });
          } else {
            // Either ambiguous or no profile — render the raw text as a
            // muted chip so the user can see who is named on the sheet.
            list.push({
              assignmentId: `virtual:${d.id}:${roleKey}:raw:${tok}`,
              personId: "",
              allocationPct: 0,
              isAdded: false,
              isUpdated: false,
              isMarkedRemove: false,
              isVirtual: true,
              rawText: tok,
            });
          }
        }
        if (list.length > 0) byRole.set(roleKey, list);
      }
      out.set(d.id, byRole);
    }
    return out;
  }, [deals, assignments, drafts, allPeople, allPersonNames]);

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
    const bopmFiltered = bopmFilter && bopmFilter !== "All"
      ? sorted.filter(d => dealMatchesBopm(d as any, bopmFilter, allPersonNames))
      : sorted;
    if (!q) return bopmFiltered;
    return bopmFiltered.filter(d => {
      const byRole = dealRoleMap.get(d.id);
      const personHay = byRole ? Array.from(byRole.values()).flat()
        .map(e => allPersonById.get(e.personId)?.name || "").join(" ").toLowerCase() : "";
      const hay = `${d.account} ${d.dealName} ${d.dealId} ${personHay}`.toLowerCase();
      return hay.includes(q);
    });
  }, [deals, search, bopmFilter, dealRoleMap, allPersonById, allPersonNames]);

  // Aggregate top stats
  const totals = useMemo(() => {
    const uniquePeople = new Set<string>();
    let allocSum = 0;
    const activeAssignments = assignments.filter(a => !isAssignmentExpired(a));
    activeAssignments.forEach(a => uniquePeople.add(a.personId));
    uniquePeople.forEach(pid => {
      allocSum += activeAssignments.filter(a => a.personId === pid).reduce((s, a) => s + a.allocationPct, 0);
    });
    return {
      dealCount: deals.length,
      peopleCount: uniquePeople.size,
      avgUtilPct: uniquePeople.size > 0 ? Math.round(allocSum / uniquePeople.size) : 0,
      assignmentCount: activeAssignments.length,
    };
  }, [deals, assignments]);

  const dealsWithDrafts = Object.keys(drafts).filter(dId => draftCount(drafts[dId]) > 0);

  const dealsForAdd = useMemo(() => deals.slice().sort((a, b) =>
    (a.account || "").localeCompare(b.account || "") || (a.dealName || "").localeCompare(b.dealName || "")
  ), [deals]);

  // ── Render a single cell entry (one staffed person under a deal+role) ────
  const renderEntry = (deal: Deal, roleKey: string, e: CellEntry) => {
    const p = allPersonById.get(e.personId);
    // Virtual entries are sourced from the deal sheet (principal_bopm /
    // senior_bopm / bopm cells). Render them as read-only chips so identity
    // stays in sync app-wide without offering edit affordances that would
    // need to round-trip back to staffing_deals.
    if (e.isVirtual) {
      const label = e.rawText
        ? e.rawText
        : `${p?.name || "—"}${p?.tbh ? " (TBH)" : ""}`;
      const tooltip = e.rawText
        ? "Tagged on the deal sheet but no matching profile in People — update Settings → People or the deal record to align."
        : "From the deal sheet (Principal/Senior BOPM). Edit the deal to change.";
      return (
        <div
          key={e.assignmentId}
          className={cn(
            "rounded-md border px-1.5 py-1 transition-colors",
            e.rawText
              ? "bg-muted/40 border-dashed border-muted-foreground/30"
              : "bg-violet-50/50 border-violet-200/70"
          )}
          title={tooltip}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex-1 min-w-0 truncate px-1 py-0.5 text-[11px] font-medium",
                e.rawText ? "text-muted-foreground italic" : "text-foreground"
              )}
            >
              {label}
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-mono select-none">—</span>
          </div>
        </div>
      );
    }
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
    // Tiered candidate resolution. Manager constraint is a soft sort, applied
    // by the picker, so users always see the full team and never hit a
    // "0 candidates" dead-end caused by a strict reportingManager filter.
    const colGroups = resolvePeopleForRole(roleKey, allPeople);

    const draftKey = e.assignmentId;
    const draftVal = allocDraft[draftKey];
    const allocVal = draftVal !== undefined ? draftVal : String(e.allocationPct);
    const allocNum = Number(allocVal);
    const hrs = ((Number.isFinite(allocNum) ? allocNum : e.allocationPct) / 100) * MONTH_HOURS / 4.33;

    return (
      <div
        key={e.assignmentId}
        className={cn(
          "group/entry rounded-md border px-1.5 py-1 transition-colors shadow-[0_1px_0_rgba(0,0,0,0.02)]",
          e.isMarkedRemove ? "bg-rose-50/80 border-rose-200" :
          e.isAdded ? "bg-emerald-50/80 border-emerald-200" :
          e.isUpdated ? "bg-amber-50/80 border-amber-200" :
          "bg-white/85 border-border/70 hover:border-border",
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
            className="h-5 w-9 px-1 rounded border border-border/60 bg-background/70 text-right font-mono text-[10px] disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            title={`${hrs.toFixed(1)} h/wk`}
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
              <BopmFilter
                value={bopmFilter}
                onChange={setBopmFilter}
                scopedVsd={bopmFilterScopedVsd ?? undefined}
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
        </header>

        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: "100%", tableLayout: "fixed" }}>
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left w-[220px] sticky left-0 bg-secondary/60 z-10 border-r border-border">Account · Deal</th>
                <th className="px-3 py-2 text-right w-[90px] border-r border-border">MRR</th>
                {visibleRoleKeys.length === 0 ? (
                  <th className="px-3 py-2 text-left text-muted-foreground/60">No roles staffed yet</th>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleColumnDragEnd}
                  >
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
                  </DndContext>
                )}
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
                      const groupsAll = resolvePeopleForRole(rk, allPeople);
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
                                "w-full flex items-center justify-between gap-1 px-1.5 py-1 text-[10.5px] italic rounded-md border border-dashed transition-colors",
                                pickerTotal === 0
                                  ? "text-muted-foreground/50 border-border/30 cursor-not-allowed"
                                  : "text-muted-foreground border-border/50 hover:text-foreground hover:border-border hover:bg-secondary/40"
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

      {addCell && (
        <AddStaffingMemberDialog
          open={!!addCell}
          onOpenChange={v => { if (!v) setAddCell(null); }}
          people={allPeople}
          assignments={assignments}
          deals={deals}
          dealId={addCell.dealId}
          initialCategory={addCell.category as RoleCategory}
          initialRoleKey={addCell.roleKey}
          onAdd={(assignment) => {
            stageAdd(addCell.dealId, { ...assignment, roleKey: addCell.roleKey });
            setAddCell(null);
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
    </section>
  );
}
