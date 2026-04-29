import { useEffect, useState, useCallback } from "react";
import { Loader2, X, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { cancelApprovalRequest } from "@/lib/approvals";
import type { ApprovalRequestRow } from "@/lib/approvals";
import { cn } from "@/lib/utils";
import type { Deal, Person } from "@/data/staffingData";

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
  cancelled:    { label: "Cancelled",       cls: "bg-stone-100 text-stone-700 border-stone-200", Icon: X },
};

const TYPE_LABEL: Record<string, string> = {
  "staffing.add":    "Add staffing",
  "staffing.update": "Update staffing",
  "staffing.remove": "Remove staffing",
};

export function MyStaffingRequests({ deals, people }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    // Pull both staffing rows and any batch parent rows the user submitted.
    const { data } = await (supabase as any)
      .from("approval_requests")
      .select("*")
      .eq("requested_by", user.id)
      .or(`request_type.in.(${STAFFING_TYPES.join(",")}),is_batch.eq.true`)
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

  const dealMap = new Map(deals.map(d => [d.id, d]));
  const personMap = new Map(people.map(p => [p.id, p]));

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

  const cancel = async (id: string) => {
    const target = items.find(i => i.id === id);
    const ok = await cancelApprovalRequest(id);
    if (ok && target?.is_batch) {
      // Cascade cancel to any open children
      const children = items.filter(c => c.parent_id === id && (c.status === "pending" || c.status === "under_review"));
      for (const c of children) {
        await cancelApprovalRequest(c.id);
      }
    }
    if (ok) refresh();
  };

  const startEditNote = (req: ApprovalRequestRow) => {
    setEditingId(req.id);
    setDraftNote(req.requester_note || "");
  };

  const saveNote = async (id: string) => {
    const { error } = await (supabase as any)
      .from("approval_requests")
      .update({ requester_note: draftNote })
      .eq("id", id);
    if (!error) {
      setEditingId(null);
      refresh();
    }
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
  const decided = topLevel.filter(i => i.status === "approved" || i.status === "rejected" || i.status === "cancelled");

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your change requests…
      </div>
    );
  }

  if (items.length === 0) return null;

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
                      {editingId !== req.id && (
                        <button
                          onClick={() => startEditNote(req)}
                          title="Edit note"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary/50"
                        ><Pencil className="h-3.5 w-3.5" /></button>
                      )}
                      <button
                        onClick={() => cancel(req.id)}
                        title={req.is_batch ? "Withdraw entire batch" : "Withdraw request"}
                        className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-border text-[11px] text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                      ><X className="h-3 w-3" /> Withdraw</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}