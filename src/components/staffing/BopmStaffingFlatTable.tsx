import { useMemo, useState } from "react";
import { Search, Plus, Trash2, RotateCcw, X, Send, Info } from "lucide-react";
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
}

const MONTH_HOURS = 160;

type DealDraft = {
  adds: StaffingAssignment[];
  updates: Record<string, Partial<StaffingAssignment>>;
  removes: Record<string, true>;
};

const emptyDraft = (): DealDraft => ({ adds: [], updates: {}, removes: {} });

const TEAM_PILL: Record<string, string> = {
  Operations:           "bg-blue-50 text-blue-900 border-blue-200",
  Content:              "bg-stone-50 text-stone-900 border-stone-200",
  "Content Strategy":   "bg-stone-50 text-stone-900 border-stone-200",
  SEO:                  "bg-emerald-50 text-emerald-900 border-emerald-200",
  "Performance & Growth":"bg-emerald-50 text-emerald-900 border-emerald-200",
  "Creative Strategy":  "bg-amber-50 text-amber-900 border-amber-200",
  "Creative Copy":      "bg-amber-50 text-amber-900 border-amber-200",
  "Creative Art":       "bg-amber-50 text-amber-900 border-amber-200",
  Video:                "bg-rose-50 text-rose-900 border-rose-200",
  Other:                "bg-secondary text-foreground border-border",
};

const teamPillCls = (cat?: string) => TEAM_PILL[cat || "Other"] || TEAM_PILL.Other;

/**
 * Flat tabular staffing view for BOPMs — one row per (deal × person).
 * Same staging + submit-to-Central-Cx flow as the grouped BopmStaffingTables.
 */
