import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ApprovalRequestType =
  | "staffing.add"
  | "staffing.update"
  | "staffing.remove"
  | "client.create"
  | "deal.create"
  | "deal.update";

export interface ApprovalRequestRow {
  id: string;
  request_type: ApprovalRequestType;
  target_kind: string;
  target_id: string;
  deal_id: string;
  payload: any;
  previous: any;
  status: "pending" | "under_review" | "approved" | "rejected" | "cancelled";
  requested_by: string;
  requested_by_name: string;
  requester_note: string;
  reviewer_id: string | null;
  reviewer_name: string;
  reviewer_note: string;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  parent_id?: string | null;
  is_batch?: boolean;
  batch_title?: string;
}

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

async function currentDisplayName(uid: string, fallback?: string) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", uid)
    .maybeSingle();
  return data?.display_name || fallback || "Unknown";
}

export interface SubmitInput {
  type: ApprovalRequestType;
  payload: any;
  previous?: any;
  dealId?: string;
  targetKind?: string;
  targetId?: string;
  note?: string;
  parentId?: string;
}

export async function submitApprovalRequest(input: SubmitInput): Promise<ApprovalRequestRow | null> {
  const user = await currentUser();
  if (!user) {
    toast.error("You must be signed in to submit a change request.");
    return null;
  }
  const name = await currentDisplayName(user.id, user.email || "");

  // Pre-check: prevent duplicate open request for the SAME target (assignment) only.
  // Multiple open requests per deal are allowed (a batch can include several edits).
  if (input.targetId && !input.parentId) {
    const { data: existing } = await (supabase as any)
      .from("approval_requests")
      .select("id")
      .eq("target_id", input.targetId)
      .in("status", ["pending", "under_review"])
      .limit(1);
    if (existing && existing.length > 0) {
      toast.error("A change request is already open for this item.");
      return null;
    }
  }

  const { data, error } = await (supabase as any)
    .from("approval_requests")
    .insert({
      request_type: input.type,
      payload: input.payload || {},
      previous: input.previous || {},
      deal_id: input.dealId || "",
      target_kind: input.targetKind || "",
      target_id: input.targetId || "",
      requested_by: user.id,
      requested_by_name: name,
      requester_note: input.note || "",
      status: "pending",
      parent_id: input.parentId || null,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as any).code === "23505") {
      toast.error("A change request is already open for this deal.");
    } else {
      toast.error(error.message || "Could not submit request");
    }
    return null;
  }
  toast.success("Change request submitted — awaiting Central Cx approval.");
  return data as ApprovalRequestRow;
}

export interface BatchItem {
  type: Extract<ApprovalRequestType, "staffing.add" | "staffing.update" | "staffing.remove">;
  dealId: string;
  targetId: string;
  payload: any;
  previous?: any;
}

/**
 * Submit a batch of staffing change sub-requests grouped under a single parent.
 * The parent row is a marker (is_batch=true) that carries a friendly title.
 * Each sub-request stays independently approvable / rejectable.
 */
