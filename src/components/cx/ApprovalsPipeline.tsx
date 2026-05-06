import { useMemo, useState } from "react";
import { useApprovals } from "@/hooks/useApprovals";
import { useUserRole } from "@/hooks/useUserRole";
import {
  applyApprovedRequest, cancelApprovalRequest, setRequestStatus, updateApprovalRequestDetails,
  type ApprovalRequestRow,
} from "@/lib/approvals";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, Eye, Loader2, ArrowRight, User2 } from "lucide-react";

const COLUMNS: { key: ApprovalRequestRow["status"]; label: string; tint: string }[] = [
  { key: "pending",      label: "Pending",        tint: "border-l-warning bg-warning/5" },
  { key: "under_review", label: "Under Review",   tint: "border-l-primary bg-primary/5" },
  { key: "approved",     label: "Approved",       tint: "border-l-positive bg-positive/5" },
  { key: "rejected",     label: "Rejected",       tint: "border-l-destructive bg-destructive/5" },
];

const TYPE_LABEL: Record<ApprovalRequestRow["request_type"], string> = {
  "staffing.add":    "Staffing — add member",
  "staffing.update": "Staffing — change",
  "staffing.remove": "Staffing — remove",
  "client.create":   "Create client",
  "deal.create":     "Create deal",
  "deal.update":     "Edit deal",
};

function diffPairs(prev: any, next: any): { key: string; before: any; after: any }[] {
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  const rows: { key: string; before: any; after: any }[] = [];
  keys.forEach(k => {
    const a = prev?.[k]; const b = next?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) rows.push({ key: k, before: a, after: b });
  });
  return rows;
}

