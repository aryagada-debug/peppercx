import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, Plus, Trash2, Info, Send, RotateCcw, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/csvTargets";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";
import { uid } from "@/data/staffingData";
import { submitStaffingBatch, type BatchItem } from "@/lib/approvals";
import { AddStaffingMemberDialog } from "./AddStaffingMemberDialog";

interface Props {
  deals: Deal[];
  people: Person[];
  allPeople: Person[];
  assignments: StaffingAssignment[];
  onAddAssignment: (a: StaffingAssignment) => void;
  onUpdateAssignment: (id: string, updates: Partial<StaffingAssignment>) => void;
  onDeleteAssignment: (id: string) => void;
}

// Group people on a deal by their team capability (role category).
const TEAM_ORDER: RoleCategory[] = [
  "Operations",
  "Content Strategy",
  "Content",
  "SEO",
  "Creative Strategy",
  "Creative Copy",
  "Creative Art",
  "Video",
  "Performance & Growth",
  "Other",
];

// Display group → which RoleCategories belong, color, and short label/sub-label
type DisplayGroup = {
  key: string;
  label: string;          // e.g. "OPS"
  longLabel: string;      // e.g. "Ops"
  sub: string;            // e.g. "VSD · BOPM"
  cats: RoleCategory[];
  dotClass: string;       // tailwind bg for legend dot
  pillBg: string;         // tailwind bg for chip
  pillText: string;       // tailwind text colour for chip
  initialBg: string;      // bg for initials bubble
};

const DISPLAY_GROUPS: DisplayGroup[] = [
  { key: "ops",      label: "OPS",      longLabel: "Ops",      sub: "VSD · BOPM",
    cats: ["Operations"],
    dotClass: "bg-blue-500",
    pillBg: "bg-blue-50 border border-blue-200",
    pillText: "text-blue-900",
    initialBg: "bg-white border border-blue-200 text-blue-900" },
  { key: "content",  label: "CONTENT",  longLabel: "Content",  sub: "Editors · Leads",
    cats: ["Content", "Content Strategy"],
    dotClass: "bg-stone-700",
    pillBg: "bg-stone-50 border border-stone-200",
    pillText: "text-stone-900",
    initialBg: "bg-white border border-stone-300 text-stone-900" },
  { key: "seo",      label: "SEO",      longLabel: "SEO",      sub: "Leader · Growth · Ops",
    cats: ["SEO", "Performance & Growth"],
    dotClass: "bg-emerald-600",
    pillBg: "bg-emerald-50 border border-emerald-200",
    pillText: "text-emerald-900",
    initialBg: "bg-white border border-emerald-200 text-emerald-900" },
  { key: "creative", label: "CREATIVE", longLabel: "Creative", sub: "Strategy · Copy · Art",
    cats: ["Creative Strategy", "Creative Copy", "Creative Art"],
    dotClass: "bg-amber-600",
    pillBg: "bg-amber-50 border border-amber-200",
    pillText: "text-amber-900",
    initialBg: "bg-white border border-amber-200 text-amber-900" },
  { key: "production", label: "PRODUCTION", longLabel: "Production", sub: "Video · Influencer",
    cats: ["Video"],
    dotClass: "bg-rose-700",
    pillBg: "bg-rose-50 border border-rose-200",
    pillText: "text-rose-900",
    initialBg: "bg-white border border-rose-200 text-rose-900" },
];

const groupForCategory = (cat: RoleCategory): DisplayGroup => {
  return DISPLAY_GROUPS.find(g => g.cats.includes(cat)) || DISPLAY_GROUPS[0];
};

// One letter initial for a person (handles multi-word names)
const personInitial = (name: string): string => {
  const parts = (name || "?").trim().split(/\s+/);
  return (parts[0]?.[0] || "?").toUpperCase();
};

const MONTH_HOURS = 160;

type DealDraft = {
  adds: StaffingAssignment[];                         // newly proposed people
  updates: Record<string, Partial<StaffingAssignment>>; // assignmentId → patch
  removes: Record<string, true>;                       // assignmentId → mark for removal
};

