/**
 * Per-deal staffing block, lifted from `DealDetail.tsx` Staffing tab.
 * Used both inside the deal detail page (eventually) and as the building
 * block for `StaffingDealsList` on the Staffing & Capacity module's
 * default "Staffing" tab.
 *
 * Groups team members by **Department** (Delivery Ops & CS first), then
 * renders the same KPI strip + per-row table the deal page already uses.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Check, X, Trash2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Deal, Person, StaffingAssignment } from "@/data/staffingData";
import { DEPARTMENT_LABELS, ROLE_TYPE_TO_DEPT } from "@/data/staffingData";
import { AddStaffingMemberDialog } from "./AddStaffingMemberDialog";
import { RequestStaffingDialog } from "./RequestStaffingDialog";
import { useTaxonomyQuery } from "@/hooks/queries/useTaxonomyQuery";
import { resolvePersonDepartmentId } from "@/lib/peopleGrouping";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/currency";
import { dealDisplayCurrency } from "@/lib/dealCurrency";

interface Props {
  deal: Deal;
  people: Person[];        // full roster, for the Add dialog
  assignments: StaffingAssignment[]; // all assignments (filtered to this deal internally)
  isAdmin: boolean;
  defaultOpen?: boolean;
  onAddAssignment: (a: StaffingAssignment) => void;
  onUpdateAssignment: (id: string, patch: Partial<StaffingAssignment>) => void;
  onDeleteAssignment: (id: string) => void;
  onUpdatePerson?: (id: string, patch: Partial<Person>) => void;
  /** All deals — needed by AddStaffingMemberDialog. */
  deals: Deal[];
}

/** Default visual order: Delivery Ops & CS first, then capabilities. */
const DEPT_ORDER: string[] = [
  "dept_delivery_ops_and_cs",
  "dept_content_capability",
  "dept_seo_capability",
  "dept_capability_creative_strategy_team",
  "dept_creative_capability_copy",
  "dept_creative_capability_design",
  "dept_creative_capability_video",
];