export function BopmStaffingFlatTable({ deals, people, allPeople, assignments }: Props) {
  const [search, setSearch] = useState("");
  const [addForDeal, setAddForDeal] = useState<string | null>(null);
  const [allocDraft, setAllocDraft] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, DealDraft>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [noteByDeal, setNoteByDeal] = useState<Record<string, string>>({});

  const allPersonById = useMemo(() => new Map(allPeople.map(p => [p.id, p])), [allPeople]);
  const dealById = useMemo(() => new Map(deals.map(d => [d.id, d])), [deals]);

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

  // Build flat row list: existing assignments (with draft updates / remove flags)
  // followed by any staged adds.
  type FlatRow = {
    kind: "existing" | "added";
    assignmentId: string;
    dealId: string;
    personId: string;
    roleKey: string;
    allocationPct: number;
    isMarkedRemove: boolean;
    isAdded: boolean;
    isUpdated: boolean;
  };

  const flatRows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = [];
    for (const d of deals) {
      const dDraft = drafts[d.id] || emptyDraft();
      const aList = assignments.filter(a => a.dealId === d.id);
      for (const a of aList) {
        const patch = dDraft.updates[a.id];
        out.push({
          kind: "existing",
          assignmentId: a.id,
          dealId: d.id,
          personId: patch?.personId ?? a.personId,
          roleKey: patch?.roleKey ?? a.roleKey,
          allocationPct: patch?.allocationPct ?? a.allocationPct,
          isMarkedRemove: !!dDraft.removes[a.id],
          isAdded: false,
          isUpdated: !!patch,
        });
      }
      for (const a of dDraft.adds) {
        out.push({
          kind: "added",
          assignmentId: a.id,
          dealId: d.id,
          personId: a.personId,
          roleKey: a.roleKey,
          allocationPct: a.allocationPct,
          isMarkedRemove: false,
          isAdded: true,
          isUpdated: false,
        });
      }
    }
    return out;
  }, [deals, assignments, drafts]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatRows;
    return flatRows.filter(r => {
      const d = dealById.get(r.dealId);
      const p = allPersonById.get(r.personId);
      const hay = `${d?.account || ""} ${d?.dealName || ""} ${d?.dealId || ""} ${p?.name || ""} ${p?.roleTitle || ""} ${p?.roleCategory || ""} ${r.roleKey || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [flatRows, search, dealById, allPersonById]);

  // Sort rows: by account → deal → team → person
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const da = dealById.get(a.dealId), db = dealById.get(b.dealId);
      const acA = (da?.account || "").localeCompare(db?.account || "");
      if (acA !== 0) return acA;
      const dnA = (da?.dealName || "").localeCompare(db?.dealName || "");
      if (dnA !== 0) return dnA;
      const pa = allPersonById.get(a.personId), pb = allPersonById.get(b.personId);
      const tA = (pa?.roleCategory || "").localeCompare(pb?.roleCategory || "");
      if (tA !== 0) return tA;
      return (pa?.name || "").localeCompare(pb?.name || "");
    });
  }, [filteredRows, dealById, allPersonById]);

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
    };
  }, [deals, assignments]);

  // Group sortedRows by dealId so we can render per-deal staging footers
  const dealsWithDrafts = Object.keys(drafts).filter(dId => draftCount(drafts[dId]) > 0);

  // Find first deal id without an existing assignment row (used by "Add person to a deal")
  const dealsForAdd = useMemo(() => deals.slice().sort((a, b) =>
    (a.account || "").localeCompare(b.account || "") || (a.dealName || "").localeCompare(b.dealName || "")
  ), [deals]);

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
          <span className="font-medium text-foreground">{sortedRows.length} rows</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Staffing — table view</h3>
            <p className="text-[11px] text-muted-foreground">
              One row per person. Edit allocation % or person inline; changes are sent to Central Cx for approval.
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
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left w-[180px]">Account</th>
                <th className="px-3 py-2 text-left w-[200px]">Deal</th>
                <th className="px-3 py-2 text-left w-[110px]">Team</th>
                <th className="px-3 py-2 text-left">Person</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-right w-[110px]">Allocation %</th>
                <th className="px-3 py-2 text-right w-[80px]">Hrs / wk</th>
                <th className="px-3 py-2 text-right w-[100px]">MRR</th>
                <th className="px-3 py-2 text-right w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  {search ? "No rows match your search." : "No staffing yet on your active deals."}
                </td></tr>
              )}
              {sortedRows.map((r, idx) => {
                const d = dealById.get(r.dealId);
                const p = allPersonById.get(r.personId);
                const draftKey = r.assignmentId;
                const draftVal = allocDraft[draftKey];
                const allocVal = draftVal !== undefined ? draftVal : String(r.allocationPct);
                const allocNum = Number(allocVal);
                const hrs = ((Number.isFinite(allocNum) ? allocNum : r.allocationPct) / 100) * MONTH_HOURS / 4.33;
                const teamCat = (p?.roleCategory || "Other") as RoleCategory;
                // people candidates: prefer same role category, then everyone
                const sameTeam = allPeople.filter(pp => pp.roleCategory === teamCat && !pp.leaving);
                const others = allPeople.filter(pp => pp.roleCategory !== teamCat && !pp.leaving);
                const prevRow = idx > 0 ? sortedRows[idx - 1] : null;
                const sameAccountAsPrev = prevRow && dealById.get(prevRow.dealId)?.account === d?.account;
                const sameDealAsPrev = prevRow && prevRow.dealId === r.dealId;
                return (
                  <tr
                    key={`${r.dealId}-${r.assignmentId}`}
                    className={cn(
                      "border-t border-border/50 hover:bg-secondary/10",
                      r.isMarkedRemove && "bg-rose-50/50",
                      r.isAdded && "bg-emerald-50/40",
                      r.isUpdated && !r.isMarkedRemove && "bg-amber-50/40",
                    )}
                  >
                    <td className="px-3 py-2 align-top">
                      {!sameAccountAsPrev ? (
                        <span className="font-medium text-foreground">{d?.account || "—"}</span>
                      ) : (
                        <span className="text-muted-foreground/40">"</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {!sameDealAsPrev ? (
                        <>
                          <div className="font-medium text-foreground truncate max-w-[200px]">{d?.dealName || "—"}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{d?.dealId}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/40">"</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", teamPillCls(teamCat))}>
                        {teamCat}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={r.personId}
                          disabled={r.isMarkedRemove}
                          onChange={e => {
                            const val = e.target.value;
                            if (val && val !== r.personId) stageUpdate(r.dealId, r.assignmentId, { personId: val });
                          }}
                          className={cn(
                            "h-7 px-2 rounded-md border border-border bg-background text-xs max-w-[200px]",
                            r.isMarkedRemove && "line-through opacity-60"
                          )}
                          title="Choose a different person"
                        >
                          <option value={r.personId}>{p?.name || "—"}{p?.tbh ? " (TBH)" : ""}</option>
                          <optgroup label={`Same team (${teamCat})`}>
                            {sameTeam.filter(pp => pp.id !== r.personId).slice(0, 80).map(pp => (
                              <option key={pp.id} value={pp.id}>{pp.name}{pp.tbh ? " (TBH)" : ""}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Other teams">
                            {others.slice(0, 80).map(pp => (
                              <option key={pp.id} value={pp.id}>{pp.name} · {pp.roleCategory}</option>
                            ))}
                          </optgroup>
                        </select>
                        {r.isAdded && <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1 py-0.5 bg-emerald-100 text-emerald-800">New</span>}
                        {r.isUpdated && !r.isMarkedRemove && <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1 py-0.5 bg-amber-100 text-amber-800">Edited</span>}
                        {r.isMarkedRemove && <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1 py-0.5 bg-rose-100 text-rose-800">Remove</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground align-top truncate max-w-[180px]">
                      {p?.roleTitle || r.roleKey || "—"}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        disabled={r.isMarkedRemove}
                        value={allocVal}
                        onChange={e => setAllocDraft(prev => ({ ...prev, [draftKey]: e.target.value }))}
                        onBlur={() => {
                          const n = Math.max(0, Math.min(100, Number(allocVal)));
                          if (Number.isFinite(n) && n !== r.allocationPct) {
                            stageUpdate(r.dealId, r.assignmentId, { allocationPct: n });
                          }
                          setAllocDraft(prev => { const next = { ...prev }; delete next[draftKey]; return next; });
                        }}
                        className="h-7 w-16 px-2 rounded-md border border-border bg-background text-right font-mono text-xs disabled:opacity-50"
                      />
                      <span className="ml-1 text-muted-foreground">%</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground align-top">{hrs.toFixed(1)}h</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground align-top whitespace-nowrap">
                      {!sameDealAsPrev ? formatINR(d?.mrr || 0) : <span className="text-muted-foreground/40">"</span>}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <div className="inline-flex items-center gap-1">
                        {r.isUpdated && !r.isMarkedRemove && (
                          <button
                            type="button"
                            onClick={() => unstageUpdate(r.dealId, r.assignmentId)}
                            title="Revert edits"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary/50"
                          ><RotateCcw className="h-3.5 w-3.5" /></button>
                        )}
                        {r.isMarkedRemove ? (
                          <button
                            type="button"
                            onClick={() => unstageRemove(r.dealId, r.assignmentId)}
                            title="Cancel removal"
                            className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-secondary/50"
                          ><X className="h-3 w-3" /> Undo</button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => stageRemove(r.dealId, r.assignmentId)}
                            title={r.isAdded ? "Remove from this request" : "Mark for removal"}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                          ><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
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