function fmt(v: any) {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function ApprovalsPipeline() {
  const { items, loading } = useApprovals();
  const { canEditAll } = useUserRole();
  const [active, setActive] = useState<ApprovalRequestRow | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [payloadText, setPayloadText] = useState("{}");
  const [previousText, setPreviousText] = useState("{}");
  const [dealIdDraft, setDealIdDraft] = useState("");
  const [targetKindDraft, setTargetKindDraft] = useState("");
  const [targetIdDraft, setTargetIdDraft] = useState("");
  const [requesterNoteDraft, setRequesterNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<Set<string>>(new Set());

  const toggleBatch = (id: string) => {
    setExpandedBatch(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const grouped = useMemo(() => {
    // Children are NOT shown as top-level cards. They appear inside their parent batch card.
    // Cards in each column are: standalone requests + batch parents.
    // A batch parent's column is determined by its own status, but children have independent statuses.
    const childrenByParent = new Map<string, ApprovalRequestRow[]>();
    items.forEach(r => {
      if (r.parent_id) {
        if (!childrenByParent.has(r.parent_id)) childrenByParent.set(r.parent_id, []);
        childrenByParent.get(r.parent_id)!.push(r);
      }
    });
    const topLevel = items.filter(r => !r.parent_id);
    const m: Record<string, ApprovalRequestRow[]> = { pending: [], under_review: [], approved: [], rejected: [] };
    topLevel.forEach(r => { if (m[r.status]) m[r.status].push(r); });
    return { columns: m, childrenByParent };
  }, [items]);

  const openDetail = (r: ApprovalRequestRow) => {
    setActive(r);
    setReviewerNote(r.reviewer_note || "");
    setEditMode(false);
    setPayloadText(JSON.stringify(r.payload || {}, null, 2));
    setPreviousText(JSON.stringify(r.previous || {}, null, 2));
    setDealIdDraft(r.deal_id || "");
    setTargetKindDraft(r.target_kind || "");
    setTargetIdDraft(r.target_id || "");
    setRequesterNoteDraft(r.requester_note || "");
  };

  const handleStartReview = async () => {
    if (!active) return;
    setBusy(true);
    await setRequestStatus(active.id, "under_review", reviewerNote);
    setBusy(false);
  };
  const handleApprove = async () => {
    if (!active) return;
    setBusy(true);
    if (reviewerNote && reviewerNote !== active.reviewer_note) {
      await setRequestStatus(active.id, "under_review", reviewerNote);
    }
    await applyApprovedRequest(active.id);
    setBusy(false);
    setActive(null);
  };
  const handleReject = async () => {
    if (!active) return;
    setBusy(true);
    await setRequestStatus(active.id, "rejected", reviewerNote);
    if (active.is_batch) {
      // Cascade reject to any still-open children
      const children = grouped.childrenByParent.get(active.id) || [];
      for (const c of children) {
        if (c.status === "pending" || c.status === "under_review") {
          await setRequestStatus(c.id, "rejected", reviewerNote || "Rejected with batch");
        }
      }
    }
    setBusy(false);
    setActive(null);
  };
  const handleCancel = async () => {
    if (!active) return;
    setBusy(true);
    await cancelApprovalRequest(active.id);
    setBusy(false);
    setActive(null);
  };

  const diff = active ? diffPairs(active.previous, active.payload) : [];
  const activeChildren = active && active.is_batch ? (grouped.childrenByParent.get(active.id) || []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Approvals pipeline</h2>
          <p className="text-xs text-muted-foreground">
            Staffing changes, client and deal creation requests requiring Central Cx approval.
          </p>
        </div>
        <Badge variant="outline">{items.length} total</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map(col => (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {grouped.columns[col.key]?.length || 0}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {(grouped.columns[col.key] || []).map(r => {
                  const children = r.is_batch ? (grouped.childrenByParent.get(r.id) || []) : [];
                  const isExpanded = expandedBatch.has(r.id);
                  return (
                    <Card
                      key={r.id}
                      className={`p-3 border-l-4 ${col.tint}`}
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => openDetail(r)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {r.is_batch ? (r.batch_title || "Staffing batch") : TYPE_LABEL[r.request_type]}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {r.deal_id && (
                          <div className="text-[11px] text-muted-foreground mt-1 truncate">
                            Deal: {r.deal_id}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          <User2 className="h-3 w-3" /> {r.requested_by_name || "Unknown"}
                        </div>
                        {r.requester_note && (
                          <div className="text-[11px] text-foreground mt-1 line-clamp-2">"{r.requester_note}"</div>
                        )}
                      </div>
                      {r.is_batch && (
                        <div className="mt-2 border-t border-border/60 pt-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleBatch(r.id); }}
                            className="text-[10px] font-medium text-primary hover:underline"
                          >
                            {isExpanded ? "Hide" : `Show ${children.length} sub-request${children.length === 1 ? "" : "s"}`}
                          </button>
                          {isExpanded && (
                            <div className="mt-1.5 space-y-1">
                              {children.map(c => {
                                const cTint = c.status === "approved" ? "text-positive"
                                  : c.status === "rejected" ? "text-destructive"
                                  : c.status === "under_review" ? "text-primary"
                                  : c.status === "cancelled" ? "text-muted-foreground"
                                  : "text-warning";
                                return (
                                  <div
                                    key={c.id}
                                    onClick={(e) => { e.stopPropagation(); openDetail(c); }}
                                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1 cursor-pointer hover:bg-accent/30"
                                  >
                                    <span className="text-[11px] truncate">{TYPE_LABEL[c.request_type]}</span>
                                    <span className={`text-[10px] font-medium uppercase tracking-wide ${cTint}`}>
                                      {c.status.replace("_", " ")}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
                {(grouped.columns[col.key] || []).length === 0 && (
                  <div className="text-[11px] text-muted-foreground text-center py-6 italic">No requests</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!active} onOpenChange={v => { if (!v) setActive(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {active.is_batch ? (active.batch_title || "Staffing batch") : TYPE_LABEL[active.request_type]}
                </SheetTitle>
                <SheetDescription>
                  Requested by <span className="font-medium text-foreground">{active.requested_by_name}</span>
                  {" · "}{formatDistanceToNow(new Date(active.created_at), { addSuffix: true })}
                  {active.parent_id && <> · part of a batch request</>}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{active.status.replace("_", " ")}</Badge>
                  {active.deal_id && <Badge variant="secondary">Deal {active.deal_id}</Badge>}
                </div>

                {active.requester_note && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Requester note</div>
                    <div className="rounded-md bg-secondary px-3 py-2 text-sm">{active.requester_note}</div>
                  </div>
                )}

                {active.is_batch && activeChildren.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Sub-requests ({activeChildren.length}) — each is reviewed independently
                    </div>
                    <div className="rounded-md border border-border divide-y divide-border">
                      {activeChildren.map(c => (
                        <div
                          key={c.id}
                          onClick={() => openDetail(c)}
                          className="px-3 py-2 grid grid-cols-[1fr_auto] items-center gap-2 text-xs cursor-pointer hover:bg-accent/30"
                        >
                          <span className="truncate">{TYPE_LABEL[c.request_type]}</span>
                          <Badge variant="outline" className="text-[10px]">{c.status.replace("_", " ")}</Badge>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Open any sub-request to approve or reject it on its own.
                    </p>
                  </div>
                )}

                {!active.is_batch && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {active.request_type === "staffing.update" || active.request_type === "staffing.remove"
                      ? "Proposed change (before → after)" : "Proposed values"}
                  </div>
                  {diff.length > 0 ? (
                    <div className="rounded-md border border-border divide-y divide-border">
                      {diff.map(d => (
                        <div key={d.key} className="px-3 py-2 grid grid-cols-[120px_1fr_16px_1fr] items-center gap-2 text-xs">
                          <span className="text-muted-foreground truncate">{d.key}</span>
                          <span className="text-muted-foreground line-through truncate">{fmt(d.before)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground truncate">{fmt(d.after)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="rounded-md border border-border bg-secondary/50 p-2 text-[11px] overflow-auto max-h-64">
                      {JSON.stringify(active.payload, null, 2)}
                    </pre>
                  )}
                </div>
                )}

                {canEditAll && (active.status === "pending" || active.status === "under_review") && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Reviewer note (optional)</div>
                    <Textarea value={reviewerNote} onChange={e => setReviewerNote(e.target.value)} rows={3} />
                  </div>
                )}

                {active.reviewer_name && (active.status === "approved" || active.status === "rejected") && (
                  <div className="text-xs text-muted-foreground">
                    {active.status === "approved" ? "Approved" : "Rejected"} by{" "}
                    <span className="text-foreground">{active.reviewer_name}</span>
                    {active.reviewer_note && <> — "{active.reviewer_note}"</>}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2 justify-end">
                {!canEditAll && active.status === "pending" && (
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={busy}>
                    Cancel my request
                  </Button>
                )}
                {canEditAll && active.status === "pending" && !active.is_batch && (
                  <Button variant="outline" size="sm" onClick={handleStartReview} disabled={busy}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Mark under review
                  </Button>
                )}
                {canEditAll && (active.status === "pending" || active.status === "under_review") && !active.is_batch && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleReject} disabled={busy} className="text-destructive">
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                    </Button>
                    <Button size="sm" onClick={handleApprove} disabled={busy}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                      Approve & apply
                    </Button>
                  </>
                )}
                {canEditAll && active.is_batch && (active.status === "pending" || active.status === "under_review") && (
                  <Button variant="outline" size="sm" onClick={handleReject} disabled={busy} className="text-destructive">
                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject all sub-requests
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
