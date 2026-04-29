import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, X, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { deleteApprovalRequest } from "@/lib/approvals";
import type { ApprovalRequestRow } from "@/lib/approvals";
import { cn } from "@/lib/utils";
import type { Deal, Person } from "@/data/staffingData";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  deals: Deal[];
  people: Person[];
}

const STAFFING_TYPES = ["staffing.add", "staffing.update", "staffing.remove"];

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: any }> = {
  pending:      { label: "Pending review",  cls: "bg-amber-50 text-amber-800 border-amber-200", Icon: Clock },
  under_review: { label: "Under review",    cls: "bg-blue-50 text-blue-800 border-blue-200",    Icon: Clock },
  approved:     { label: "Approved",        cls: "bg-emerald-50 text-emerald-800 border-emerald-200", Icon: CheckCircle2 },
  rejected:     { label: "Rejected",        cls: "bg-rose-50 text-rose-800 border-rose-200",    Icon: XCircle },
};

const TYPE_LABEL: Record<string, string> = {
  "staffing.add":    "Add staffing",
  "staffing.update": "Update staffing",
  "staffing.remove": "Remove staffing",
};

const TYPE_PILL: Record<string, string> = {
  "staffing.add":    "bg-emerald-50 text-emerald-800 border-emerald-200",
  "staffing.update": "bg-blue-50 text-blue-800 border-blue-200",
  "staffing.remove": "bg-rose-50 text-rose-800 border-rose-200",
};