// Department tint palette — kept in sync with the Sheet view's
// CATEGORY_STYLES so the same team reads with the same hue across surfaces.
const DEPT_STYLE: Record<string, { head: string; cell: string; dot: string }> = {
  dept_delivery_ops_and_cs:               { head: "bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/30",   cell: "bg-violet-500/[0.04]",  dot: "bg-violet-500" },
  dept_content_capability:                { head: "bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/30",           cell: "bg-teal-500/[0.04]",    dot: "bg-teal-500" },
  dept_seo_capability:                    { head: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30", cell: "bg-emerald-500/[0.04]", dot: "bg-emerald-500" },
  dept_capability_creative_strategy_team: { head: "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200 border-fuchsia-500/30", cell: "bg-fuchsia-500/[0.04]", dot: "bg-fuchsia-500" },
  dept_creative_capability_copy:          { head: "bg-pink-500/15 text-pink-800 dark:text-pink-200 border-pink-500/30",           cell: "bg-pink-500/[0.04]",    dot: "bg-pink-500" },
  dept_creative_capability_design:        { head: "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30",           cell: "bg-rose-500/[0.04]",    dot: "bg-rose-500" },
  dept_creative_capability_video:         { head: "bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/30",   cell: "bg-orange-500/[0.04]",  dot: "bg-orange-500" },
};
const DEPT_STYLE_FALLBACK = { head: "bg-slate-500/15 text-slate-800 dark:text-slate-200 border-slate-500/30", cell: "bg-slate-500/[0.04]", dot: "bg-slate-500" };

export function DealStaffingCard({
  deal, people, assignments, deals, isAdmin, defaultOpen = true,
  onAddAssignment, onUpdateAssignment, onDeleteAssignment, onUpdatePerson,
}: Props) {
  const { data: taxonomy } = useTaxonomyQuery();
  const { currency, fxRate } = useCurrency();
  const dealCurrency = useMemo(() => dealDisplayCurrency(deal ?? null, currency), [deal, currency]);
  const currencySymbol = CURRENCY_SYMBOL[dealCurrency];
  const fmtCurrency = (n: number | undefined) =>
    formatMoney(Number(n) || 0, dealCurrency, { compact: true }, fxRate);

  const [open, setOpen] = useState(defaultOpen);
  const [addOpen, setAddOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState<string | null>(null);
  const [editAllocValue, setEditAllocValue] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const dealAssignments = useMemo(() => {
    // Show all current assignments for this deal. We intentionally do NOT
    // drop rows where `endDate < today` — Sheet view doesn't, and many deals
    // inherit a stale contract end date from the parent deal record, which
    // would otherwise hide just-added members on still-active deals.
    return assignments.filter(a => a.dealId === deal.id);
  }, [assignments, deal.id]);

  const dealPeople = useMemo(() => {
    const ids = new Set(dealAssignments.map(a => a.personId));
    return people.filter(p => ids.has(p.id));
  }, [dealAssignments, people]);

  // Group by department
  const grouped = useMemo(() => {
    if (!dealPeople.length) return [] as { deptId: string; deptName: string; members: Person[] }[];
    const buckets = new Map<string, Person[]>();
    for (const p of dealPeople) {
      const dId = resolvePersonDepartmentId(p, taxonomy) || "__unassigned__";
      if (!buckets.has(dId)) buckets.set(dId, []);
      buckets.get(dId)!.push(p);
    }
    const present = Array.from(buckets.keys());
    const ordered: string[] = [
      ...DEPT_ORDER.filter(d => present.includes(d)),
      ...present.filter(d => !DEPT_ORDER.includes(d) && d !== "__unassigned__"),
      ...(present.includes("__unassigned__") ? ["__unassigned__"] : []),
    ];
    return ordered.map(dId => ({
      deptId: dId,
      deptName: dId === "__unassigned__" ? "Unassigned" : (DEPARTMENT_LABELS[dId] || dId),
      members: buckets.get(dId)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [dealPeople, taxonomy]);

  // KPI totals
  const totals = useMemo(() => {
    const dealMrr = deal.mrr || 0;
    let totalCostWeek = 0, totalHrsWeek = 0, totalRevManaged = 0;
    for (const p of dealPeople) {
      const a = dealAssignments.find(x => x.personId === p.id);
      const pct = (a?.allocationPct || 0) / 100;
      const hrs = pct * 40;
      totalHrsWeek += hrs;
      totalCostWeek += hrs * (p.hourlyRate || 0);
      totalRevManaged += dealMrr * pct;
    }
    return { totalCostWeek, totalHrsWeek, totalRevManaged };
  }, [dealPeople, dealAssignments, deal.mrr]);

  const handleSaveAlloc = (assignmentId: string) => {
    const pct = Math.round((editAllocValue / 40) * 100);
    onUpdateAssignment(assignmentId, { allocationPct: pct });
    setEditingAlloc(null);
    toast.success("Hours updated");
  };

  return (
    <div className={cn(
      "bg-card border border-border rounded-xl overflow-hidden transition-all",
      open && "border-l-4 border-l-primary ring-1 ring-primary/15 shadow-sm",
    )}>
      {/* ── Card header ───────────────────────────────────────────── */}
      <div className={cn(
        "px-4 py-3 border-b border-border flex items-center justify-between gap-3",
        open ? "bg-primary/5" : "bg-secondary/30",
      )}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-left min-w-0 flex-1"
        >
          {open ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {deal.account || deal.dealName || deal.id}
              {deal.dealName && deal.account && (
                <span className="ml-2 text-muted-foreground font-normal">— {deal.dealName}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {[
                deal.dealId ? `ID ${deal.dealId}` : null,
                deal.geo,
                deal.pod,
                deal.dealStatus,
              ].filter(Boolean).join(" · ")}
              {dealPeople.length > 0 && (
                <span className="ml-2">· {dealPeople.length} member{dealPeople.length === 1 ? "" : "s"}</span>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/deals/${deal.id}?tab=Staffing`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Open in deal detail"
          >
            Open <ExternalLink className="h-3 w-3" />
          </Link>
          <Button size="sm" onClick={() => (isAdmin ? setAddOpen(true) : setRequestOpen(true))}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {isAdmin ? "Add Staffing" : "Request Staffing"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI strip */}
          <div className={cn("grid grid-cols-2 gap-3", isAdmin ? "md:grid-cols-4" : "md:grid-cols-3")}>
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Team Size</p>
              <p className="text-lg font-semibold text-foreground">{dealPeople.length}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Hrs/Week</p>
              <p className="text-lg font-semibold text-foreground">{totals.totalHrsWeek.toFixed(1)}h</p>
            </div>
            {isAdmin && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cost/Week</p>
                <p className="text-lg font-semibold text-foreground">{fmtCurrency(totals.totalCostWeek)}</p>
              </div>
            )}
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Revenue Managed</p>
              <p className="text-lg font-semibold text-foreground">{fmtCurrency(totals.totalRevManaged)}</p>
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              No team members on this deal yet.
            </div>
          ) : (
            grouped.map(group => {
              const ds = DEPT_STYLE[group.deptId] ?? DEPT_STYLE_FALLBACK;
              return (
              <div key={group.deptId} className={cn("border border-border rounded-lg overflow-hidden", ds.cell)}>
                <div className={cn("px-3 py-1.5 border-b flex items-center justify-between", ds.head)}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", ds.dot)} />
                    {group.deptName}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {group.members.length} member{group.members.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                        <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Role</th>
                        <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Pod</th>
                        <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Allocation</th>
                        <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Hrs/Wk</th>
                        {isAdmin && <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Rate/Hr</th>}
                        {isAdmin && <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cost/Wk</th>}
                        <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Rev Managed</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.members.map(p => {
                        const a = dealAssignments.find(x => x.personId === p.id);
                        const pct = (a?.allocationPct || 0) / 100;
                        const hrs = pct * 40;
                        const costWeek = hrs * (p.hourlyRate || 0);
                        const revManaged = (deal.mrr || 0) * pct;
                        const editing = editingAlloc === a?.id;
                        return (
                          <tr key={p.id} className="border-b border-border/50 hover:bg-accent/10">
                            <td className="py-2 px-3 font-medium text-foreground">
                              {p.name}
                              {p.tbh && <span className="ml-1 text-[10px] text-warning">(TBH)</span>}
                              {p.leaving && <span className="ml-1 text-[10px] text-destructive">(Leaving)</span>}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{p.roleTitle || p.designation}</td>
                            <td className="py-2 px-3 text-muted-foreground">{p.pod}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-medium">
                              {editing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={40}
                                    step="0.5"
                                    value={editAllocValue}
                                    onChange={e => setEditAllocValue(Number(e.target.value) || 0)}
                                    className="h-7 w-16 text-sm text-right"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === "Enter") handleSaveAlloc(a!.id);
                                      if (e.key === "Escape") setEditingAlloc(null);
                                    }}
                                  />
                                  <span className="text-[10px]">h</span>
                                  <button onClick={() => handleSaveAlloc(a!.id)} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => setEditingAlloc(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                                </div>
                              ) : (
                                <span
                                  className={cn(a ? "cursor-pointer hover:underline" : "text-muted-foreground")}
                                  onClick={() => { if (a) { setEditingAlloc(a.id); setEditAllocValue(Number(((a.allocationPct / 100) * 40).toFixed(1))); } }}
                                >
                                  {a?.allocationPct || 0}%
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">{hrs.toFixed(1)}h</td>
                            {isAdmin && (
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                {onUpdatePerson ? (
                                  <InlineNumberCell
                                    value={p.hourlyRate || 0}
                                    prefix={currencySymbol}
                                    onSave={v => onUpdatePerson(p.id, { hourlyRate: v })}
                                  />
                                ) : `${currencySymbol}${(p.hourlyRate || 0).toFixed(0)}`}
                              </td>
                            )}
                            {isAdmin && (
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(costWeek)}</td>
                            )}
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(revManaged)}</td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => a && setConfirmDelete(a.id)}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                title="Remove from deal"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}

      {/* Dialogs */}
      <AddStaffingMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        people={people}
        assignments={assignments}
        deals={deals}
        dealId={deal.id}
        onAdd={onAddAssignment}
      />
      <RequestStaffingDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        dealId={deal.id}
        dealLabel={deal.account || deal.dealName || deal.id}
      />
      <AlertDialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the member's assignment from this deal.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmDelete) {
                onDeleteAssignment(confirmDelete);
                toast.success("Member removed");
                setConfirmDelete(null);
              }
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Tiny inline number editor for hourly rate. */
function InlineNumberCell({
  value, prefix, onSave,
}: { value: number; prefix: string; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:underline"
        onClick={() => { setDraft(String(value)); setEditing(true); }}
      >
        {prefix}{(value || 0).toFixed(0)}
      </span>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className="h-7 w-20 text-sm text-right"
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter") { onSave(Number(draft) || 0); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={() => { onSave(Number(draft) || 0); setEditing(false); }}
      />
    </div>
  );
}