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
    const today = new Date().toISOString().slice(0, 10);
    return assignments.filter(a => a.dealId === deal.id && (!a.endDate || a.endDate >= today));
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
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* ── Card header ───────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 bg-secondary/30">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-left min-w-0 flex-1"
        >
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
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
            grouped.map(group => (
              <div key={group.deptId} className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-accent/20 border-b border-border flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.deptName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
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
            ))
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