export function MyStaffingRequests({ deals, people }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    // Pull both staffing rows and any batch parent rows the user submitted.
    const { data } = await (supabase as any)
      .from("approval_requests")
      .select("*")
      .eq("requested_by", user.id)
      .or(`request_type.in.(${STAFFING_TYPES.join(",")}),is_batch.eq.true`)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as ApprovalRequestRow[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const ch = supabase
      .channel(`my_staffing_requests_${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "approval_requests", filter: `requested_by=eq.${user.id}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  const dealMap = useMemo(() => new Map(deals.map(d => [d.id, d])), [deals]);
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  const describePayload = (req: ApprovalRequestRow): string => {
    const p = req.payload || {};
    const prev = req.previous || {};
    const personName = (id: string) => personMap.get(id)?.name || id || "—";
    if (req.request_type === "staffing.add") {
      return `Add ${personName(p.personId)} (${p.roleKey || "—"}) at ${p.allocationPct ?? 0}%`;
    }
    if (req.request_type === "staffing.remove") {
      return `Remove ${personName(prev.personId)} (${prev.roleKey || "—"})`;
    }
    if (req.request_type === "staffing.update") {
      const bits: string[] = [];
      if (p.personId && p.personId !== prev.personId) bits.push(`assignee → ${personName(p.personId)}`);
      if (p.allocationPct !== undefined && p.allocationPct !== prev.allocationPct) bits.push(`allocation → ${p.allocationPct}%`);
      if (p.roleKey && p.roleKey !== prev.roleKey) bits.push(`role → ${p.roleKey}`);
      if (!bits.length) bits.push("update");
      return `Update ${personName(prev.personId || p.personId)}: ${bits.join(", ")}`;
    }
    return req.request_type;
  };

  const withdraw = async (id: string) => {
    if (!confirm("Withdraw and delete this request? This cannot be undone.")) return;
    const ok = await deleteApprovalRequest(id);
    if (ok) refresh();
  };

  // Build parent → children map; standalone rows render alone.
  const childrenByParent = new Map<string, ApprovalRequestRow[]>();
  items.forEach(r => {
    if (r.parent_id) {
      if (!childrenByParent.has(r.parent_id)) childrenByParent.set(r.parent_id, []);
      childrenByParent.get(r.parent_id)!.push(r);
    }
  });
  const topLevel = items.filter(r => !r.parent_id);
  const open = topLevel.filter(i => i.status === "pending" || i.status === "under_review");
  const decided = topLevel.filter(i => i.status === "approved" || i.status === "rejected");

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your change requests…
      </div>
    );
  }

  if (items.length === 0) return null;

  const editingReq = editTargetId ? items.find(r => r.id === editTargetId) || null : null;
  const editingChildren = editingReq && editingReq.is_batch
    ? (childrenByParent.get(editingReq.id) || [])
    : [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">My staffing change requests</h3>
          {open.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              {open.length} awaiting Central Cx
            </span>
          )}
          {decided.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{decided.length} decided</span>
          )}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t border-border divide-y divide-border/60">
          {topLevel.map(req => {
            const sb = STATUS_BADGE[req.status] || STATUS_BADGE.pending;
            const Icon = sb.Icon;
            const deal = dealMap.get(req.deal_id);
            const isOpen = req.status === "pending" || req.status === "under_review";
            const children = req.is_batch ? (childrenByParent.get(req.id) || []) : [];
            return (
              <div key={req.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", sb.cls)}>
                        <Icon className="h-3 w-3" /> {sb.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {req.is_batch ? `Batch · ${children.length} change${children.length === 1 ? "" : "s"}` : (TYPE_LABEL[req.request_type] || req.request_type)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">· {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground truncate">
                      {req.is_batch && req.batch_title ? req.batch_title : (deal ? `${deal.account} — ${deal.dealName}` : req.deal_id || "—")}
                    </div>
                    {!req.is_batch && (
                      <div className="text-xs text-muted-foreground">{describePayload(req)}</div>
                    )}

                    {req.is_batch && children.length > 0 && (
                      <div className="mt-2 space-y-1 rounded-md border border-border bg-secondary/20 p-2">
                        {children.map(c => {
                          const csb = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
                          const CIcon = csb.Icon;
                          return (
                            <div key={c.id} className="flex items-start justify-between gap-2 text-[11px]">
                              <div className="min-w-0 flex-1">
                                <div className="text-foreground truncate">{describePayload(c)}</div>
                              </div>
                              <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0", csb.cls)}>
                                <CIcon className="h-3 w-3" /> {csb.label}
                              </span>
                              {(c.status === "pending" || c.status === "under_review") && (
                                <button
                                  onClick={() => cancel(c.id)}
                                  title="Withdraw this sub-request"
                                  className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 shrink-0"
                                ><X className="h-3 w-3" /></button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {editingId === req.id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          autoFocus
                          value={draftNote}
                          onChange={e => setDraftNote(e.target.value)}
                          placeholder="Add a note for the reviewer…"
                          className="flex-1 h-7 px-2 rounded-md border border-border bg-background text-xs"
                        />
                        <button
                          onClick={() => saveNote(req.id)}
                          className="h-7 px-2 rounded-md bg-foreground text-background text-[11px] font-medium"
                        >Save</button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="h-7 px-2 rounded-md border border-border text-[11px]"
                        >Cancel</button>
                      </div>
                    ) : (
                      req.requester_note && (
                        <div className="mt-1 text-[11px] text-muted-foreground italic">"{req.requester_note}"</div>
                      )
                    )}
                    {req.reviewer_note && (
                      <div className="mt-1 text-[11px] text-foreground">
                        <span className="text-muted-foreground">Reviewer:</span> {req.reviewer_note}
                      </div>
                    )}
                  </div>

                  {isOpen && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditTargetId(req.id)}
                        title="Edit request"
                        className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-secondary/50"
                      ><Pencil className="h-3 w-3" /> Edit</button>
                      <button
                        onClick={() => withdraw(req.id)}
                        title={req.is_batch ? "Withdraw and delete entire batch" : "Withdraw and delete request"}
                        className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                      ><Trash2 className="h-3 w-3" /> Withdraw</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingReq && (
        <EditRequestDialog
          req={editingReq}
          children={editingChildren}
          dealMap={dealMap}
          personMap={personMap}
          onClose={() => setEditTargetId(null)}
          onSaved={() => { setEditTargetId(null); refresh(); }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------
 * Edit dialog: tabular view of the request and its sub-items.
 * BOPMs can adjust requested allocation %, edit per-row note, remove
 * individual sub-items, or change the batch title / requester note.
 * ------------------------------------------------------------------ */

interface EditRequestDialogProps {
  req: ApprovalRequestRow;
  children: ApprovalRequestRow[];
  dealMap: Map<string, Deal>;
  personMap: Map<string, Person>;
  onClose: () => void;
  onSaved: () => void;
}

interface DraftRow {
  id: string;
  requestType: string;
  dealId: string;
  personId: string;
  roleKey: string;
  currentAlloc: number | null;
  requestedAlloc: number | null;
  note: string;
  remove: boolean;
  status: string;
  editable: boolean;
}

function EditRequestDialog({ req, children, dealMap, personMap, onClose, onSaved }: EditRequestDialogProps) {
  const rows = req.is_batch ? children : [req];
  const [drafts, setDrafts] = useState<DraftRow[]>(() => rows.map(r => {
    const p = r.payload || {};
    const prev = r.previous || {};
    const open = r.status === "pending" || r.status === "under_review";
    return {
      id: r.id,
      requestType: r.request_type,
      dealId: r.deal_id,
      personId: p.personId || prev.personId || "",
      roleKey: p.roleKey || prev.roleKey || "",
      currentAlloc: typeof prev.allocationPct === "number" ? prev.allocationPct : null,
      requestedAlloc: typeof p.allocationPct === "number" ? p.allocationPct : null,
      note: r.requester_note || "",
      remove: false,
      status: r.status,
      editable: open,
    };
  }));
  const [batchTitle, setBatchTitle] = useState(req.batch_title || "");
  const [batchNote, setBatchNote] = useState(req.requester_note || "");
  const [saving, setSaving] = useState(false);

  const updateDraft = (id: string, patch: Partial<DraftRow>) => {
    setDrafts(d => d.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const personLabel = (id: string) => personMap.get(id)?.name || id || "—";
  const deal = dealMap.get(req.deal_id);

  const save = async () => {
    setSaving(true);
    try {
      const toDelete = drafts.filter(d => d.remove && d.editable).map(d => d.id);
      const toUpdate = drafts.filter(d => !d.remove && d.editable);

      // Per-sub-item updates: requested alloc + note.
      for (const d of toUpdate) {
        const orig = rows.find(r => r.id === d.id)!;
        const newPayload = { ...(orig.payload || {}) };
        if (d.requestedAlloc !== null && d.requestedAlloc !== undefined) {
          newPayload.allocationPct = d.requestedAlloc;
        }
        const patch: any = {
          payload: newPayload,
          requester_note: d.note,
        };
        await (supabase as any).from("approval_requests").update(patch).eq("id", d.id);
      }

      // Sub-item removals (only meaningful inside a batch).
      if (toDelete.length) {
        await (supabase as any).from("approval_requests").delete().in("id", toDelete);
      }

      // Batch parent updates.
      if (req.is_batch) {
        const remainingChildren = drafts.filter(d => !(d.remove && d.editable));
        if (remainingChildren.length === 0) {
          // Nothing left → delete the parent too.
          await (supabase as any).from("approval_requests").delete().eq("id", req.id);
        } else {
          await (supabase as any).from("approval_requests").update({
            batch_title: batchTitle,
            requester_note: batchNote,
          }).eq("id", req.id);
        }
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">Edit change request</DialogTitle>
          <div className="text-xs text-muted-foreground">
            {deal ? `${deal.account} — ${deal.dealName}` : (req.deal_id || "—")}
          </div>
        </DialogHeader>

        {req.is_batch && (
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground">Request title</label>
            <input
              value={batchTitle}
              onChange={e => setBatchTitle(e.target.value)}
              className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm"
              placeholder="Short title for this batch"
            />
            <label className="text-[11px] font-medium text-muted-foreground">Note for reviewer</label>
            <textarea
              value={batchNote}
              onChange={e => setBatchNote(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs"
              placeholder="Why are you proposing these changes?"
            />
          </div>
        )}

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Change</th>
                <th className="text-left px-3 py-2">Person</th>
                <th className="text-left px-3 py-2">Role</th>
                <th className="text-right px-3 py-2">Current %</th>
                <th className="text-right px-3 py-2">Requested %</th>
                <th className="text-left px-3 py-2">Note</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {drafts.map(d => {
                const allocEditable = d.editable && d.requestType !== "staffing.remove";
                return (
                  <tr key={d.id} className={cn(d.remove && "opacity-40 line-through")}>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                        TYPE_PILL[d.requestType] || "bg-stone-50 text-stone-700 border-stone-200")}>
                        {TYPE_LABEL[d.requestType] || d.requestType}
                      </span>
                      {!d.editable && (
                        <div className="text-[10px] text-muted-foreground mt-1">{d.status}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">{personLabel(d.personId)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.roleKey || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {d.currentAlloc !== null ? `${d.currentAlloc}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {allocEditable && d.requestedAlloc !== null ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={d.requestedAlloc}
                          onChange={e => updateDraft(d.id, { requestedAlloc: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          className="w-16 h-7 px-1.5 text-right rounded-md border border-border bg-background tabular-nums"
                        />
                      ) : (
                        <span className="tabular-nums text-muted-foreground">{d.requestedAlloc !== null ? `${d.requestedAlloc}%` : "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {d.editable ? (
                        <input
                          value={d.note}
                          onChange={e => updateDraft(d.id, { note: e.target.value })}
                          placeholder="Optional"
                          className="w-full h-7 px-2 rounded-md border border-border bg-background text-[11px]"
                        />
                      ) : (
                        <span className="text-muted-foreground">{d.note || "—"}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {d.editable && req.is_batch && (
                        <button
                          onClick={() => updateDraft(d.id, { remove: !d.remove })}
                          title={d.remove ? "Keep this change" : "Remove this change from the request"}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                        ><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {drafts.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">No items.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {req.is_batch && (
          <div className="text-[11px] text-muted-foreground">
            Tip: removing all changes will withdraw the entire request.
          </div>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-secondary/50"
          >Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save changes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}