export async function submitStaffingBatch(opts: {
  title: string;
  note?: string;
  items: BatchItem[];
}): Promise<{ parentId: string; subIds: string[] } | null> {
  const user = await currentUser();
  if (!user) {
    toast.error("You must be signed in to submit a change request.");
    return null;
  }
  if (!opts.items.length) {
    toast.error("Add at least one change to the request.");
    return null;
  }
  const name = await currentDisplayName(user.id, user.email || "");
  const dealIds = Array.from(new Set(opts.items.map(i => i.dealId).filter(Boolean)));
  const dealIdForParent = dealIds.length === 1 ? dealIds[0] : "";

  const { data: parent, error: parentErr } = await (supabase as any)
    .from("approval_requests")
    .insert({
      request_type: opts.items[0].type, // arbitrary; parent is a marker
      payload: { item_count: opts.items.length, deal_ids: dealIds },
      previous: {},
      deal_id: dealIdForParent,
      target_kind: "staffing_batch",
      target_id: "",
      requested_by: user.id,
      requested_by_name: name,
      requester_note: opts.note || "",
      status: "pending",
      is_batch: true,
      batch_title: opts.title,
    })
    .select("*")
    .single();
  if (parentErr || !parent) {
    toast.error(parentErr?.message || "Could not submit batch request");
    return null;
  }

  const childRows = opts.items.map(it => ({
    request_type: it.type,
    payload: it.payload || {},
    previous: it.previous || {},
    deal_id: it.dealId || "",
    target_kind: "staffing_assignment",
    target_id: it.targetId || "",
    requested_by: user.id,
    requested_by_name: name,
    requester_note: opts.note || "",
    status: "pending",
    parent_id: parent.id,
  }));
  const { data: children, error: childErr } = await (supabase as any)
    .from("approval_requests")
    .insert(childRows)
    .select("id");
  if (childErr) {
    // Roll back the parent so we don't leave an orphan
    await (supabase as any).from("approval_requests").delete().eq("id", parent.id);
    toast.error(childErr.message || "Could not submit sub-requests");
    return null;
  }
  toast.success(`${opts.items.length} change${opts.items.length === 1 ? "" : "s"} sent to Central Cx`);
  return { parentId: parent.id, subIds: (children || []).map((c: any) => c.id) };
}

export async function cancelApprovalRequest(id: string) {
  const { error } = await (supabase as any)
    .from("approval_requests")
    .update({ status: "cancelled", decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    toast.error(error.message || "Could not cancel");
    return false;
  }
  toast.success("Request cancelled");
  return true;
}

/**
 * Hard-delete an approval request. If the row is a batch parent, all child
 * sub-requests are deleted first. Used when a requester withdraws a request —
 * we don't want stale "cancelled" rows lingering in their list.
 */
export async function deleteApprovalRequest(id: string): Promise<boolean> {
  // Delete any children first (covers batch parents; harmless otherwise).
  await (supabase as any).from("approval_requests").delete().eq("parent_id", id);
  const { error } = await (supabase as any)
    .from("approval_requests")
    .delete()
    .eq("id", id);
  if (error) {
    toast.error(error.message || "Could not withdraw request");
    return false;
  }
  toast.success("Request withdrawn");
  return true;
}

export async function setRequestStatus(
  id: string,
  status: "under_review" | "approved" | "rejected",
  reviewerNote?: string,
) {
  const user = await currentUser();
  if (!user) return false;
  const name = await currentDisplayName(user.id, user.email || "");
  const patch: any = {
    status,
    reviewer_id: user.id,
    reviewer_name: name,
  };
  if (reviewerNote !== undefined) patch.reviewer_note = reviewerNote;
  if (status === "approved" || status === "rejected") {
    patch.decided_at = new Date().toISOString();
  }
  const { error } = await (supabase as any)
    .from("approval_requests")
    .update(patch)
    .eq("id", id);
  if (error) {
    toast.error(error.message || "Could not update request");
    return false;
  }
  return true;
}

export async function applyApprovedRequest(id: string) {
  const { data, error } = await supabase.functions.invoke("approval-execute", {
    body: { request_id: id },
  });
  if (error) {
    toast.error(error.message || "Could not apply change");
    return false;
  }
  if ((data as any)?.error) {
    toast.error((data as any).error);
    return false;
  }
  toast.success("Change applied");
  return true;
}

/**
 * Admin/member shortcut: apply directly. Non-privileged: submit request.
 * Returns true if the caller can proceed with the local mutation.
 */
export async function requestOrApply(
  isPrivileged: boolean,
  input: SubmitInput,
): Promise<{ applied: boolean }> {
  if (isPrivileged) return { applied: true };
  await submitApprovalRequest(input);
  return { applied: false };
}
