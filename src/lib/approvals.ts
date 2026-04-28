import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ApprovalRequestType =
  | "staffing.add"
  | "staffing.update"
  | "staffing.remove"
  | "client.create"
  | "deal.create";

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
}

export async function submitApprovalRequest(input: SubmitInput): Promise<ApprovalRequestRow | null> {
  const user = await currentUser();
  if (!user) {
    toast.error("You must be signed in to submit a change request.");
    return null;
  }
  const name = await currentDisplayName(user.id, user.email || "");

  // Pre-check: only one open request per deal
  if (input.dealId) {
    const { data: existing } = await (supabase as any)
      .from("approval_requests")
      .select("id, request_type, requested_by_name")
      .eq("deal_id", input.dealId)
      .in("status", ["pending", "under_review"])
      .limit(1);
    if (existing && existing.length > 0) {
      toast.error("A change request is already open for this deal. Please wait for it to be reviewed.");
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