const emptyDraft = (): DealDraft => ({ adds: [], updates: {}, removes: {} });

export function BopmStaffingTables({ deals, people, allPeople, assignments, onAddAssignment, onUpdateAssignment, onDeleteAssignment }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [addForDeal, setAddForDeal] = useState<string | null>(null);
  const [allocDraft, setAllocDraft] = useState<Record<string, string>>({});
  const personById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const allPersonById = useMemo(() => new Map(allPeople.map(p => [p.id, p])), [allPeople]);
  // Per-deal staged change set. Submitted as a single batch of sub-requests.
  const [drafts, setDrafts] = useState<Record<string, DealDraft>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [noteByDeal, setNoteByDeal] = useState<Record<string, string>>({});

  const getDraft = (dealId: string): DealDraft => drafts[dealId] || emptyDraft();
  const setDraft = (dealId: string, next: DealDraft) =>
    setDrafts(prev => ({ ...prev, [dealId]: next }));
  const draftCount = (d: DealDraft) =>
    d.adds.length + Object.keys(d.updates).length + Object.keys(d.removes).length;

  const stageAdd = (dealId: string, a: StaffingAssignment) => {
    const cur = getDraft(dealId);
    setDraft(dealId, { ...cur, adds: [...cur.adds, { ...a, id: a.id || uid() }] });
  };
  const stageUpdate = (dealId: string, assignmentId: string, patch: Partial<StaffingAssignment>) => {
    const cur = getDraft(dealId);
    // If this is a draft-add row (id starts with id_), apply the patch directly to the staged add.
    const addIdx = cur.adds.findIndex(a => a.id === assignmentId);
    if (addIdx >= 0) {
      const nextAdds = cur.adds.slice();
      nextAdds[addIdx] = { ...nextAdds[addIdx], ...patch };
      setDraft(dealId, { ...cur, adds: nextAdds });
      return;
    }
    setDraft(dealId, { ...cur, updates: { ...cur.updates, [assignmentId]: { ...(cur.updates[assignmentId] || {}), ...patch } } });
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
    setDrafts(prev => {
      const { [dealId]: _, ...rest } = prev; return rest;
    });
    setNoteByDeal(prev => {
      const { [dealId]: _, ...rest } = prev; return rest;
    });
  };

  const submitDraft = async (deal: Deal) => {
    const d = getDraft(deal.id);
    const items: BatchItem[] = [];
    for (const a of d.adds) {
      items.push({
        type: "staffing.add",
        dealId: deal.id,
        targetId: a.id,
        payload: a,
      });
    }
    for (const [assignmentId, patch] of Object.entries(d.updates)) {
      const current = assignments.find(x => x.id === assignmentId);
      items.push({
        type: "staffing.update",
        dealId: deal.id,
        targetId: assignmentId,
        previous: current || {},
        payload: { id: assignmentId, ...patch },
      });
    }
    for (const assignmentId of Object.keys(d.removes)) {
      const current = assignments.find(x => x.id === assignmentId);
      items.push({
        type: "staffing.remove",
        dealId: deal.id,
        targetId: assignmentId,
        previous: current || {},
        payload: { id: assignmentId },
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

  const assignmentsByDeal = useMemo(() => {
    const m = new Map<string, StaffingAssignment[]>();
    for (const a of assignments) {
      if (!m.has(a.dealId)) m.set(a.dealId, []);
      m.get(a.dealId)!.push(a);
    }
    return m;
  }, [assignments]);

  // Per-account aggregate: unique people across all deals + average utilization
  const accountStats = useMemo(() => {
    const byAccount = new Map<string, { dealIds: Set<string>; people: Map<string, number> }>();
    for (const d of deals) {
      const acct = d.account || "—";
      if (!byAccount.has(acct)) byAccount.set(acct, { dealIds: new Set(), people: new Map() });
      const entry = byAccount.get(acct)!;
      entry.dealIds.add(d.id);
      const aList = assignmentsByDeal.get(d.id) || [];
      for (const a of aList) {
        entry.people.set(a.personId, (entry.people.get(a.personId) || 0) + a.allocationPct);
      }
    }
    const map = new Map<string, { peopleCount: number; avgUtilPct: number }>();
    byAccount.forEach((v, k) => {
      const peopleCount = v.people.size;
      const totalAlloc = Array.from(v.people.values()).reduce((s, n) => s + n, 0);
      const avgUtilPct = peopleCount > 0 ? Math.round(totalAlloc / peopleCount) : 0;
      map.set(k, { peopleCount, avgUtilPct });
    });
    return map;
  }, [deals, assignmentsByDeal]);

  // Top-level totals for the header
  const totals = useMemo(() => {
    const uniquePeople = new Set<string>();
    let allocSum = 0;
    let allocCount = 0;
    assignments.forEach(a => {
      uniquePeople.add(a.personId);
    });
    uniquePeople.forEach(pid => {
      const sum = assignments
        .filter(a => a.personId === pid)
        .reduce((s, a) => s + a.allocationPct, 0);
      allocSum += sum;
      allocCount += 1;
    });
    return {
      dealCount: deals.length,
      peopleCount: uniquePeople.size,
      avgUtilPct: allocCount > 0 ? Math.round(allocSum / allocCount) : 0,
    };
  }, [deals, assignments]);

  // Build a per-deal "teams summary" string for the collapsed row, e.g. "SEO 3 · Content 2 · Ops 1"
  const dealTeamSummary = (dealId: string) => {
    const aList = assignmentsByDeal.get(dealId) || [];
    const counts = new Map<string, number>();
    for (const a of aList) {
      const p = personById.get(a.personId);
      if (!p) continue;
      const cat = p.roleCategory || "Other";
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `${cat} ${n}`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter(d =>
      (d.account || "").toLowerCase().includes(q) ||
      (d.dealName || "").toLowerCase().includes(q) ||
      (d.dealId || "").toLowerCase().includes(q)
    );
  }, [deals, search]);

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
  };

  return (
    <section className="space-y-3">
      {/* Header summary line */}
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{totals.dealCount} deals</span>
            <span className="mx-1.5">·</span>
            <span className="font-medium text-foreground">{totals.peopleCount} people</span>
            <span className="mx-1.5">·</span>
            <span className="font-medium text-foreground">{totals.avgUtilPct}% avg utilization</span>
          </p>
        </div>
      </div>

      {/* Teams legend */}
      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Teams</span>
        {DISPLAY_GROUPS.map(g => (
          <span key={g.key} className="inline-flex items-center gap-1.5 text-[11px]">
            <span className={cn("h-1.5 w-1.5 rounded-full", g.dotClass)} />
            <span className="font-medium text-foreground">{g.longLabel}</span>
            <span className="text-muted-foreground">{g.sub}</span>
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Inner header: title + search */}
        <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Your deals & staffing</h3>
            <p className="text-[11px] text-muted-foreground">Hover any team chip to see individual allocations and roles</p>
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
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left w-[200px]">Account</th>
                <th className="px-4 py-2 text-left">Deal & Staffing</th>
                <th className="px-4 py-2 text-right w-[100px]">MRR</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const aList = assignmentsByDeal.get(d.id) || [];
                const isOpen = open.has(d.id);

                // Group assignments by display group → list of {person, alloc}
                const byGroup = new Map<string, { person: Person | undefined; alloc: number }[]>();
                for (const a of aList) {
                  const p = personById.get(a.personId);
                  const cat = (p?.roleCategory || "Other") as RoleCategory;
                  const g = groupForCategory(cat);
                  if (!byGroup.has(g.key)) byGroup.set(g.key, []);
                  byGroup.get(g.key)!.push({ person: p, alloc: a.allocationPct });
                }

                const acctStats = accountStats.get(d.account || "—") || { peopleCount: 0, avgUtilPct: 0 };
                const isOverUtilised = acctStats.avgUtilPct > 100;

                // Detailed per-team data for expanded view (re-using existing logic)
                const byTeam = new Map<string, StaffingAssignment[]>();
                for (const a of aList) {
                  const p = personById.get(a.personId);
                  const cat = (p?.roleCategory || "Other") as string;
                  if (!byTeam.has(cat)) byTeam.set(cat, []);
                  byTeam.get(cat)!.push(a);
                }
                const orderedTeams = TEAM_ORDER.filter(t => byTeam.has(t))
                  .concat(Array.from(byTeam.keys()).filter(k => !TEAM_ORDER.includes(k as RoleCategory)) as RoleCategory[]);

                return (
                  <>
                    <tr
                      key={d.id}
                      className={cn(
                        "border-t border-border hover:bg-secondary/20 cursor-pointer transition-colors group",
                        isOpen && "bg-secondary/20"
                      )}
                      onClick={() => toggle(d.id)}
                    >
                      {/* Account: name + people · util% */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-medium text-foreground leading-tight">{d.account || "—"}</div>
                            <div className={cn(
                              "text-[11px] mt-0.5",
                              isOverUtilised ? "text-rose-600" : "text-muted-foreground"
                            )}>
                              {acctStats.peopleCount} people · {acctStats.avgUtilPct}%
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label={isOpen ? "Collapse" : "Expand"}
                            className={cn(
                              "shrink-0 h-6 w-6 rounded-full border border-border bg-background flex items-center justify-center text-muted-foreground transition-opacity",
                              isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                          >
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Deal name + chips */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-[14px] font-medium text-foreground">{d.dealName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{d.dealId}</span>
                        </div>
                        {aList.length === 0 ? (
                          <span className="text-xs italic text-muted-foreground">No team staffed</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {DISPLAY_GROUPS.map(g => {
                              const rows = byGroup.get(g.key);
                              if (!rows || rows.length === 0) return null;
                              const totalAlloc = rows.reduce((s, r) => s + r.alloc, 0);
                              const peopleN = rows.length;
                              return (
                                <span
                                  key={g.key}
                                  className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]", g.pillBg, g.pillText)}
                                  title={rows.map(r => `${r.person?.name || "?"} ${r.alloc}%`).join(" · ")}
                                >
                                  <span className="font-medium tracking-wide">{g.label}</span>
                                  <span className="inline-flex items-center gap-0.5">
                                    {rows.slice(0, 4).map((r, i) => (
                                      <span
                                        key={i}
                                        className={cn(
                                          "inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-medium",
                                          g.initialBg
                                        )}
                                      >
                                        {personInitial(r.person?.name || "?")}
                                      </span>
                                    ))}
                                    {rows.length > 4 && (
                                      <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded text-[9px] font-medium bg-rose-600 text-white">
                                        +{rows.length - 4}
                                      </span>
                                    )}
                                  </span>
                                  <span className="opacity-70">{peopleN}p · {totalAlloc}%</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* MRR */}
                      <td className="px-4 py-3 text-right font-mono text-[14px] text-foreground align-top whitespace-nowrap">
                        {formatINR(d.mrr || 0)}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr key={`${d.id}-x`}>
                        <td colSpan={3} className="bg-secondary/10 border-t border-border/50 px-6 py-4">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Info className="h-3 w-3" />
                              Edits go to Central Cx for approval. Track them in <span className="font-medium text-foreground">My change requests</span> above.
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAddForDeal(d.id); }}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-card hover:bg-secondary/40 text-[11px] font-medium text-foreground"
                            >
                              <Plus className="h-3 w-3" /> Request to add staff
                            </button>
                          </div>
                          {aList.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No one staffed on this deal yet.</p>
                          ) : (
                            <div className="rounded-lg border border-border bg-card overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 text-left w-[140px]">Team</th>
                                    <th className="px-3 py-2 text-left">Person</th>
                                    <th className="px-3 py-2 text-left">Role</th>
                                    <th className="px-3 py-2 text-right w-[120px]">Allocation %</th>
                                    <th className="px-3 py-2 text-right w-[90px]">Hrs / wk</th>
                                    <th className="px-3 py-2 text-right w-[60px]"></th>
                                  </tr>
                                </thead>
                                <tbody onClick={(e) => e.stopPropagation()}>
                                  {orderedTeams.map(team => {
                                    const rows = byTeam.get(team) || [];
                                    return rows.map((a, idx) => {
                                      const p = personById.get(a.personId);
                                      const draftKey = a.id;
                                      const draftVal = allocDraft[draftKey];
                                      const allocVal = draftVal !== undefined ? draftVal : String(a.allocationPct);
                                      const allocNum = Number(allocVal);
                                      const hrs = ((Number.isFinite(allocNum) ? allocNum : a.allocationPct) / 100) * MONTH_HOURS / 4.33;
                                      const sameTeamPeople = allPeople.filter(pp => groupForCategory(pp.roleCategory as RoleCategory).key === groupForCategory((p?.roleCategory || "Other") as RoleCategory).key);
                                      return (
                                        <tr key={a.id} className="border-t border-border/50">
                                          <td className="px-3 py-1.5 text-muted-foreground">
                                            {idx === 0 ? <span className="font-medium text-foreground">{team}</span> : ""}
                                          </td>
                                          <td className="px-3 py-1.5 text-foreground">
                                            <select
                                              value={a.personId}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (val && val !== a.personId) onUpdateAssignment(a.id, { personId: val });
                                              }}
                                              className="h-7 px-2 rounded-md border border-border bg-background text-xs max-w-[220px]"
                                              title="Request a different person"
                                            >
                                              <option value={a.personId}>{p?.name || "—"}{p?.tbh ? " (TBH)" : ""}</option>
                                              {sameTeamPeople
                                                .filter(pp => pp.id !== a.personId && !pp.leaving)
                                                .slice(0, 100)
                                                .map(pp => (
                                                  <option key={pp.id} value={pp.id}>
                                                    {pp.name}{pp.tbh ? " (TBH)" : ""}
                                                  </option>
                                                ))}
                                            </select>
                                            {p?.leaving && <span className="ml-1 text-[10px] text-rose-600">(Leaving)</span>}
                                          </td>
                                          <td className="px-3 py-1.5 text-muted-foreground">
                                            {p?.roleTitle || a.roleKey}
                                          </td>
                                          <td className="px-3 py-1.5 text-right">
                                            <input
                                              type="number"
                                              min={0}
                                              max={100}
                                              step={1}
                                              value={allocVal}
                                              onChange={(e) => setAllocDraft(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                              onBlur={() => {
                                                const n = Math.max(0, Math.min(100, Number(allocVal)));
                                                if (Number.isFinite(n) && n !== a.allocationPct) {
                                                  onUpdateAssignment(a.id, { allocationPct: n });
                                                }
                                                setAllocDraft(prev => {
                                                  const next = { ...prev };
                                                  delete next[draftKey];
                                                  return next;
                                                });
                                              }}
                                              className="h-7 w-20 px-2 rounded-md border border-border bg-background text-right font-mono text-xs"
                                            />
                                            <span className="ml-1 text-muted-foreground">%</span>
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                            {hrs.toFixed(1)}h
                                          </td>
                                          <td className="px-3 py-1.5 text-right">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (confirm(`Request to remove ${p?.name || "this person"} from ${d.dealName}?`)) {
                                                  onDeleteAssignment(a.id);
                                                }
                                              }}
                                              title="Request removal"
                                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground text-xs">No deals match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addForDeal && (
        <AddStaffingMemberDialog
          open={!!addForDeal}
          onOpenChange={(v) => { if (!v) setAddForDeal(null); }}
          people={allPeople}
          assignments={assignments}
          deals={deals}
          dealId={addForDeal}
          onAdd={(assignment) => {
            onAddAssignment(assignment);
            setAddForDeal(null);
          }}
        />
      )}
    </section>
  );
}
